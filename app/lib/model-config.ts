/**
 * 模型配置（OpenAI 兼容视觉模型）的浏览器 localStorage 封装。
 * 结构：{ baseURL, apiKey, modelName }，支持任意 OpenAI 兼容接口的视觉模型服务
 * （Kimi / 通义千问 / 智谱 GLM / OpenAI / 豆包 / 硅基流动 / 自定义等）。
 * 所有读写都做 try/catch：localStorage 被禁用（隐私模式等）时优雅降级。
 */

export type ModelConfig = {
  /** 服务商 API 根地址，如 https://api.moonshot.cn/v1（服务端会自动补 /chat/completions） */
  baseURL: string;
  /** API 密钥（各家前缀不同：sk- / id.secret / UUID 等） */
  apiKey: string;
  /** 模型名，如 kimi-k2.6 / qwen-vl-max / gpt-4o */
  modelName: string;
};

export const MODEL_CONFIG_KEY = "modelConfig";
/** 兼容旧版纯密钥存储（kimi.apiKey）的读取 key */
const LEGACY_KEY = "kimi.apiKey";

/** Base URL 缺省：只填密钥+模型名时默认 Kimi */
export const DEFAULT_BASE_URL = "https://api.moonshot.cn/v1";
export const DEFAULT_MODEL = "kimi-k2.6";

/** 预置服务商：下拉选中自动填 baseURL + 默认模型名（用户可改） */
export const PRESET_PROVIDERS = [
  { id: "kimi", label: "Kimi（月之暗面）", baseURL: "https://api.moonshot.cn/v1", model: "kimi-k2.6" },
  { id: "qwen", label: "通义千问（阿里云）", baseURL: "https://dashscope.aliyuncs.com/compatible-mode/v1", model: "qwen-vl-max" },
  { id: "zhipu", label: "智谱 GLM", baseURL: "https://open.bigmodel.cn/api/paas/v4", model: "glm-4v-plus" },
  { id: "openai", label: "OpenAI", baseURL: "https://api.openai.com/v1", model: "gpt-4o" },
  { id: "doubao", label: "豆包（火山方舟）", baseURL: "https://ark.cn-beijing.volces.com/api/v3", model: "doubao-1.5-vision-pro" },
  { id: "siliconflow", label: "硅基流动", baseURL: "https://api.siliconflow.cn/v1", model: "Qwen/Qwen2.5-VL-72B-Instruct" },
] as const;

export type ProviderId = (typeof PRESET_PROVIDERS)[number]["id"] | "custom";

/** 根据 baseURL 反查预置服务商 id（按 host 匹配；匹配不上返回 "custom"） */
export function providerIdForBaseURL(baseURL: string): ProviderId {
  const trimmed = baseURL.trim();
  try {
    const host = new URL(trimmed).host;
    const match = PRESET_PROVIDERS.find((p) => new URL(p.baseURL).host === host);
    return match?.id ?? "custom";
  } catch {
    return "custom";
  }
}

/** 读取当前配置；无则读旧版 kimi.apiKey（纯字符串）懒迁移为 Kimi 默认配置 */
export function getModelConfig(): ModelConfig | null {
  try {
    const raw = window.localStorage.getItem(MODEL_CONFIG_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<ModelConfig>;
      if (parsed.baseURL && parsed.apiKey && parsed.modelName) {
        return { baseURL: parsed.baseURL, apiKey: parsed.apiKey, modelName: parsed.modelName };
      }
    }
    // 旧版纯字符串密钥迁移（不删旧值，双读兼容）
    const legacy = window.localStorage.getItem(LEGACY_KEY)?.trim();
    if (legacy) {
      const migrated: ModelConfig = { baseURL: DEFAULT_BASE_URL, apiKey: legacy, modelName: DEFAULT_MODEL };
      try { window.localStorage.setItem(MODEL_CONFIG_KEY, JSON.stringify(migrated)); } catch { /* 忽略 */ }
      return migrated;
    }
    return null;
  } catch {
    return null;
  }
}

/** 保存配置（存储不可用时抛出，由调用方提示用户） */
export function setModelConfig(config: ModelConfig): void {
  try {
    window.localStorage.setItem(MODEL_CONFIG_KEY, JSON.stringify(config));
  } catch {
    throw new Error("无法写入浏览器存储，请检查隐私模式或存储权限。");
  }
}

/** 清除配置 */
export function clearModelConfig(): void {
  try {
    window.localStorage.removeItem(MODEL_CONFIG_KEY);
  } catch {
    // 清除失败无需提示：getModelConfig 会兜底返回 null
  }
}

/** 展示用脱敏：sk- 前缀 → sk-****尾4；其他 → ****尾4 */
export function maskApiKey(key: string): string {
  const trimmed = key.trim();
  if (trimmed.length < 8) return trimmed.startsWith("sk-") ? "sk-****" : "****";
  const tail = trimmed.slice(-4);
  return trimmed.startsWith("sk-") ? `sk-****${tail}` : `****${tail}`;
}

/** 简单格式校验：长度 >= 16（兼容 sk- 前缀、智谱 id.secret、豆包 UUID 等各家格式） */
export function isValidKey(key: string): boolean {
  return key.trim().length >= 16;
}

/** Base URL 必须 http(s) 开头 */
export function isValidBaseURL(url: string): boolean {
  return /^https?:\/\/.+/i.test(url.trim());
}

/** 混元生图配置（tokenhub.tencentmaas.com，参考生图 hy-image-v3） */
export type HunyuanConfig = {
  apiKey: string;
  baseURL: string;
  model: string;
};

export const HUNYUAN_CONFIG_KEY = "hunyuanConfig";
export const HUNYUAN_DEFAULT_URL = "https://tokenhub.tencentmaas.com/v1/wand/hunyuan-image/v3-generation";
export const HUNYUAN_DEFAULT_MODEL = "hy-image-v3";

export function getHunyuanConfig(): HunyuanConfig | null {
  try {
    const raw = window.localStorage.getItem(HUNYUAN_CONFIG_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<HunyuanConfig>;
      if (parsed.apiKey) return { apiKey: parsed.apiKey, baseURL: parsed.baseURL || HUNYUAN_DEFAULT_URL, model: parsed.model || HUNYUAN_DEFAULT_MODEL };
    }
    return null;
  } catch {
    return null;
  }
}

export function setHunyuanConfig(config: HunyuanConfig): void {
  try {
    window.localStorage.setItem(HUNYUAN_CONFIG_KEY, JSON.stringify(config));
  } catch {
    throw new Error("无法写入浏览器存储，请检查隐私模式或存储权限。");
  }
}

export function clearHunyuanConfig(): void {
  try {
    window.localStorage.removeItem(HUNYUAN_CONFIG_KEY);
  } catch {
    // 忽略
  }
}
