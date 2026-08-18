export const runtime = "nodejs";

type DesignTargetInput = {
  id: string;
  name: string;
  /** 该对象证据页图片（浏览器端已渲染） */
  pages: { pageNumber: number; base64: string }[];
};

type DesignRow = {
  targetId: string;
  name: string;
  decision: "符合候选规则" | "不符合候选规则" | "证据不足";
  rationale: string;
  confidence: number;
};

function json(data: unknown, status = 200) {
  return Response.json(data, { status, headers: { "Cache-Control": "no-store" } });
}

/** 默认服务商（Kimi） */
const DEFAULT_BASE_URL = "https://api.moonshot.cn/v1";

function buildChatCompletionsUrl(baseURL: string): string {
  const trimmed = baseURL.trim().replace(/\/+$/, "");
  if (trimmed.endsWith("/chat/completions")) return trimmed;
  if (/\/v\d+$/.test(trimmed)) return `${trimmed}/chat/completions`;
  return `${trimmed}/v1/chat/completions`;
}

/**
 * 第二层证据确定性校验（AGENTS.md §2 口径）：rationale 含不确定/推断表述时，
 * 说明 AI 无法确定，结论不得支撑“符合/不符合”，强制降级为“证据不足”。
 * 注意：不与第一层共用词表——“不符合”在第二层是合法确定结论，故单独维护推断词。
 */
const DESIGN_INFERENCE_RE = /可能|疑似|推测|大概|大约|约|估计|隐含|相近|类似|未明确标注|未标注|无法测量|无法确认|不确定|未见|不能确定|应该|像是|接近于|无法判断|看不清|不清晰|难以/;
function verifiedDecision(decision: DesignRow["decision"], rationale?: string): DesignRow["decision"] {
  if (!rationale || decision === "证据不足") return decision;
  if (DESIGN_INFERENCE_RE.test(rationale)) return "证据不足";
  return decision;
}

export async function POST(request: Request) {
  const apiKey = request.headers.get("x-api-key")?.trim();
  const baseURL = request.headers.get("x-api-base")?.trim() || DEFAULT_BASE_URL;
  const model = request.headers.get("x-api-model")?.trim() || process.env.KIMI_VISION_MODEL || "kimi-k2.6";

  if (!apiKey) return json({ code: "API_KEY_MISSING", message: "未提供模型 API 密钥，请先在首页设置模型配置。" }, 401);
  if (apiKey.length < 16) return json({ code: "API_KEY_INVALID", message: "密钥格式不正确：长度应不少于 16 位。" }, 401);
  if (!/^https?:\/\/.+/i.test(baseURL)) return json({ code: "INVALID_BASE_URL", message: "Base URL 格式不正确。" }, 400);
  if (!model) return json({ code: "MODEL_NOT_CONFIGURED", message: "未提供模型名称。" }, 400);

  let body: { fontType?: string; level?: string; ruleText?: string; source?: string; targets?: DesignTargetInput[] };
  try {
    body = await request.json() as typeof body;
  } catch {
    return json({ code: "INVALID_BODY", message: "请求体不是有效的 JSON。" }, 400);
  }

  const fontType = String(body.fontType || "");
  const level = String(body.level || "");
  const ruleText = String(body.ruleText || "");
  const source = String(body.source || "");
  const targets = (body.targets || []).filter((t) => t && t.id && t.name && Array.isArray(t.pages) && t.pages.length > 0);
  if (!fontType || !ruleText) return json({ code: "MISSING_RULE", message: "缺少字体类型或规则文本。" }, 400);
  if (!targets.length) return json({ code: "EMPTY_TARGETS", message: "没有可判定的对象（该字体类型下暂无第一层“明确找到”的标识）。" }, 400);

  // 汇总图片：每张图前标注对象名 + 物理页码，避免模型错配
  const images: { label: string; base64: string }[] = [];
  for (const t of targets) {
    for (const p of t.pages) {
      if (typeof p.base64 === "string" && p.base64.length > 0) {
        images.push({ label: `${t.name}（${t.id}）· PDF 第 ${p.pageNumber} 页`, base64: p.base64 });
      }
    }
  }
  if (!images.length) return json({ code: "EMPTY_IMAGES", message: "没有收到已渲染的证据页图片。" }, 400);
  console.log(`[analyze-design] fontType=${fontType} level=${level} targets=${targets.length} images=${images.length} model=${model}`);

  const chatUrl = buildChatCompletionsUrl(baseURL);
  const useThinking = baseURL.includes("moonshot.cn");

  const targetList = targets.map((t) => `${t.id}\t${t.name}`).join("\n");
  const prompt = `你是住宅标识方案的字体设计合规审核助手。审核对象为「${fontType}」的「${level}」。

设计标准（来源 ${source}）：${ruleText}

下面每张图前已用【对象名（ID）· PDF 第 X 页】标注其所属标识与物理页码，请**逐对象**判断该对象图纸中的字体是否符合上述字高标准。

本批待判定对象：
${targetList}

结论三选一（每个对象一个结论）：
- 符合候选规则：图纸有明确尺寸标注或可清晰判读，字高符合标准。
- 不符合候选规则：图纸有明确尺寸标注且字高不符合标准。
- 证据不足：图纸无尺寸标注、无法测量、未看到该类文字、或图片不清无法判读。

判定原则（必须遵守）：
1. 只有图纸标题栏/尺寸标注是“明确标注的同一标识字体”时才能判符合/不符合；其余情况判“证据不足”。
2. 图纸没有尺寸标注时，无法精确判定字高，必须判“证据不足”，不得臆测。
3. rationale 必须为确定性陈述，禁止用“可能/大概/大约/约/估计/未明确标注/无法测量/不确定/相近/类似”等推断或存疑词；只要出现任一此类词，说明你无法确定，该对象结论应为“证据不足”。
4. 本次只做 AI 初审，全部结果待业务复核。

输出 JSON 对象：{"rows":[{"targetId":"对象ID","name":"对象名","decision":"符合候选规则|不符合候选规则|证据不足","rationale":"判断依据","confidence":0到1之间的数字}]}，只输出 JSON。`;

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
    const parsed = JSON.parse(outputText) as { rows: DesignRow[] };
    const idSet = new Set(targets.map((t) => t.id));
    const rows = (parsed.rows || [])
      .filter((row) => idSet.has(row.targetId))
      .map((row) => ({ ...row, decision: verifiedDecision(row.decision, row.rationale) }));
    return json({ rows, model, baseURL, effectiveness: "AI 初审结果，未经业务确认，待业务人员精准复核" });
  } catch {
    return json({ code: "INVALID_MODEL_OUTPUT", message: "模型返回内容无法解析，请重试。" }, 502);
  }
}
