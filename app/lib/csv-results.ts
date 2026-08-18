import type { AiReviewStatus, StoredReviewRow } from "./local-db";

function parseCsvMatrix(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  const source = text.replace(/^\uFEFF/, "");

  for (let index = 0; index < source.length; index += 1) {
    const char = source[index];
    if (char === '"') {
      if (quoted && source[index + 1] === '"') { cell += '"'; index += 1; }
      else quoted = !quoted;
    } else if (char === "," && !quoted) {
      row.push(cell.trim()); cell = "";
    } else if ((char === "\n" || char === "\r") && !quoted) {
      if (char === "\r" && source[index + 1] === "\n") index += 1;
      row.push(cell.trim()); cell = "";
      if (row.some(Boolean)) rows.push(row);
      row = [];
    } else cell += char;
  }
  row.push(cell.trim());
  if (row.some(Boolean)) rows.push(row);
  return rows;
}

const allowedStatuses: AiReviewStatus[] = ["明确找到", "缺失", "疑似对应", "不适用", "未识别到"];

export function parseReviewCsv(text: string): StoredReviewRow[] {
  const matrix = parseCsvMatrix(text);
  if (matrix.length < 2) return [];
  const headers = matrix[0].map((header) => header.replace(/\s/g, ""));
  const findIndex = (...names: string[]) => {
    for (const name of names) {
      const index = headers.indexOf(name);
      if (index >= 0) return index;
    }
    return -1;
  };
  const indexes = {
    id: findIndex("标准项ID", "标准ID", "ID"),
    category: findIndex("二级分类", "分类", "一级分类"),
    name: findIndex("标准名称", "标识名称", "名称"),
    status: findIndex("AI状态", "AI第二次结果", "AI结果", "当前状态"),
    page: findIndex("证据页码", "页码", "证据页"),
    evidence: findIndex("PDF原始名称/依据", "AI判断依据", "判断说明", "依据"),
    internDecision: findIndex("实习生初步判断"),
    internNote: findIndex("初步复核依据", "复核备注"),
  };
  if (indexes.id < 0 || indexes.name < 0 || indexes.status < 0) return [];

  return matrix.slice(1).map((values) => {
    const rawStatus = values[indexes.status]?.trim() as AiReviewStatus;
    return {
      id: values[indexes.id]?.trim() || "未编号",
      category: indexes.category >= 0 ? values[indexes.category]?.trim() || "未分类" : "未分类",
      name: values[indexes.name]?.trim() || "未命名标准项",
      // 旧 CSV 中的"未识别到"归一化为"缺失"；"不适用"一并归一化为"缺失"（2026-08-15 规则变更：未识别到视为缺失、去除不适用状态）
      aiStatus: allowedStatuses.includes(rawStatus) ? (rawStatus === "未识别到" || rawStatus === "不适用" ? "缺失" : rawStatus) : "缺失",
      evidencePage: indexes.page >= 0 ? values[indexes.page]?.trim().replace(/^P/i, "") || "—" : "—",
      evidence: indexes.evidence >= 0 ? values[indexes.evidence]?.trim() || "CSV 未提供判断依据" : "CSV 未提供判断依据",
      internDecision: indexes.internDecision >= 0 ? values[indexes.internDecision]?.trim() || undefined : undefined,
      internNote: indexes.internNote >= 0 ? values[indexes.internNote]?.trim() || undefined : undefined,
    };
  }).filter((row) => row.id !== "未编号" || row.name !== "未命名标准项");
}
