export const runtime = "nodejs";

function json(data: unknown, status = 200) {
  return Response.json(data, { status, headers: { "Cache-Control": "no-store" } });
}

const DEFAULT_BASE_URL = "https://api.moonshot.cn/v1";

function buildChatCompletionsUrl(baseURL: string): string {
  const trimmed = baseURL.trim().replace(/\/+$/, "");
  if (trimmed.endsWith("/chat/completions")) return trimmed;
  if (/\/v\d+$/.test(trimmed)) return `${trimmed}/chat/completions`;
  return `${trimmed}/v1/chat/completions`;
}

export async function POST(request: Request) {
  const apiKey = request.headers.get("x-api-key")?.trim();
  const baseURL = request.headers.get("x-api-base")?.trim() || DEFAULT_BASE_URL;
  const model = request.headers.get("x-api-model")?.trim() || process.env.KIMI_VISION_MODEL || "kimi-k2.6";

  if (!apiKey) return json({ code: "API_KEY_MISSING", message: "未提供模型 API 密钥，请先在首页设置模型配置。" }, 401);
  if (apiKey.length < 16) return json({ code: "API_KEY_INVALID", message: "密钥格式不正确。" }, 401);
  if (!/^https?:\/\/.+/i.test(baseURL)) return json({ code: "INVALID_BASE_URL", message: "Base URL 格式不正确。" }, 400);

  let body: { imageBase64?: string; signName?: string };
  try {
    body = await request.json() as typeof body;
  } catch {
    return json({ code: "INVALID_BODY", message: "请求体不是有效的 JSON。" }, 400);
  }

  const imageBase64 = String(body.imageBase64 || "");
  const signName = String(body.signName || "标识");
  if (!imageBase64) return json({ code: "EMPTY_IMAGE", message: "没有收到证据页图片。" }, 400);

  const chatUrl = buildChatCompletionsUrl(baseURL);
  const useThinking = baseURL.includes("moonshot.cn");

  const prompt = `你是标识设计图定位助手。下图是住宅标识方案的一张图纸，请找出图中「${signName}」这个标识的设计图位置，返回它的边界框（bounding box，归一化坐标，相对整图宽高，范围 0~1）。

要求：
1. x、y 是边界框左上角的归一化坐标；w、h 是边界框宽高的归一化值。
2. 只框出「${signName}」这个标识本身（含其标题/图名栏和图形），不要把整张图纸框进去。
3. 如果图中没有「${signName}」，found 设为 false。
4. 如果标识在图名栏有多张图（立面/剖面），框出最主要的一张。

输出 JSON 对象：{"found":true,"x":0.1,"y":0.2,"w":0.3,"h":0.4}，只输出 JSON。`;

  const content: Array<Record<string, unknown>> = [
    { type: "image_url", image_url: { url: `data:image/jpeg;base64,${imageBase64}` } },
    { type: "text", text: prompt },
  ];

  const buildBody = (withJsonFormat: boolean) => {
    const req: Record<string, unknown> = {
      model,
      messages: [{ role: "user", content }],
      max_tokens: 500,
    };
    if (withJsonFormat) req.response_format = { type: "json_object" };
    if (useThinking) req.thinking = { type: "disabled" };
    return JSON.stringify(req);
  };

  const callOnce = async (withJsonFormat: boolean) => {
    const response = await fetch(chatUrl, {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: buildBody(withJsonFormat),
    });
    let data: Record<string, unknown> = {};
    try { data = await response.json() as Record<string, unknown>; } catch { /* ignore */ }
    return { status: response.status, data };
  };

  let call: { status: number; data: Record<string, unknown> };
  let retried = false;
  try {
    call = await callOnce(true);
    if ((call.status === 400 || call.status === 422) && !retried) {
      call = await callOnce(false);
      retried = true;
    }
  } catch {
    return json({ code: "MODEL_NETWORK_ERROR", message: "无法连接视觉模型服务，请检查网络后重试。" }, 502);
  }

  if (call.status >= 400) {
    const error = call.data.error as { message?: string; code?: string } | undefined;
    return json({ code: error?.code || "MODEL_REQUEST_FAILED", message: error?.message || "视觉模型请求失败。" }, call.status);
  }

  const message = (call.data.choices as Array<{ message?: { content?: string } }>)?.[0]?.message;
  const outputText = message?.content || "";
  try {
    const parsed = JSON.parse(outputText) as { found?: boolean; x?: number; y?: number; w?: number; h?: number };
    if (parsed.found === false) return json({ found: false, message: `图中未识别到「${signName}」的设计图。` });
    const clamp = (v: number) => Math.max(0, Math.min(1, v));
    const box = {
      x: clamp(Number(parsed.x) || 0),
      y: clamp(Number(parsed.y) || 0),
      w: clamp(Number(parsed.w) || 0.2),
      h: clamp(Number(parsed.h) || 0.2),
    };
    if (box.w <= 0 || box.h <= 0) return json({ found: false, message: "定位结果无效。" });
    return json({ found: true, ...box, model, baseURL });
  } catch {
    return json({ code: "INVALID_MODEL_OUTPUT", message: "模型返回内容无法解析，请重试。" }, 502);
  }
}
