export const runtime = "nodejs";

type BaseTargetInput = {
  id: string;
  name: string;
  pages: { pageNumber: number; base64: string }[];
};

type BaseRow = {
  targetId: string;
  name: string;
  /** 底板材料：金属 / 岩板 / 石材 / 其他 */
  material: string;
  /** 底板颜色与字体颜色是否区分：是 / 否 / 证据不足 */
  colorDistinct: string;
  /** 是否采用 20/15mm 铝板三维一体雕刻：是 / 否 / 证据不足 */
  aluCarve: string;
  rationale: string;
  confidence: number;
};

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
  if (!model) return json({ code: "MODEL_NOT_CONFIGURED", message: "未提供模型名称。" }, 400);

  let body: { targets?: BaseTargetInput[] };
  try {
    body = await request.json() as typeof body;
  } catch {
    return json({ code: "INVALID_BODY", message: "请求体不是有效的 JSON。" }, 400);
  }

  const targets = (body.targets || []).filter((t) => t && t.id && t.name && Array.isArray(t.pages) && t.pages.length > 0);
  if (!targets.length) return json({ code: "EMPTY_TARGETS", message: "没有可判定的对象（第一层无“明确找到”的标识）。" }, 400);

  const images: { label: string; base64: string }[] = [];
  for (const t of targets) {
    for (const p of t.pages) {
      if (typeof p.base64 === "string" && p.base64.length > 0) {
        images.push({ label: `${t.name}（${t.id}）· PDF 第 ${p.pageNumber} 页`, base64: p.base64 });
      }
    }
  }
  if (!images.length) return json({ code: "EMPTY_IMAGES", message: "没有收到已渲染的证据页图片。" }, 400);
  console.log(`[analyze-base] targets=${targets.length} images=${images.length} model=${model}`);

  const chatUrl = buildChatCompletionsUrl(baseURL);
  const useThinking = baseURL.includes("moonshot.cn");

  const prompt = `你是住宅标识方案的底板设计审核助手。下面每张图前已用【标识名（ID）· PDF 第 X 页】标注，请识别图中"有底板的标识"，并**逐标识**判定以下三条底板规则：

1. 底板材料：底板是否采用金属、岩板、石材三种之一？
   - 是 → material 输出具体哪种（"金属"/"岩板"/"石材"）
   - 否 → material 输出"其他"，并在 rationale 说明用了什么材料
2. 底板颜色与字体颜色是否区分开？→ colorDistinct 输出"是"/"否"/"证据不足"
3. 底板和字体是否采用 20 或 15mm 铝板三维一体雕刻？→ aluCarve 输出"是"/"否"/"证据不足"

判定原则：
- 图纸有明确标注或可清晰判读时才判"是/否"；无标注、看不清、图中无底板 → 相应项判"证据不足"。
- 材料按图纸标注判断；无标注但能看出材质（金属质感/石材纹理等）也可在 rationale 说明。
- rationale 必须为确定性陈述，禁止用"可能/大概/约/估计/无法确认"等推断词；出现推断词说明无法确定，相应项应为"证据不足"。
- 本次只做 AI 初审，全部结果待业务复核。

输出 JSON 对象：{"rows":[{"targetId":"对象ID","name":"对象名","material":"金属|岩板|石材|其他","colorDistinct":"是|否|证据不足","aluCarve":"是|否|证据不足","rationale":"判断依据","confidence":0到1之间的数字}]}，只输出 JSON。`;

  const content: Array<Record<string, unknown>> = images.flatMap((img) => [
    { type: "text", text: `【${img.label}】` },
    { type: "image_url", image_url: { url: `data:image/jpeg;base64,${img.base64}` } },
  ]);
  content.push({ type: "text", text: prompt });

  const buildBody = (withJsonFormat: boolean) => {
    const req: Record<string, unknown> = {
      model,
      messages: [{ role: "user", content }],
      max_tokens: 3000,
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
    const parsed = JSON.parse(outputText) as { rows: BaseRow[] };
    const idSet = new Set(targets.map((t) => t.id));
    const rows = (parsed.rows || []).filter((row) => idSet.has(row.targetId));
    return json({ rows, model, baseURL, effectiveness: "AI 初审结果，未经业务确认，待业务人员精准复核" });
  } catch {
    return json({ code: "INVALID_MODEL_OUTPUT", message: "模型返回内容无法解析，请重试。" }, 502);
  }
}
