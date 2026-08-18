import { standardsForScope } from "../../lib/standard-catalog";

export const runtime = "nodejs";

type ModelRow = {
  id: string;
  category: string;
  name: string;
  status: "明确找到" | "缺失" | "疑似对应" | "待人工复核";
  evidence_pages: number[];
  pdf_original_name: string;
  rationale: string;
  confidence: number;
};

type PageInput = {
  pageNumber: number;
  base64: string;
};

function json(data: unknown, status = 200) {
  return Response.json(data, { status, headers: { "Cache-Control": "no-store" } });
}

/** 证据确定性校验（AGENTS.md §2 硬校验，2026-08-15）：
 * rationale 含否定或不确定/推断表述时，不得支撑“明确找到”，强制降级为“疑似对应”（证据页保留供业务复核）。 */
const NEGATIVE_RE = /位置不符|名称不符|标题为[^"]*而非|不属于|与[^"]*定义不符|仅[^"]*相似|不一致|不匹配|不符合/;
const INFERENCE_RE = /可能|疑似|推测|大概|隐含|功能相近|性质相似|类似|未明确标注|无法确认|不确定|未见明显|不能确定|应该属于|像是|接近于/;
function evidenceVerifiedStatus(status: ModelRow["status"], rationale?: string): ModelRow["status"] {
  if (status !== "明确找到" || !rationale) return status;
  if (NEGATIVE_RE.test(rationale) || INFERENCE_RE.test(rationale)) return "疑似对应";
  return status;
}

/** 每批最多发送的页数：单请求体与 token 有限，分批避免超限 */
const PAGES_PER_BATCH = 4;
const MAX_PDF_PAGES = 120;

/** 默认服务商（Kimi）：Base URL / 模型名缺省值 */
const DEFAULT_BASE_URL = "https://api.moonshot.cn/v1";

/** 将用户提供的 Base URL 规范化为 chat/completions 端点（兼容带/不带 /v1 或完整后缀） */
function buildChatCompletionsUrl(baseURL: string): string {
  const trimmed = baseURL.trim().replace(/\/+$/, "");
  if (trimmed.endsWith("/chat/completions")) return trimmed;
  if (/\/v\d+$/.test(trimmed)) return `${trimmed}/chat/completions`;
  return `${trimmed}/v1/chat/completions`;
}

/** 构造请求体；withJsonFormat 用于 JSON 输出失败时的降级重试；thinking 仅 Kimi 支持 */
function buildRequestBody(params: {
  model: string;
  batch: PageInput[];
  prompt: string;
  withJsonFormat: boolean;
  useThinking: boolean;
}): string {
  const { model, batch, prompt, withJsonFormat, useThinking } = params;
  const body: Record<string, unknown> = {
    model,
    messages: [{
      role: "user",
      content: [
        // 每张图前显式标注 PDF 物理页码，避免模型凭图像内容推断页码导致 evidence_pages 错配
        ...batch.flatMap((page) => [
          { type: "text" as const, text: `【PDF 第 ${page.pageNumber} 页】` },
          { type: "image_url" as const, image_url: { url: `data:image/jpeg;base64,${page.base64}` } },
        ]),
        { type: "text", text: prompt },
      ],
    }],
    max_tokens: 2000,
  };
  if (withJsonFormat) body.response_format = { type: "json_object" };
  // 仅 Kimi（moonshot）支持 thinking 参数；其他服务商带上会 400
  if (useThinking) body.thinking = { type: "disabled" };
  return JSON.stringify(body);
}

export async function POST(request: Request) {
  // 模型配置由调用方（使用者）通过请求头提供：各自用自己的密钥/服务商，不共用额度。
  // Base URL / 模型名缺省回退 Kimi（兼容只填密钥的老配置）。
  const apiKey = request.headers.get("x-api-key")?.trim();
  const baseURL = request.headers.get("x-api-base")?.trim() || DEFAULT_BASE_URL;
  const model = request.headers.get("x-api-model")?.trim() || process.env.KIMI_VISION_MODEL || "kimi-k2.6";

  if (!apiKey) return json({ code: "API_KEY_MISSING", message: "未提供模型 API 密钥，请先在首页设置模型配置。" }, 401);
  if (apiKey.length < 16) return json({ code: "API_KEY_INVALID", message: "密钥格式不正确：长度应不少于 16 位。" }, 401);
  if (!/^https?:\/\/.+/i.test(baseURL)) return json({ code: "INVALID_BASE_URL", message: "Base URL 格式不正确：应以 http(s):// 开头。" }, 400);
  if (!model) return json({ code: "MODEL_NOT_CONFIGURED", message: "未提供模型名称，请先在首页设置模型配置。" }, 400);

  const chatUrl = buildChatCompletionsUrl(baseURL);
  const useThinking = baseURL.includes("moonshot.cn");

  // 接收浏览器端已渲染好的页面图片（PDF 渲染已在浏览器完成，服务端只做视觉识别）
  let body: { pages?: PageInput[]; scope?: string[]; stage?: string };
  try {
    body = await request.json() as { pages?: PageInput[]; scope?: string[]; stage?: string };
  } catch {
    return json({ code: "INVALID_BODY", message: "请求体不是有效的 JSON。" }, 400);
  }

  const pages = (body.pages || []).filter((page) => page && typeof page.base64 === "string" && page.base64.length > 0);
  if (!pages.length) return json({ code: "EMPTY_PAGES", message: "没有收到已渲染的 PDF 页面图片。" }, 400);
  console.log(`[analyze] model=${model} baseURL=${baseURL} pages=${pages.length}`);
  if (pages.length > MAX_PDF_PAGES) pages.splice(MAX_PDF_PAGES);

  const scope = Array.isArray(body.scope) ? body.scope : [];
  const standards = standardsForScope(scope);
  if (!standards.length) return json({ code: "EMPTY_STANDARD_SCOPE", message: "当前范围没有可比对的标准项。" }, 400);

  const stage = String(body.stage || "未填写");
  const standardText = standards.map((item) => `${item.id}\t${item.category}\t${item.name}`).join("\n");

  // 分批调用视觉模型，每批返回该批页面的发现项
  const findingsByStandard = new Map<string, { status: ModelRow["status"]; pages: number[]; evidence: string[]; confidence: number }>();

  for (let start = 0; start < pages.length; start += PAGES_PER_BATCH) {
    const batch = pages.slice(start, start + PAGES_PER_BATCH);
    const pageRange = `${batch[0].pageNumber}–${batch[batch.length - 1].pageNumber}`;
    const prompt = `你是住宅标识方案的视觉初审助手。阅读以下 PDF 页面图片（第 ${pageRange} 页），对照候选标准清单，找出本批页面中出现的标识。

候选标准版本：v1.0-rc2（内部候选版，逐项规则尚待业务复核）
项目阶段假设：${stage}
提交范围假设：${scope.join("、")}

候选标准项：
${standardText}

规则：
1. 只返回本批页面中**确实出现**的标准项；用“可能隐含”“推测存在”“功能相近”等推断表述描述的项，不属于“确实出现”，不要返回或只能判“疑似对应”。
2. “明确找到”必须同时满足：①图纸标题/标注**明确是同一标识**（禁止用“可能/隐含/相近/类似”等推断词描述）；②安装位置与用途匹配该标准项定义；③rationale 为**确定性陈述**，全篇无任何推断或存疑词。任一不满足（名称相近、位置不符、用途不同、仅视觉相似、或使用了推断表述）都只能判“疑似对应”。
3. 不得把项目案名 LOGO 自动等同于单元景墙、前厅背景墙、墙面铭牌或景墙案名（SIGN-GATE-002）：案名 LOGO 出现在物业客服背景墙、室内背景墙等非社区大门位置时，不构成“景墙案名”的明确找到，只能判“疑似对应”或不返回。
4. evidence_pages 必须是 PDF 的 1 起始物理页码，且**只能在本批页码范围 ${pageRange} 内取值**。每张图前已用【PDF 第 X 页】标注其物理页码，请**严格按该标注填写 evidence_pages，禁止凭图像内容自行推断页码**（例如：即使图里内容看起来像“园区总平图”，也必须填该图标注的实际页码，而不是你猜想的页码）。pdf_original_name 记录图纸标题或名称。
5. 本次只做 AI 初审，全部结果待人工复核，不得声称业务确认。
6. 未在任一页出现的候选标准项，将由系统判定为“缺失”。
7. 证据确定性校验：若 rationale（判断依据）中出现以下任一表述，该条证据不得支撑“明确找到”，status 必须为“疑似对应”（若证据明确指向其他标准项，直接不返回该条）：
   - 否定表述：“位置不符”“名称不符”“标题为XX而非YY”“不属于”“与XX定义不符”等；
   - 不确定/推断表述（新增）：“可能”“疑似”“推测”“大概”“隐含”“功能相近”“性质相似”“类似”“未明确标注”“无法确认”“不确定”“未见明显”等；
   - 判“明确找到”要求 rationale 全篇为确定性陈述（如“图纸标题明确标注”“安装位置与定义一致”）；只要出现任一推断或存疑词，一律降级“疑似对应”。

输出 JSON 对象：{"rows":[{"id":"标准项ID","status":"明确找到|疑似对应","evidence_pages":[页码],"pdf_original_name":"图纸名","rationale":"判断依据","confidence":0到1之间的数字}]}，只输出 JSON。`;

    // 单次调用：带/不带 JSON 格式参数
    const callOnce = async (withJsonFormat: boolean) => {
      const response = await fetch(chatUrl, {
        method: "POST",
        headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
        body: buildRequestBody({ model, batch, prompt, withJsonFormat, useThinking }),
      });
      let data: Record<string, unknown> = {};
      try { data = await response.json() as Record<string, unknown>; } catch { /* 非 JSON 响应体忽略 */ }
      return { status: response.status, data };
    };

    let call: { status: number; data: Record<string, unknown> };
    let retried = false;
    try {
      call = await callOnce(true);
      // 部分服务商不支持 response_format（400/422）→ 去掉重试一次
      if ((call.status === 400 || call.status === 422) && !retried) {
        call = await callOnce(false);
        retried = true;
      }
    } catch {
      return json({ code: "MODEL_NETWORK_ERROR", message: `无法连接视觉模型服务（第 ${pageRange} 页批次），请检查网络后重试。` }, 502);
    }

    if (call.status >= 400) {
      const error = call.data.error as { message?: string; code?: string } | undefined;
      return json({ code: error?.code || "MODEL_REQUEST_FAILED", message: error?.message || `视觉模型请求失败（第 ${pageRange} 页批次）。` }, call.status);
    }

    const message = (call.data.choices as Array<{ message?: { content?: string } }>)?.[0]?.message;
    const outputText = message?.content || "";
    try {
      const parsed = JSON.parse(outputText) as { rows: ModelRow[] };
      for (const row of parsed.rows || []) {
        if (!standards.some((item) => item.id === row.id)) continue;
        // 硬校验：rationale 含否定/推断表述时强制降级（AGENTS.md §2 证据确定性校验，2026-08-15）
        const verifiedStatus = evidenceVerifiedStatus(row.status, row.rationale);
        const existing = findingsByStandard.get(row.id);
        if (existing) {
          existing.status = existing.status === "明确找到" || verifiedStatus === "明确找到" ? "明确找到" : "疑似对应";
          existing.pages.push(...(row.evidence_pages || []));
          existing.evidence.push([row.pdf_original_name, row.rationale].filter(Boolean).join("；"));
          existing.confidence = Math.max(existing.confidence, row.confidence ?? 0);
        } else {
          findingsByStandard.set(row.id, {
            status: verifiedStatus,
            pages: row.evidence_pages || [],
            evidence: [[row.pdf_original_name, row.rationale].filter(Boolean).join("；")],
            confidence: row.confidence ?? 0,
          });
        }
      }
    } catch {
      return json({ code: "INVALID_MODEL_OUTPUT", message: `模型返回内容无法解析（第 ${pageRange} 页批次），请重试。` }, 502);
    }
  }

  // 汇总为标准项逐项结果：未在任一页找到的项 → 缺失
  const rows = standards.map((standard) => {
    const finding = findingsByStandard.get(standard.id);
    return {
      id: standard.id,
      category: standard.category,
      name: standard.name,
      aiStatus: finding?.status || "缺失",
      evidencePage: finding?.pages?.length ? [...new Set(finding.pages)].sort((a, b) => a - b).join("、") : "—",
      evidence: finding?.evidence?.filter(Boolean).join("；") || "全文件未发现足够证据",
    };
  });

  return json({
    rows,
    model,
    baseURL,
    standardVersion: "v1.0-rc2",
    effectiveness: "AI 初审结果，未经业务确认，待业务人员精准复核",
    renderedPages: pages.length,
  });
}
