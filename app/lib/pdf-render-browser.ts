/**
 * 浏览器端 PDF 逐页渲染为 JPEG base64。
 *
 * 为什么放在浏览器做：生产/开发环境的 API 路由跑在 Cloudflare Worker（workerd）
 * 运行时里，该运行时禁止动态加载 WebAssembly，任何 Emscripten 系 PDF 渲染库
 * （pdfium / pdfjs 的 canvas 原生模块）都无法在其中运行。
 * 而浏览器原生支持 canvas 与 pdf.js，用户上传的 PDF 本就在本地，逐页渲染后
 * 再把图片发给服务端视觉模型，是最干净、最可靠的路径。
 */
import { getDocument, GlobalWorkerOptions, type PDFDocumentProxy } from "pdfjs-dist";
// 2026-08-16 修复：vite dev 下 `?url` 转译返回 0B 空内容（实测：HTTP 200 + content-type text/javascript + Content-Length=0），
// 导致浏览器 pdf.js 创建 worker 失败且 promise 不 reject（卡死）。改用 public/ 静态资源的绝对 URL（vite 原样提供，无转译，1.3MB 完整内容）。
GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";

export type RenderedPage = {
  pageNumber: number;
  base64: string;
  width: number;
  height: number;
};

/** 渲染目标宽度上限，控制每页图片体积与 token 消耗（2026-08-15 调低：视觉模型 1100px 识别足够，显著提速） */
const TARGET_WIDTH = 1100;
const MAX_PDF_PAGES = 120;
/** 单页渲染面积上限（像素）：防止超长/超大图纸导致 canvas 内存爆炸、渲染卡死（2026-08-16 新增） */
const MAX_RENDER_PIXELS = 1760000;
/** JPEG 压缩质量（2026-08-15 由 0.8 调低至 0.7：对视觉识别影响极小，体积与渲染时间下降） */
const JPEG_QUALITY = 0.7;

/** 渲染单页（每页独立 canvas；失败不阻塞整体，返回空 base64 占位） */
async function renderPageFromDoc(pdfDoc: PDFDocumentProxy, index: number): Promise<RenderedPage> {
  try {
    const page = await pdfDoc.getPage(index);
    try {
      const baseViewport = page.getViewport({ scale: 1 });
      // 目标宽度 1100；仅当页面很小时放大（上限 1.6），大图不再放大到 2 倍
      let scale = Math.min(TARGET_WIDTH / baseViewport.width, 1.6);
      // 超长/超大页面按面积限幅：防止 canvas 尺寸失控导致内存爆炸、渲染卡死
      const baseArea = baseViewport.width * baseViewport.height;
      if (baseArea > 0) {
        const maxScaleByArea = Math.sqrt(MAX_RENDER_PIXELS / baseArea);
        scale = Math.min(scale, maxScaleByArea);
      }
      const viewport = page.getViewport({ scale });

      const canvas = document.createElement("canvas");
      const context = canvas.getContext("2d");
      if (!context) throw new Error("浏览器不支持 canvas");
      canvas.width = Math.floor(viewport.width);
      canvas.height = Math.floor(viewport.height);
      await page.render({ canvasContext: context, viewport }).promise;
      const base64 = canvas.toDataURL("image/jpeg", JPEG_QUALITY).split(",")[1] ?? "";
      return { pageNumber: index, base64, width: canvas.width, height: canvas.height };
    } finally {
      page.cleanup();
    }
  } catch (renderError) {
    console.warn(`[pdf-render] 第 ${index} 页渲染失败，跳过:`, renderError);
    return { pageNumber: index, base64: "", width: 0, height: 0 };
  }
}

export async function renderPdfPagesBrowser(
  blob: Blob,
  maxPages = MAX_PDF_PAGES,
  onProgress?: (done: number, total: number) => void,
): Promise<RenderedPage[]> {
  const data = new Uint8Array(await blob.arrayBuffer());
  // 注意：pdfDoc 不能命名为 `document`，会遮蔽全局 document 对象，导致
  // 后续 `document.createElement("canvas")` 调用到 pdfDoc 上（PDFDocumentProxy
  // 没有 createElement 方法），浏览器端报 "n.createElement is not a function"。
  const pdfDoc = await getDocument({ data }).promise;
  const pageCount = Math.min(pdfDoc.numPages, maxPages);
  const pages: RenderedPage[] = [];

  try {
    // 2026-08-16：分批并行渲染（每批 BATCH 页并发），128 页大 PDF 提速约 4 倍；
    // 串行 128 页需数分钟，并行后进度逐页可见
    const BATCH = 4;
    for (let start = 1; start <= pageCount; start += BATCH) {
      const batchIndexes = Array.from({ length: Math.min(BATCH, pageCount - start + 1) }, (_, k) => start + k);
      const batch = await Promise.all(batchIndexes.map((index) => renderPageFromDoc(pdfDoc, index)));
      for (const item of batch) {
        pages.push(item);
        onProgress?.(item.pageNumber, pageCount);
      }
    }
  } finally {
    await pdfDoc.destroy();
  }

  return pages;
}

/** 仅渲染指定页码（第二层 AI 判定对象证据页用），避免渲染整份大 PDF */
export async function renderPdfPagesByNumbers(
  blob: Blob,
  pageNumbers: number[],
  onProgress?: (done: number, total: number) => void,
): Promise<RenderedPage[]> {
  const data = new Uint8Array(await blob.arrayBuffer());
  const pdfDoc = await getDocument({ data }).promise;
  const uniq = [...new Set(pageNumbers.filter((n) => n >= 1 && n <= pdfDoc.numPages))].sort((a, b) => a - b);
  const pages: RenderedPage[] = [];

  try {
    const BATCH = 4;
    for (let start = 0; start < uniq.length; start += BATCH) {
      const batchNums = uniq.slice(start, start + BATCH);
      const batch = await Promise.all(batchNums.map((n) => renderPageFromDoc(pdfDoc, n)));
      for (const item of batch) {
        pages.push(item);
        onProgress?.(pages.length, uniq.length);
      }
    }
  } finally {
    await pdfDoc.destroy();
  }

  return pages;
}
