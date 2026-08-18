/** 审核状态。2026-08-15 起"未识别到"视为"缺失"（用户确认全链路改）；2026-08-15 起"不适用"状态去除（旧数据读取时归一化为"缺失"）；"未识别到"/"不适用"保留类型值仅用于兼容旧数据读取，不再产生 */
export type AiReviewStatus = "明确找到" | "缺失" | "疑似对应" | "不适用" | "未识别到";

export type StoredReviewRow = {
  id: string;
  category: string;
  name: string;
  aiStatus: AiReviewStatus;
  evidencePage: string;
  evidence: string;
  internDecision?: string;
  internNote?: string;
  /** 业务负责人复核草稿（角色：魏浩 / 研发部 / 业务负责人） */
  businessDecision?: string;
  businessNote?: string;
  businessDecisionAt?: string;
};

export type ReviewVersion = {
  version: number;
  createdAt: string;
  reviewerRole: "实习生初步复核" | "业务负责人复核";
  rows: StoredReviewRow[];
};

/** 第二层单项设计合规审核：单个“审核对象 × 审核维度”的草稿记录 */
export type DesignReview = {
  /** 第一层标准项 ID（审核对象） */
  targetId: string;
  /** 第二层审核维度 ID，如 D-FONT-01 */
  ruleId: string;
  /** 2026-08-15 起去除"不适用"决策项（新录入不再提供）；保留类型值仅用于兼容旧数据读取，读取时归一化为"待评估" */
  decision: "待评估" | "符合候选规则" | "不符合候选规则" | "证据不足" | "不适用";
  note: string;
  /** 仅记录证据文件名；证据图片当前保存在本地，正式版本需服务器存储 */
  evidenceFileName?: string;
  updatedAt?: string;
  reviewerRole?: string;
};

/** 第二层草稿版本快照。2026-08-16 起不再产生（草稿只保留最新一版，同"对象×规则"直接覆盖）；类型保留仅用于兼容旧数据读取 */
export type DesignVersion = {
  version: number;
  createdAt: string;
  reviewerRole: string;
  snapshot: DesignReview[];
};

export type LocalTask = {
  id: string;
  projectName: string;
  stage: string;
  scope: string[];
  standardVersion: string;
  fileName: string;
  fileSize: number;
  fileType: string;
  fileBlob: Blob;
  status: "待解析" | "解析中" | "需要模型配置" | "解析失败" | "已出结果";
  createdAt: string;
  csvName?: string;
  csvText?: string;
  csvRowCount?: number;
  reviewRows?: StoredReviewRow[];
  reviewVersions?: ReviewVersion[];
  /** 第二层：当前审核对象 ID */
  designTargetId?: string;
  /** 第二层：对象 × 维度的最新草稿（无历史） */
  designReviews?: DesignReview[];
  /** 第二层：保存历史版本快照（v1、v2……不可覆盖） */
  designVersions?: DesignVersion[];
  parsingAttempts?: number;
  lastAttemptAt?: string;
  lastErrorCode?: string;
  lastErrorMessage?: string;
  aiModel?: string;
  aiCompletedAt?: string;
};

const DB_NAME = "residential-signage-mvp", STORE = "tasks";

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(STORE)) request.result.createObjectStore(STORE, { keyPath: "id" });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function saveTask(task: LocalTask) {
  const db = await openDb();
  return new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).put(task);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function listTasks(): Promise<LocalTask[]> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const request = db.transaction(STORE, "readonly").objectStore(STORE).getAll();
    request.onsuccess = () => resolve((request.result as LocalTask[]).sort((a, b) => b.createdAt.localeCompare(a.createdAt)));
    request.onerror = () => reject(request.error);
  });
}

export async function getTask(id: string): Promise<LocalTask | undefined> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const request = db.transaction(STORE, "readonly").objectStore(STORE).get(id);
    request.onsuccess = () => resolve(request.result as LocalTask | undefined);
    request.onerror = () => reject(request.error);
  });
}

export async function deleteTask(id: string): Promise<void> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).delete(id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export function countCsvRows(text: string) {
  return Math.max(0, text.replace(/^\uFEFF/, "").split(/\r?\n/).filter((line) => line.trim()).length - 1);
}
