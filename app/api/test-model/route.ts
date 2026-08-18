/**
 * 模型连通性测试端点（POST /api/test-model）：
 * 接收浏览器端模型配置（x-api-key / x-api-base / x-api-model 三个请求头），
 * 发一次极简 chat/completions（max_tokens=1），验证密钥、Base URL、模型三者是否可达。
 * 不做 PDF 渲染、不消耗明显 token，仅用于一键验证连通性。
 */
export const runtime = "nodejs";

type JsonResponse = { ok: boolean; model?: string; baseURL?: string; status?: number; latencyMs?: number; response?: string; error?: string };

function json(data: JsonResponse, status = 200) {
  return Response.json(data, { status, headers: { "Cache-Control": "no-store" } });
}

export async function POST(request: Request): Promise<Response> {
  const startedAt = Date.now();
  const apiKey = request.headers.get("x-api-key")?.trim();
  const baseURL = request.headers.get("x-api-base")?.trim().replace(/\/+$/, "") || "https://api.moonshot.cn/v1";
  const modelName = request.headers.get("x-api-model")?.trim();
  if (!apiKey) return json({ ok: false, error: "未提供 API 密钥。" }, 401);
  if (apiKey.length < 16) return json({ ok: false, error: "密钥格式不正确：长度应不少于 16 位。" }, 401);
  if (!modelName) return json({ ok: false, error: "未提供模型名称。" }, 400);

  const url = baseURL.endsWith("/chat/completions") ? baseURL : (/\/v\d+$/.test(baseURL) ? `${baseURL}/chat/completions` : `${baseURL}/v1/chat/completions`);

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: modelName,
        messages: [{ role: "user", content: "hi" }],
        max_tokens: 1,
      }),
    });
    const latencyMs = Date.now() - startedAt;
    const data = await response.json().catch(() => ({})) as Record<string, unknown>;
    if (!response.ok) {
      const err = data.error as { message?: string; code?: string } | undefined;
      return json({ ok: false, model: modelName, baseURL, status: response.status, latencyMs, error: err?.message || `HTTP ${response.status}` }, 200);
    }
    return json({ ok: true, model: modelName, baseURL, status: response.status, latencyMs, response: "连通正常，已收到模型响应。" }, 200);
  } catch (e) {
    const latencyMs = Date.now() - startedAt;
    const message = e instanceof Error ? e.message : "未知错误";
    return json({ ok: false, model: modelName, baseURL, latencyMs, error: `网络请求失败：${message}` }, 200);
  }
}
