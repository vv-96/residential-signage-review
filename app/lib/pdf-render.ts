/**
 * PDF 逐页渲染为 PNG base64（Node 服务端）。
 * 方案：@hyzyla/pdfium（纯 WASM，可运行于 Worker/Node）+ pngjs（纯 JS PNG 编码）。
 * 不依赖任何原生模块，避免 Cloudflare Worker 模拟环境无法加载 .node 二进制的问题。
 */

import { PNG } from "pngjs";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

export type RenderedPage = {
  pageNumber: number;
  base64: string;
  width: number;
  height: number;
};

/** 渲染目标宽度上限，控制每页图片体积与 token 消耗 */
const TARGET_WIDTH = 1400;
const MAX_PDF_PAGES = 120;

let libraryPromise: Promise<Awaited<ReturnType<typeof import("@hyzyla/pdfium").PDFiumLibrary.init>>> | null = null;

function getLibrary() {
  if (!libraryPromise) {
    libraryPromise = (async () => {
      // vinext 的 workerd 环境里 process 对象不完整（缺 process.versions.node 或
      // type === "renderer"），pdfium 的 ENVIRONMENT_IS_NODE 是模块顶层变量、在
      // import 时即求值，会误走浏览器分支而抛 "not compiled for this environment"。
      // 因此必须在动态 import 之前补齐 process 字段，再显式传入 wasm 二进制。
      const g = globalThis as { process?: { versions?: Record<string, string>; type?: string } };
      if (g.process) {
        if (!g.process.versions) g.process.versions = {};
        if (!g.process.versions.node) g.process.versions.node = "22.0.0";
        if (g.process.type === "renderer") g.process.type = "node";
      }
      const { PDFiumLibrary } = await import("@hyzyla/pdfium");
      const wasmPath = resolve(process.cwd(), "node_modules/@hyzyla/pdfium/dist/pdfium.wasm");
      const wasmBinary = await readFile(wasmPath);
      return PDFiumLibrary.init({ wasmBinary });
    })();
  }
  return libraryPromise;
}

/** BGRA（pdfium 默认输出）→ RGBA（pngjs 输入） */
function bgraToRgba(data: Uint8Array): Uint8Array {
  const out = new Uint8Array(data.length);
  for (let index = 0; index < data.length; index += 4) {
    out[index] = data[index + 2];      // R
    out[index + 1] = data[index + 1];  // G
    out[index + 2] = data[index];      // B
    out[index + 3] = data[index + 3];  // A
  }
  return out;
}

export async function renderPdfPages(pdfBuffer: ArrayBuffer, maxPages = MAX_PDF_PAGES): Promise<RenderedPage[]> {
  const library = await getLibrary();
  const document = await library.loadDocument(new Uint8Array(pdfBuffer));
  const pageCount = Math.min(document.getPageCount(), maxPages);
  const pages: RenderedPage[] = [];

  try {
    for (let index = 1; index <= pageCount; index += 1) {
      const page = document.getPage(index);
      const { originalWidth } = page.getSize({ scale: 1, width: undefined, height: undefined });
      const scale = Math.min(TARGET_WIDTH / originalWidth, 2);
      const rendered = await page.render({ scale, render: "bitmap" });

      const png = new PNG({ width: rendered.width, height: rendered.height });
      png.data = Buffer.from(bgraToRgba(new Uint8Array(rendered.data)));
      const buffer = PNG.sync.write(png);

      pages.push({
        pageNumber: index,
        base64: buffer.toString("base64"),
        width: rendered.width,
        height: rendered.height,
      });
    }
  } finally {
    document.destroy();
  }

  return pages;
}
