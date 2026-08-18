export const runtime = "nodejs";

function json(data: unknown, status = 200) {
  return Response.json(data, { status, headers: { "Cache-Control": "no-store" } });
}

/** 混元图像 3.0（参考生图）端点与模型 */
const HUNYUAN_URL = "https://tokenhub.tencentmaas.com/v1/wand/hunyuan-image/v3-generation";
const HUNYUAN_MODEL = "hy-image-v3";

export async function POST(request: Request) {
  const apiKey = request.headers.get("x-hunyuan-key")?.trim();

  if (!apiKey) return json({ code: "HUNYUAN_KEY_MISSING", message: "尚未配置混元生图 API Key，请先在首页「生图配置」中填写。" }, 401);

  let body: { sceneBase64?: string; signBase64?: string; prompt?: string };
  try {
    body = await request.json() as typeof body;
  } catch {
    return json({ code: "INVALID_BODY", message: "请求体不是有效的 JSON。" }, 400);
  }

  const sceneBase64 = String(body.sceneBase64 || "");
  const signBase64 = String(body.signBase64 || "");
  const prompt = String(body.prompt || "将标识设计图自然地融合到实景照片中，保持真实透视、光照与比例，生成一张真实感渲染图。");
  if (!sceneBase64) return json({ code: "EMPTY_SCENE", message: "没有收到实景照片。" }, 400);

  const images = [sceneBase64, signBase64].filter(Boolean).map((b64) => `data:image/png;base64,${b64}`);

  const reqBody: Record<string, unknown> = {
    model: HUNYUAN_MODEL,
    prompt,
    images,
  };

  let response: Response;
  try {
    response = await fetch(HUNYUAN_URL, {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify(reqBody),
    });
  } catch {
    return json({ code: "HUNYUAN_NETWORK_ERROR", message: "无法连接混元生图服务，请检查网络后重试。" }, 502);
  }

  if (response.status >= 400) {
    let msg = `混元生图请求失败（HTTP ${response.status}）`;
    try {
      const err = await response.json() as { error?: { message?: string } };
      if (err.error?.message) msg = err.error.message;
    } catch { /* ignore */ }
    return json({ code: "HUNYUAN_REQUEST_FAILED", message: msg }, response.status);
  }

  // 混元同步生图返回图片（兼容 url / b64_json 两种格式）
  try {
    const data = await response.json() as { data?: Array<{ url?: string; b64_json?: string }> };
    const first = data.data?.[0];
    if (first?.url) return json({ image: first.url, kind: "url" });
    if (first?.b64_json) return json({ image: first.b64_json, kind: "base64" });
    return json({ code: "HUNYUAN_NO_IMAGE", message: "混元未返回图片，请重试。" }, 502);
  } catch {
    return json({ code: "HUNYUAN_PARSE_ERROR", message: "混元返回内容无法解析，请重试。" }, 502);
  }
}
