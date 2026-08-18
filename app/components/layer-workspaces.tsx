"use client";

/* eslint-disable @next/next/no-img-element -- local blob previews are not compatible with optimized remote image loading */

import { useMemo, useState } from "react";
import type { DesignReview, LocalTask } from "../lib/local-db";
import { StatusPill } from "./ui/Pill";
import { getModelConfig, getHunyuanConfig, setHunyuanConfig } from "../lib/model-config";
import { designFontTypes, type FontType, type SubRule } from "../lib/design-font-mapping";
import { designTrades, viCommonRules, viTradeRules, type ViRule, type TradeType } from "../lib/design-trade-mapping";

/** 2.5 颜色规则（2026-08-16 魏浩定：去掉 D-COLOR-02，仅保留 D-COLOR-01；对象 = 所有第一层"明确找到"的标识，无映射表） */
const colorFontType: FontType = {
  id: "FT-COLOR",
  name: "颜色",
  source: "2.5 标识颜色设计标准",
  firstLayerIds: [], // 不用于筛选（对象 = 所有"明确找到"）
  subRules: [{ id: "D-COLOR-01", level: "颜色对比", rule: "字体颜色应与背景颜色区分" }],
};

/** 2.6 底板三条规则（2026-08-16 魏浩定：一次 AI 判完三条，对象 = 所有第一层"明确找到"的标识） */
const baseRuleId = "D-BASE-GROUP";
const baseRules = [
  { id: "D-BASE-01", name: "底板材料", rule: "可采用金属、岩板、石材等底板（是：哪种 / 否：其他材料）" },
  { id: "D-BASE-03", name: "底板颜色与字体区分", rule: "底板颜色应与字体颜色区分开（是 / 否）" },
  { id: "D-BASE-04", name: "铝板三维一体雕刻", rule: "是否采用 20/15mm 铝板三维一体雕刻（是 / 否）" },
] as const;

/** 第二层规则总数：2.3 字体 + 2.5 颜色 + 2.4 通用/专业 + 2.6 底板 */
const totalRuleCount =
  designFontTypes.reduce((n, ft) => n + ft.subRules.length, 0) +
  colorFontType.subRules.length +
  viCommonRules.length +
  Object.values(viTradeRules).reduce((n, arr) => n + arr.length, 0) +
  baseRules.length;

/** 未导入第一层结果时使用的内置演示对象（与第一层演示数据保持一致口径） */
const fallbackTargets = [
  { id: "SIGN-GATE-002", category: "社区大门", name: "景墙案名", aiStatus: "明确找到", evidencePage: "2", evidence: "入口矮墙 LOGO 牌" },
  { id: "SIGN-PARK-003", category: "园区部品", name: "楼栋单元指引", aiStatus: "明确找到", evidencePage: "3", evidence: "指引立牌" },
  { id: "SIGN-UNIT-002", category: "单元门头", name: "单元号", aiStatus: "明确找到", evidencePage: "17–18", evidence: "车库单元号、首层单元号" },
  { id: "SIGN-CAR-003", category: "地库出入口", name: "龙门标识", aiStatus: "明确找到", evidencePage: "7–13", evidence: "车库入口门头" },
] as const;

type Target = { id: string; category: string; name: string; aiStatus: string; evidencePage: string; evidence: string };

const statusRank: Record<string, number> = { "明确找到": 0, "疑似对应": 1, "未识别到": 2 };

/** 解析证据页字符串（"4、5、6" / "17–18" / "7–13" / "—"）为页码数组 */
function parseEvidencePages(evidencePage: string): number[] {
  if (!evidencePage || evidencePage === "—") return [];
  return evidencePage
    .split(/[、，,–—\s]+/)
    .map((s) => Number(s.trim()))
    .filter((n) => Number.isFinite(n) && n > 0);
}

type ResolvedRule =
  | { kind: "font"; fontType: FontType; subRule: SubRule }
  | { kind: "vi"; rule: ViRule; scopeName: string; targetIds: string[] }
  | { kind: "base" };

function allTradeIds(): string[] {
  return designTrades.flatMap((t) => t.firstLayerIds);
}

function resolveRule(ruleId: string): ResolvedRule | null {
  for (const ft of designFontTypes) {
    const sub = ft.subRules.find((s) => s.id === ruleId);
    if (sub) return { kind: "font", fontType: ft, subRule: sub };
  }
  const colorSub = colorFontType.subRules.find((s) => s.id === ruleId);
  if (colorSub) return { kind: "font", fontType: colorFontType, subRule: colorSub };
  const viCommon = viCommonRules.find((r) => r.id === ruleId);
  if (viCommon) return { kind: "vi", rule: viCommon, scopeName: "三专业", targetIds: allTradeIds() };
  for (const trade of designTrades) {
    const vi = viTradeRules[trade.id]?.find((r) => r.id === ruleId);
    if (vi) return { kind: "vi", rule: vi, scopeName: trade.name, targetIds: trade.firstLayerIds };
  }
  if (ruleId === baseRuleId) return { kind: "base" };
  return null;
}

export function DesignComplianceWorkspace({
  task,
  onTaskUpdate,
}: {
  task: LocalTask | null;
  onTaskUpdate: (next: LocalTask) => Promise<void>;
}) {
  /** 审核对象：优先使用第一层已识别结果，否则使用演示对象；按状态排序（明确找到优先） */
  const targets = useMemo<Target[]>(() => {
    const source = task?.reviewRows?.length ? task.reviewRows : fallbackTargets;
    return [...source].sort((a, b) => (statusRank[a.aiStatus] ?? 9) - (statusRank[b.aiStatus] ?? 9));
  }, [task]);

  const [selectedRuleId, setSelectedRuleId] = useState<string>(designFontTypes[0].subRules[0].id);

  const resolved = resolveRule(selectedRuleId);

  const savedCount = task?.designReviews?.length ?? 0;

  /** 某字体类型下第一层“明确找到”的对象（2.5 颜色维度 FT-COLOR 例外：对象 = 所有“明确找到”） */
  function fontTypeTargets(fontType: FontType): Target[] {
    if (!task?.reviewRows?.length) return [];
    if (fontType.id === "FT-COLOR") return targets.filter((t) => t.aiStatus === "明确找到");
    return targets.filter((t) => fontType.firstLayerIds.includes(t.id) && t.aiStatus === "明确找到");
  }

  /** 某专业（2.4 三专业）下第一层“明确找到”的对象 */
  function tradeTargets(trade: TradeType): Target[] {
    if (!task?.reviewRows?.length) return [];
    return targets.filter((t) => trade.firstLayerIds.includes(t.id) && t.aiStatus === "明确找到");
  }

  function hasDraft(ruleId: string) {
    return !!task?.designReviews?.some((item) => item.ruleId === ruleId);
  }

  /** 2.6 底板判定对象 = 所有第一层“明确找到”的标识 */
  function baseTargets(): Target[] {
    if (!task?.reviewRows?.length) return [];
    return targets.filter((t) => t.aiStatus === "明确找到");
  }

  /** 批量保存“对象 × 规则”草稿。仅保留最新一版：同“对象 × 规则”直接覆盖，不生成历史版本快照。ruleId 可逐条指定（2.6 底板一次判三条拆分存储用）。 */
  async function saveReviews(records: Array<{ targetId: string; ruleId?: string; decision: DesignReview["decision"]; note: string }>) {
    if (!task || !resolved) return;
    const defaultRuleId = resolved.kind === "font" ? resolved.subRule.id : resolved.kind === "vi" ? resolved.rule.id : baseRuleId;
    const nextReviews = [...(task.designReviews ?? [])];
    for (const rec of records) {
      const ruleId = rec.ruleId ?? defaultRuleId;
      const record: DesignReview = {
        targetId: rec.targetId,
        ruleId,
        decision: rec.decision,
        note: rec.note,
        updatedAt: new Date().toISOString(),
        reviewerRole: "AI 初审",
      };
      const idx = nextReviews.findIndex((r) => r.targetId === rec.targetId && r.ruleId === ruleId);
      if (idx >= 0) nextReviews[idx] = record;
      else nextReviews.push(record);
    }
    await onTaskUpdate({ ...task, designReviews: nextReviews });
  }

  return <div className="layer-workspace">
    <div className="layer-hero"><div><h1>单项设计合规审核</h1><p>选左侧规则 → 点「AI 判定」→ 查看逐标识结果 → 保存草稿。判定遵循“与标准不一致即不符合；无证据判证据不足”。</p></div><span className="layer-state amber-state">{totalRuleCount} 条 · 候选规则</span></div>

    {!task?.reviewRows?.length && <section className="target-panel"><div className="target-meta"><strong>当前任务未导入第一层审核结果</strong><span>正在使用内置演示对象；请先在“标识种类完整性审核”中完成 AI 识别，再回来判定设计合规。</span></div></section>}

    <div className="simple-summary"><span><b>{targets.length}</b> 明确找到</span><span><b>{totalRuleCount}</b> 条规则</span><span><b>{savedCount}</b> 已录入结论</span><small>保存草稿不会覆盖第一层结果，也不会自动升级为正式标准结论。</small></div>

    <div className="compliance-layout">
      <section className="rule-list-card">
        <header><div><strong>审核规则</strong><small>按字体类型 / 维度选择一项查看要求与录入证据</small></div><span>{totalRuleCount} 条</span></header>

        <div className="rule-group">
          <div className="rule-section-title">2.3 标识字体（4 类字体类型）</div>
          {designFontTypes.map((ft) => {
            const count = fontTypeTargets(ft).length;
            return <div key={ft.id} className="font-type-block">
              <div className="font-type-head"><strong>{ft.name}</strong><em className={count ? "found" : "empty"}>{ft.firstLayerIds.length ? `${count} 对象可审` : "映射待补充"}</em></div>
              {ft.subRules.map((sub) => <button key={sub.id} className={selectedRuleId === sub.id ? "active" : ""} aria-pressed={selectedRuleId === sub.id} onClick={() => setSelectedRuleId(sub.id)}><span><strong>{sub.level}</strong><small>{sub.id} · {ft.source}</small></span><em className={hasDraft(sub.id) ? "saved" : ""}>{hasDraft(sub.id) ? "已存草稿" : "候选"}</em></button>)}
            </div>;
          })}
        </div>

        <div className="rule-group">
          <div className="rule-section-title">2.4 标识 logo 排版（三专业）</div>
          <div className="rule-group-subtitle">通用规则（三专业都适用）</div>
          {viCommonRules.map((r) => <button key={r.id} className={selectedRuleId === r.id ? "active" : ""} aria-pressed={selectedRuleId === r.id} onClick={() => setSelectedRuleId(r.id)}><span><strong>{r.name}</strong><small>{r.id} · 2.4 标识logo排版设计标准</small></span><em className={hasDraft(r.id) ? "saved" : ""}>{hasDraft(r.id) ? "已存草稿" : "候选"}</em></button>)}
          {designTrades.map((trade) => {
            const rules = viTradeRules[trade.id] ?? [];
            const count = tradeTargets(trade).length;
            return <div key={trade.id} className="font-type-block">
              <div className="font-type-head"><strong>{trade.name}</strong><em className={count ? "found" : "empty"}>{`${count} 对象可审`}</em></div>
              {rules.length === 0 && <div className="trade-no-rule">无专属排版规则（仅适用通用规则）</div>}
              {rules.map((r) => <button key={r.id} className={selectedRuleId === r.id ? "active" : ""} aria-pressed={selectedRuleId === r.id} onClick={() => setSelectedRuleId(r.id)}><span><strong>{r.name}</strong><small>{r.id} · 2.4 标识logo排版设计标准</small></span><em className={hasDraft(r.id) ? "saved" : ""}>{hasDraft(r.id) ? "已存草稿" : "候选"}</em></button>)}
            </div>;
          })}
        </div>

        <div className="rule-group">
          <div className="rule-section-title">2.5 标识颜色</div>
          <div className="font-type-block">
            <div className="font-type-head"><strong>{colorFontType.name}</strong><em className={fontTypeTargets(colorFontType).length ? "found" : "empty"}>{`${fontTypeTargets(colorFontType).length} 对象可审`}</em></div>
            {colorFontType.subRules.map((sub) => <button key={sub.id} className={selectedRuleId === sub.id ? "active" : ""} aria-pressed={selectedRuleId === sub.id} onClick={() => setSelectedRuleId(sub.id)}><span><strong>{sub.level}</strong><small>{sub.id} · {colorFontType.source}</small></span><em className={hasDraft(sub.id) ? "saved" : ""}>{hasDraft(sub.id) ? "已存草稿" : "候选"}</em></button>)}
          </div>
        </div>

        <div className="rule-group">
          <div className="rule-section-title">2.6 标识底板</div>
          <div className="font-type-block">
            <div className="font-type-head"><strong>底板三条规则</strong><em className={baseTargets().length ? "found" : "empty"}>{`${baseTargets().length} 对象可审`}</em></div>
            {baseRules.map((r) => <div key={r.id} className="base-rule-desc"><small>{r.id}</small>{r.name}：{r.rule}</div>)}
            <button className={selectedRuleId === baseRuleId ? "active" : ""} aria-pressed={selectedRuleId === baseRuleId} onClick={() => setSelectedRuleId(baseRuleId)}><span><strong>AI 判定底板（一次判三条）</strong><small>{baseRuleId} · 2.6 标识底板设计标准</small></span><em className={baseRules.some((b) => hasDraft(b.id)) ? "saved" : ""}>{baseRules.some((b) => hasDraft(b.id)) ? "已存草稿" : "候选"}</em></button>
          </div>
        </div>
      </section>

      {resolved?.kind === "font"
        ? <DesignFontForm key={resolved.subRule.id} fontType={resolved.fontType} subRule={resolved.subRule} targets={fontTypeTargets(resolved.fontType)} task={task} onSave={saveReviews} />
        : resolved?.kind === "base"
          ? <DesignBaseForm targets={baseTargets()} task={task} onSave={saveReviews} />
          : resolved?.kind === "vi"
            ? <DesignFontForm key={resolved.rule.id} fontType={{ id: "VI", name: resolved.scopeName, source: "2.4 标识logo排版设计标准", firstLayerIds: [], subRules: [] }} subRule={{ id: resolved.rule.id, level: resolved.rule.name, rule: resolved.rule.rule }} targets={targets.filter((t) => resolved.targetIds.includes(t.id) && t.aiStatus === "明确找到")} task={task} onSave={saveReviews} />
            : null}
    </div>
  </div>;
}

/** AI 判定结果行 */
type AiJudgmentRow = { targetId: string; name: string; decision: DesignReview["decision"]; rationale: string; confidence: number };

/** 第二层字体规则表单：字体类型 + 标题层级 + 对象列表 + AI 判定 + 保存 */
function DesignFontForm({ fontType, subRule, targets, task, onSave }: {
  fontType: FontType;
  subRule: SubRule;
  targets: Target[];
  task: LocalTask | null;
  onSave: (records: Array<{ targetId: string; ruleId?: string; decision: DesignReview["decision"]; note: string }>) => Promise<void>;
}) {
  const [judging, setJudging] = useState(false);
  const [aiRows, setAiRows] = useState<AiJudgmentRow[]>([]);
  const [aiError, setAiError] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  /** 本规则已保存的草稿（逐对象），回显供查看 */
  const savedDrafts = task?.designReviews?.filter((r) => r.ruleId === subRule.id) ?? [];

  async function runAi() {
    if (!task?.fileBlob) { setAiError("当前项目没有可用的 PDF 文件，无法渲染证据页进行 AI 判定。"); return; }
    const modelConfig = getModelConfig();
    if (!modelConfig) { setAiError("请先在首页设置模型配置，再使用 AI 判定。"); return; }
    if (!targets.length) { setAiError("本规则下暂无第一层“明确找到”的对象，无法判定。"); return; }

    setJudging(true);
    setAiError("");
    setAiRows([]);
    setSaved(false);
    try {
      // 1. 渲染每个对象证据页（每对象最多取前 3 页，避免请求体过大）
      const pageNums: number[] = [];
      for (const t of targets) pageNums.push(...parseEvidencePages(t.evidencePage).slice(0, 3));
      if (!pageNums.length) { setAiError("这些对象均无有效证据页，无法渲染。"); return; }
      const { renderPdfPagesByNumbers } = await import("../lib/pdf-render-browser");
      const rendered = await renderPdfPagesByNumbers(task.fileBlob, pageNums);
      const byPage = new Map(rendered.filter((p) => p.base64).map((p) => [p.pageNumber, p.base64]));

      const targetsInput = targets.map((t) => ({
        id: t.id,
        name: t.name,
        pages: parseEvidencePages(t.evidencePage).slice(0, 3).map((n) => ({ pageNumber: n, base64: byPage.get(n) ?? "" })).filter((p) => p.base64),
      })).filter((t) => t.pages.length > 0);

      if (!targetsInput.length) { setAiError("证据页渲染失败，无法判定。"); return; }

      // 2. 调 /api/analyze-design
      const resp = await fetch("/api/analyze-design", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-api-key": modelConfig.apiKey, "x-api-base": modelConfig.baseURL, "x-api-model": modelConfig.modelName },
        body: JSON.stringify({ fontType: fontType.name, level: subRule.level, ruleText: subRule.rule, source: fontType.source, targets: targetsInput }),
      });
      const data = await resp.json() as { rows?: AiJudgmentRow[]; message?: string; code?: string };
      if (!resp.ok) { setAiError(data.message || `AI 判定失败（${data.code || resp.status}）`); return; }
      setAiRows(data.rows ?? []);
    } catch (e) {
      setAiError(`AI 判定异常：${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setJudging(false);
    }
  }

  async function saveAi() {
    if (!aiRows.length) return;
    setSaving(true);
    try {
      await onSave(aiRows.map((r) => ({ targetId: r.targetId, decision: r.decision, note: `AI 初审：${r.rationale}` })));
      setSaved(true);
    } finally {
      setSaving(false);
    }
  }

  return <section className="rule-detail-card">
    <header><span>{subRule.id} · {fontType.name}</span><h2>{subRule.level}</h2><p>{subRule.rule}（来源：{fontType.source}）</p></header>

    <div className="font-objects">
      <strong>{targets.length ? `本规则适用的标识对象（${targets.length} 个）` : "本规则暂无适用对象"}</strong>
      {targets.length ? <ul>{targets.map((t) => <li key={t.id}>{t.name} <small>{t.id} · P{t.evidencePage}</small></li>)}</ul> : <p>本规则暂未关联第一层标识（映射待业务确认补充），或第一层未明确找到对应标识——本规则不参与判定。</p>}
    </div>

    <div className="decision-form">
      {savedDrafts.length > 0 && <div className="saved-drafts">
        <strong>已存草稿（{savedDrafts.length} 条）</strong>
        {savedDrafts.map((d) => { const t = targets.find((x) => x.id === d.targetId); return <div key={d.targetId} className="ai-result"><div className="ai-result-head"><strong>{t?.name ?? d.targetId}</strong><StatusPill status={d.decision} />{d.updatedAt && <em>{new Date(d.updatedAt).toLocaleString("zh-CN", { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" })}</em>}</div>{d.note && <small>{d.note}</small>}</div>; })}
      </div>}
      <button className="save" disabled={judging || !targets.length} onClick={runAi}>{judging ? "AI 判定中…" : `AI 判定本规则（${targets.length} 对象）`}</button>
      {aiError && <p className="ai-error">{aiError}</p>}

      {aiRows.length > 0 && <>
        <div className="ai-results">
          {aiRows.map((r) => <div key={r.targetId} className="ai-result"><div className="ai-result-head"><strong>{r.name}</strong><StatusPill status={r.decision} /><em>{Math.round((r.confidence ?? 0) * 100)}%</em></div><small>{r.rationale}</small></div>)}
        </div>
        <button className="save" disabled={saving} onClick={saveAi}>{saving ? "正在保存…" : saved ? "已保存 AI 判定为草稿" : "保存 AI 判定为草稿"}</button>
      </>}
      <small className="effect-note">AI 判定为初审草稿；无尺寸标注时判“证据不足”，不臆测。保存后覆盖该对象最新一版草稿。</small>
    </div>
  </section>;
}

/** 2.6 底板 AI 判定结果行 */
type BaseJudgmentRow = { targetId: string; name: string; material: string; colorDistinct: string; aluCarve: string; rationale: string; confidence: number };

/** 底板材料判定 → decision：金属/岩板/石材 = 符合，其他 = 不符合，其余 = 证据不足 */
function baseMaterialDecision(material: string): DesignReview["decision"] {
  if (["金属", "岩板", "石材"].includes(material)) return "符合候选规则";
  if (material === "其他") return "不符合候选规则";
  return "证据不足";
}

/** 是/否判定 → decision：是 = 符合，否 = 不符合，其余 = 证据不足 */
function baseYesNoDecision(value: string): DesignReview["decision"] {
  if (value === "是") return "符合候选规则";
  if (value === "否") return "不符合候选规则";
  return "证据不足";
}

/** 第二层 2.6 底板表单：三条规则一次 AI 判定（对象 = 所有第一层"明确找到"的标识） */
function DesignBaseForm({ targets, task, onSave }: {
  targets: Target[];
  task: LocalTask | null;
  onSave: (records: Array<{ targetId: string; ruleId?: string; decision: DesignReview["decision"]; note: string }>) => Promise<void>;
}) {
  const [judging, setJudging] = useState(false);
  const [aiRows, setAiRows] = useState<BaseJudgmentRow[]>([]);
  const [aiError, setAiError] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const savedDrafts = task?.designReviews?.filter((r) => baseRules.some((b) => b.id === r.ruleId)) ?? [];

  async function runAi() {
    if (!task?.fileBlob) { setAiError("当前项目没有可用的 PDF 文件，无法渲染证据页进行 AI 判定。"); return; }
    const modelConfig = getModelConfig();
    if (!modelConfig) { setAiError("请先在首页设置模型配置，再使用 AI 判定。"); return; }
    if (!targets.length) { setAiError("第一层暂无“明确找到”的标识，无法判定。"); return; }

    setJudging(true);
    setAiError("");
    setAiRows([]);
    setSaved(false);
    try {
      const pageNums: number[] = [];
      for (const t of targets) pageNums.push(...parseEvidencePages(t.evidencePage).slice(0, 3));
      if (!pageNums.length) { setAiError("这些对象均无有效证据页，无法渲染。"); return; }
      const { renderPdfPagesByNumbers } = await import("../lib/pdf-render-browser");
      const rendered = await renderPdfPagesByNumbers(task.fileBlob, pageNums);
      const byPage = new Map(rendered.filter((p) => p.base64).map((p) => [p.pageNumber, p.base64]));

      const targetsInput = targets.map((t) => ({
        id: t.id,
        name: t.name,
        pages: parseEvidencePages(t.evidencePage).slice(0, 3).map((n) => ({ pageNumber: n, base64: byPage.get(n) ?? "" })).filter((p) => p.base64),
      })).filter((t) => t.pages.length > 0);

      if (!targetsInput.length) { setAiError("证据页渲染失败，无法判定。"); return; }

      const resp = await fetch("/api/analyze-base", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-api-key": modelConfig.apiKey, "x-api-base": modelConfig.baseURL, "x-api-model": modelConfig.modelName },
        body: JSON.stringify({ targets: targetsInput }),
      });
      const data = await resp.json() as { rows?: BaseJudgmentRow[]; message?: string; code?: string };
      if (!resp.ok) { setAiError(data.message || `AI 判定失败（${data.code || resp.status}）`); return; }
      setAiRows(data.rows ?? []);
    } catch (e) {
      setAiError(`AI 判定异常：${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setJudging(false);
    }
  }

  async function saveAi() {
    if (!aiRows.length) return;
    setSaving(true);
    try {
      // 拆分存储：每条规则（材料/颜色区分/雕刻）各自一条草稿，decision 语义化
      const records = aiRows.flatMap((r) => [
        { targetId: r.targetId, ruleId: "D-BASE-01", decision: baseMaterialDecision(r.material), note: `AI 初审：底板材料=${r.material}。${r.rationale}` },
        { targetId: r.targetId, ruleId: "D-BASE-03", decision: baseYesNoDecision(r.colorDistinct), note: `AI 初审：底板颜色与字体区分=${r.colorDistinct}。${r.rationale}` },
        { targetId: r.targetId, ruleId: "D-BASE-04", decision: baseYesNoDecision(r.aluCarve), note: `AI 初审：铝板三维一体雕刻=${r.aluCarve}。${r.rationale}` },
      ]);
      await onSave(records);
      setSaved(true);
    } finally {
      setSaving(false);
    }
  }

  return <section className="rule-detail-card">
    <header><span>2.6 标识底板 · 三条规则</span><h2>底板设计审核</h2><p>对第一层“明确找到”的标识，一次判定底板材料、底板颜色与字体区分、铝板三维一体雕刻三条规则。</p></header>

    <div className="font-objects">
      <strong>{targets.length ? `第一层“明确找到”的标识对象（${targets.length} 个）` : "第一层暂无“明确找到”的标识对象"}</strong>
      {targets.length ? <ul>{targets.map((t) => <li key={t.id}>{t.name} <small>{t.id} · P{t.evidencePage}</small></li>)}</ul> : <p>请先在“标识种类完整性审核”中完成 AI 识别，再回来判定底板规则。</p>}
    </div>

    <div className="decision-form">
      {savedDrafts.length > 0 && <div className="saved-drafts">
        <strong>已存草稿（{savedDrafts.length} 条）</strong>
        {savedDrafts.map((d) => { const t = targets.find((x) => x.id === d.targetId); return <div key={d.targetId} className="ai-result"><div className="ai-result-head"><strong>{t?.name ?? d.targetId}</strong><StatusPill status={d.decision} />{d.updatedAt && <em>{new Date(d.updatedAt).toLocaleString("zh-CN", { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" })}</em>}</div>{d.note && <small>{d.note}</small>}</div>; })}
      </div>}
      <button className="save" disabled={judging || !targets.length} onClick={runAi}>{judging ? "AI 判定中…" : `AI 判定底板（${targets.length} 对象）`}</button>
      {aiError && <p className="ai-error">{aiError}</p>}

      {aiRows.length > 0 && <>
        <div className="ai-results">
          {aiRows.map((r) => <div key={r.targetId} className="ai-result"><div className="ai-result-head"><strong>{r.name}</strong><em>{Math.round((r.confidence ?? 0) * 100)}%</em></div><div className="base-rule-result"><small>材料：{r.material}</small><small>颜色区分：{r.colorDistinct}</small><small>铝板雕刻：{r.aluCarve}</small></div><small>{r.rationale}</small></div>)}
        </div>
        <button className="save" disabled={saving} onClick={saveAi}>{saving ? "正在保存…" : saved ? "已保存 AI 判定为草稿" : "保存 AI 判定为草稿"}</button>
      </>}
      <small className="effect-note">AI 判定为初审草稿；无标注/看不清判“证据不足”。保存后覆盖该对象最新一版草稿。</small>
    </div>
  </section>;
}

/** 红圈点位（百分比坐标） */
type SceneMarker = { id: number; x: number; y: number };

/** 按归一化边界框裁剪证据页图，得到单个标识设计图（dataURL） */
function cropImage(base64: string, x: number, y: number, w: number, h: number): Promise<string> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = Math.max(1, Math.round(img.width * w));
      canvas.height = Math.max(1, Math.round(img.height * h));
      const ctx = canvas.getContext("2d");
      if (!ctx) { resolve(""); return; }
      ctx.drawImage(img, img.width * x, img.height * y, img.width * w, img.height * h, 0, 0, canvas.width, canvas.height);
      resolve(canvas.toDataURL("image/png"));
    };
    img.onerror = () => resolve("");
    img.src = `data:image/jpeg;base64,${base64}`;
  });
}

/** 文件转 base64（去 dataURL 前缀） */
function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(",")[1] ?? "");
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

/** 第三层：场景融合与点位预演（2026-08-16 重构：选标识 → AI 抠图 → 上传实景 → 圈红圈 → 混元生图 → 预演） */
export function ScenePreviewWorkspace({ task }: { task: LocalTask | null }) {
  const foundSigns = (task?.reviewRows ?? []).filter((r) => r.aiStatus === "明确找到");
  const [selectedSignId, setSelectedSignId] = useState("");
  const [signImage, setSignImage] = useState("");
  const [segmenting, setSegmenting] = useState(false);
  const [sceneUrl, setSceneUrl] = useState("");
  const [sceneFile, setSceneFile] = useState<File | null>(null);
  const [markers, setMarkers] = useState<SceneMarker[]>([]);
  const [activeMarker, setActiveMarker] = useState<number | null>(null);
  const [scale, setScale] = useState(100);
  const [tool, setTool] = useState<"draw" | "erase">("draw");
  const [hunyuanKey, setHunyuanKey] = useState(getHunyuanConfig()?.apiKey ?? "");
  const [rendering, setRendering] = useState(false);
  const [renderResult, setRenderResult] = useState("");
  const [msg, setMsg] = useState("");
  const [saved, setSaved] = useState(false);

  const selectedSign = foundSigns.find((s) => s.id === selectedSignId) ?? foundSigns[0];

  async function handleSegment() {
    if (!task?.fileBlob || !selectedSign) { setMsg("请先选择标识，且当前项目需有 PDF 文件。"); return; }
    const modelConfig = getModelConfig();
    if (!modelConfig) { setMsg("请先在首页设置模型配置，再抠图。"); return; }
    setSegmenting(true);
    setMsg("");
    try {
      const nums = parseEvidencePages(selectedSign.evidencePage).slice(0, 1);
      if (!nums.length) { setMsg("该标识无证据页，无法抠图。"); return; }
      const { renderPdfPagesByNumbers } = await import("../lib/pdf-render-browser");
      const rendered = await renderPdfPagesByNumbers(task.fileBlob, nums);
      const page = rendered.find((p) => p.base64);
      if (!page) { setMsg("证据页渲染失败。"); return; }
      const resp = await fetch("/api/segment-sign", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-api-key": modelConfig.apiKey, "x-api-base": modelConfig.baseURL, "x-api-model": modelConfig.modelName },
        body: JSON.stringify({ imageBase64: page.base64, signName: selectedSign.name }),
      });
      const data = await resp.json() as { found?: boolean; x?: number; y?: number; w?: number; h?: number; message?: string };
      if (!resp.ok || !data.found) { setMsg(data.message || "未识别到标识。"); return; }
      const cropped = await cropImage(page.base64, data.x ?? 0, data.y ?? 0, data.w ?? 0.3, data.h ?? 0.3);
      if (!cropped) { setMsg("标识图裁剪失败。"); return; }
      setSignImage(cropped);
    } catch (e) {
      setMsg(`抠图异常：${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setSegmenting(false);
    }
  }

  function handleSceneUpload(file?: File) {
    if (!file) return;
    setSceneFile(file);
    setSceneUrl(URL.createObjectURL(file));
    setMarkers([]);
    setActiveMarker(null);
    setRenderResult("");
    setSaved(false);
  }

  function handleCanvasClick(e: React.MouseEvent<HTMLDivElement>) {
    if (!sceneUrl) return;
    if (tool === "erase") return;  // 擦除模式下点击空白不操作
    const rect = e.currentTarget.getBoundingClientRect();
    const x = Math.round(((e.clientX - rect.left) / rect.width) * 100);
    const y = Math.round(((e.clientY - rect.top) / rect.height) * 100);
    const id = Date.now();
    setMarkers((prev) => [...prev, { id, x, y }]);
    setActiveMarker(id);
    setSaved(false);
  }

  async function handleGenerate() {
    const hunyuan = getHunyuanConfig();
    if (!hunyuan) { setMsg("请先在右侧填写混元生图 API Key 并保存。"); return; }
    if (!sceneFile || !signImage) { setMsg("请先上传实景照片，并 AI 抠出标识设计图。"); return; }
    setRendering(true);
    setMsg("");
    try {
      const sceneB64 = await fileToBase64(sceneFile);
      const signB64 = signImage.split(",")[1] ?? "";
      const resp = await fetch("/api/generate-render", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-hunyuan-key": hunyuan.apiKey },
        body: JSON.stringify({ sceneBase64: sceneB64, signBase64: signB64, prompt: "将标识设计图自然地融合到实景照片中，保持真实透视、光照与比例，生成一张真实感渲染图。" }),
      });
      const data = await resp.json() as { image?: string; kind?: string; message?: string };
      if (!resp.ok) { setMsg(data.message || "生图失败。"); return; }
      setRenderResult(data.kind === "base64" ? `data:image/png;base64,${data.image}` : data.image ?? "");
    } catch (e) {
      setMsg(`生图异常：${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setRendering(false);
    }
  }

  function handleSaveKey() {
    try {
      setHunyuanConfig({ apiKey: hunyuanKey.trim(), baseURL: "", model: "" });
      setMsg("生图配置已保存。");
    } catch (e) {
      setMsg(`保存失败：${e instanceof Error ? e.message : String(e)}`);
    }
  }

  const active = markers.find((m) => m.id === activeMarker);

  return <div className="layer-workspace">
    <div className="layer-hero"><div><h1>场景融合与点位预演</h1><p>选第一层标识 → AI 抠出标识设计图 → 上传实景照片 → 圈红圈标点位 → 混元生成融合渲染图，预演点位、尺度与视觉融合关系。</p></div><span className="layer-state amber-state">点位规则待建立</span></div>

    <div className="scene3-layout">
      <aside className="scene3-left">
        <h3>① 选标识（第一层“明确找到”）</h3>
        {foundSigns.length ? <>
          <select value={selectedSign?.id ?? ""} onChange={(event) => { setSelectedSignId(event.target.value); setSignImage(""); setSaved(false); }}>
            {foundSigns.map((s) => <option key={s.id} value={s.id}>{s.name} · {s.id}</option>)}
          </select>
          <button className="save" disabled={segmenting} onClick={handleSegment}>{segmenting ? "AI 抠图中…" : "AI 抠出标识设计图"}</button>
          {signImage && <div className="sign-preview"><strong>已抠出的标识设计图</strong><img src={signImage} alt="标识设计图" /></div>}
        </> : <p className="scene3-empty">当前任务第一层尚未识别出“明确找到”的标识，请先完成标识种类完整性审核。</p>}
      </aside>

      <section className="scene3-center">
        <h3>② 实景照片（画笔圈红圈 / 擦除）</h3>
        <label className="scene-upload"><input type="file" accept="image/*" onChange={(event) => handleSceneUpload(event.target.files?.[0])} /><span>＋</span><strong>{sceneUrl ? "更换实景照片" : "上传实景照片"}</strong></label>
        <div className="scene-toolbar-inline">
          <button type="button" className={tool === "draw" ? "secondary active" : "secondary"} onClick={() => setTool("draw")} title="画笔模式：点击实景照片圈红圈">✏️ 画笔</button>
          <button type="button" className={tool === "erase" ? "secondary active" : "secondary"} onClick={() => setTool("erase")} title="擦除模式：点击红圈删除">🧽 擦除</button>
          <small className="effect-note">{tool === "draw" ? "当前：点击实景照片添加红圈" : "当前：点击红圈删除"}</small>
        </div>
        <div className="scene-canvas" onClick={handleCanvasClick}>
          {sceneUrl && <img className="scene-bg" src={sceneUrl} alt="实景照片" />}
          {!sceneUrl && <div className="scene-caption">上传实景照片后，点击照片任意位置圈红圈标记标识预演点位</div>}
          {markers.map((m) => <span key={m.id} className={m.id === activeMarker ? "scene-marker active" : "scene-marker"} style={{ left: `${m.x}%`, top: `${m.y}%` }} onClick={(e) => { e.stopPropagation(); if (tool === "erase") { setMarkers((prev) => prev.filter((x) => x.id !== m.id)); if (m.id === activeMarker) setActiveMarker(null); setSaved(false); } else { setActiveMarker(m.id); } }} />)}
          {signImage && active && <img className="placed-sign-img" src={signImage} alt="预演标识" style={{ left: `${active.x}%`, top: `${active.y}%`, transform: `translate(-50%,-50%) scale(${scale / 100})` }} />}
        </div>
        {renderResult && <div className="render-result"><strong>融合渲染图</strong><img src={renderResult} alt="融合渲染图" /></div>}
        <button className="save" disabled={rendering || !sceneUrl || !signImage} onClick={handleGenerate}>{rendering ? "生成中…" : "生成融合渲染图（混元）"}</button>
        {msg && <p className="ai-error">{msg}</p>}
      </section>

      <aside className="scene3-right">
        <h3>③ 预演控制</h3>
        <label>标识尺度 <b>{scale}%</b><input type="range" min="20" max="200" value={scale} onChange={(event) => setScale(Number(event.target.value))} /></label>
        <small className="effect-note">点击红圈选中点位，拖动尺度滑块调整标识大小。</small>

        <h3>④ 混元生图配置</h3>
        <label>API Key<textarea rows={2} value={hunyuanKey} onChange={(event) => setHunyuanKey(event.target.value)} placeholder="TokenHub 获取的 API Key" /></label>
        <button className="secondary" onClick={handleSaveKey}>保存生图配置</button>
        <small className="effect-note">模型 hy-image-v3，端点 tokenhub.tencentmaas.com。Key 仅存浏览器本地。</small>

        <button className="save" onClick={() => setSaved(true)}>{saved ? "已保存预演草稿" : "保存本次预演草稿"}</button>
        <small className="effect-note">草稿只记录方案比较，不代表点位已经业务确认。</small>
      </aside>
    </div>
  </div>;
}
