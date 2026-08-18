"use client";

import { useParams, useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useMemo, useState } from "react";
import { getTask, saveTask, LocalTask, StoredReviewRow } from "../../lib/local-db";
import { parseReviewCsv } from "../../lib/csv-results";
import { getModelConfig } from "../../lib/model-config";
import { buildAuditScope, applicabilityFor, StageName } from "../../lib/standard-catalog";
import { DesignComplianceWorkspace, ScenePreviewWorkspace } from "../../components/layer-workspaces";
import { TopBar } from "../../components/layout/TopBar";
import { Breadcrumb, PageBack } from "../../components/layout/PageBack";
import { StatusPill } from "../../components/ui/Pill";
import { EmptyState } from "../../components/ui/EmptyState";
import { Button } from "../../components/ui/Button";
import { useToast } from "../../components/ui/Toast";

type ReviewStatus = "明确找到" | "缺失" | "疑似对应";
type Layer = 1 | 2 | 3;

const projectStages = [
  { name: "大区" as StageName, description: "大区标识方案及相关空间范围" },
  { name: "示范区" as StageName, description: "示范区、售楼处会所及样板房相关范围" },
  { name: "全期阶段" as StageName, description: "项目全期综合提交范围" },
] as const;

const demoReviewRows: StoredReviewRow[] = [
  { id: "SIGN-GATE-001", category: "社区大门", name: "景观水景字", aiStatus: "明确找到", evidencePage: "1", evidence: "主入口水景 LOGO" },
  { id: "SIGN-GATE-002", category: "社区大门", name: "景墙案名", aiStatus: "明确找到", evidencePage: "2", evidence: "入口矮墙 LOGO 牌" },
  { id: "SIGN-GATE-003", category: "社区大门", name: "精神堡垒", aiStatus: "缺失", evidencePage: "—", evidence: "全页未发现足够证据" },
  { id: "SIGN-GATE-004", category: "社区大门", name: "入口地刻", aiStatus: "缺失", evidencePage: "—", evidence: "全页未发现足够证据" },
  { id: "SIGN-PARK-001", category: "园区部品", name: "总平图", aiStatus: "明确找到", evidencePage: "26", evidence: "总平图" },
  { id: "SIGN-PARK-002", category: "园区部品", name: "公告栏", aiStatus: "缺失", evidencePage: "—", evidence: "全页未发现足够证据" },
  { id: "SIGN-PARK-003", category: "园区部品", name: "楼栋单元指引", aiStatus: "明确找到", evidencePage: "3", evidence: "指引立牌" },
  { id: "SIGN-PARK-004", category: "园区部品", name: "景观主题指示", aiStatus: "缺失", evidencePage: "—", evidence: "未见明确景观主题指示" },
  { id: "SIGN-PARK-005", category: "园区部品", name: "果皮箱", aiStatus: "缺失", evidencePage: "—", evidence: "全页未发现足够证据" },
  { id: "SIGN-PARK-006", category: "园区部品", name: "树牌", aiStatus: "明确找到", evidencePage: "23", evidence: "树铭牌 · 红枫" },
  { id: "SIGN-PARK-007", category: "园区部品", name: "温馨提示牌", aiStatus: "明确找到", evidencePage: "21–22", evidence: "花草牌" },
  { id: "SIGN-PARK-008", category: "园区部品", name: "宠物便便箱", aiStatus: "缺失", evidencePage: "—", evidence: "全页未发现足够证据" },
  { id: "SIGN-UNIT-001", category: "单元门头", name: "楼栋号", aiStatus: "明确找到", evidencePage: "16", evidence: "车库楼栋号" },
  { id: "SIGN-UNIT-002", category: "单元门头", name: "单元号", aiStatus: "明确找到", evidencePage: "17–18", evidence: "车库单元号、首层单元号" },
  { id: "SIGN-UNIT-003", category: "单元门头", name: "可视对讲", aiStatus: "明确找到", evidencePage: "15", evidence: "门禁机台内嵌可视对讲" },
  { id: "SIGN-UNIT-004", category: "单元门头", name: "单元门头地刻", aiStatus: "缺失", evidencePage: "—", evidence: "全页未发现足够证据" },
  { id: "SIGN-UNIT-005", category: "单元门头", name: "单元景墙", aiStatus: "缺失", evidencePage: "24", evidence: "山墙 LOGO 不视为单元景墙证据" },
  { id: "SIGN-BLDG-001", category: "楼区公区", name: "首层物业公告栏", aiStatus: "缺失", evidencePage: "—", evidence: "全页未发现足够证据" },
  { id: "SIGN-BLDG-002", category: "楼区公区", name: "疏散指示牌", aiStatus: "缺失", evidencePage: "—", evidence: "全页未发现足够证据" },
  { id: "SIGN-BLDG-003", category: "楼区公区", name: "楼层号", aiStatus: "缺失", evidencePage: "18", evidence: "首层单元号不自动等同楼层号" },
  { id: "SIGN-BLDG-004", category: "楼区公区", name: "乘梯须知", aiStatus: "缺失", evidencePage: "—", evidence: "全页未发现足够证据" },
  { id: "SIGN-BLDG-005", category: "楼区公区", name: "门牌号", aiStatus: "明确找到", evidencePage: "20", evidence: "门牌号 0302" },
  { id: "SIGN-BLDG-006", category: "楼区公区", name: "管井门标识", aiStatus: "缺失", evidencePage: "—", evidence: "全页未发现足够证据" },
  { id: "SIGN-CAR-001", category: "地库出入口", name: "停车引导立牌", aiStatus: "明确找到", evidencePage: "4–6, 14", evidence: "停车场指引标识" },
  { id: "SIGN-CAR-002", category: "地库出入口", name: "限高标识", aiStatus: "明确找到", evidencePage: "7–8", evidence: "5m / 2.2m 限高信息" },
  { id: "SIGN-CAR-003", category: "地库出入口", name: "龙门标识", aiStatus: "明确找到", evidencePage: "7–13", evidence: "车库入口门头" },
  { id: "SIGN-CAR-004", category: "地库出入口", name: "前厅背景墙", aiStatus: "缺失", evidencePage: "19", evidence: "车库出入口 LOGO 不自动等同" },
  { id: "SIGN-CAR-005", category: "地下车库", name: "车位吊牌", aiStatus: "缺失", evidencePage: "25", evidence: "车库单元吊箱不自动等同" },
  { id: "SIGN-CAR-006", category: "地下车库", name: "车道指引", aiStatus: "缺失", evidencePage: "25", evidence: "电梯厅导向不属于车道指引" },
  { id: "SIGN-CAR-007", category: "地下光厅", name: "柱面-楼栋号", aiStatus: "明确找到", evidencePage: "16", evidence: "车库楼栋号" },
  { id: "SIGN-CAR-008", category: "地下光厅", name: "墙面-单元号", aiStatus: "明确找到", evidencePage: "17", evidence: "车库单元号" },
  { id: "SIGN-CAR-009", category: "地下光厅", name: "墙面-铭牌", aiStatus: "缺失", evidencePage: "19", evidence: "车库出入口 LOGO 不视为墙面铭牌证据" },
];

const scopeOptions = ["社区大门", "园区部品", "单元门头", "楼区公区", "地库出入口", "地下车库", "地下光厅", "售楼处会所", "样板房"];

function AuditWorkspace() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const search = useSearchParams();
  const { show, ToastHost } = useToast();

  const [task, setTask] = useState<LocalTask | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [activeLayer, setActiveLayer] = useState<Layer>(() => {
    const layer = Number(search.get("layer"));
    return layer === 2 || layer === 3 ? (layer as Layer) : 1;
  });
  const [view, setView] = useState<"steps" | "scope" | "audit">("steps");
  const [filter, setFilter] = useState<"全部" | ReviewStatus>("全部");
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [projectStage, setProjectStage] = useState<StageName>("大区");
  const [scope, setScope] = useState<string[]>(scopeOptions.slice(0, 7));
  const [scopeSaving, setScopeSaving] = useState(false);
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [analyzeError, setAnalyzeError] = useState("");
  const [analyzeStage, setAnalyzeStage] = useState<"渲染页面" | "AI 识别">("渲染页面");
  const [renderProgress, setRenderProgress] = useState("");

  const projectName = task?.projectName ?? "当前项目";

  useEffect(() => {
    if (!params.id) return;
    getTask(params.id).then((found) => {
      if (!found) { setNotFound(true); return; }
      setTask(found);
      if (found.scope?.length) setScope(found.scope);
      if (found.stage === "大区" || found.stage === "示范区" || found.stage === "全期阶段") setProjectStage(found.stage);
    }).catch(() => setNotFound(true));
  }, [params.id]);

  const auditScopePreview = useMemo(() => buildAuditScope(projectStage, scope), [projectStage, scope]);
  const activeAuditScope = useMemo(() => {
    const stage: StageName = (task?.stage === "大区" || task?.stage === "示范区" || task?.stage === "全期阶段") ? task.stage : projectStage;
    const selected = task?.scope?.length ? task.scope : scope;
    return buildAuditScope(stage, selected);
  }, [task, scope, projectStage]);

  // 旧数据兼容：历史上"未识别到"状态归一化为"缺失"（2026-08-15 规则变更）；"不适用"状态一并归一化为"缺失"（2026-08-15 去除"不适用"状态）
  const sourceRows = task?.reviewRows?.length
    ? task.reviewRows.map((row) => ({ ...row, aiStatus: (row.aiStatus === "未识别到" || row.aiStatus === "不适用" ? "缺失" : row.aiStatus) as StoredReviewRow["aiStatus"] }))
    : demoReviewRows;
  const usingDemo = !task?.reviewRows?.length;

  const rows = useMemo(() => {
    const rowsForScope = activeAuditScope.items.map((standard) => {
      const matched = sourceRows.find((row) => row.id === standard.id);
      if (matched) return matched;
      return { id: standard.id, category: standard.category, name: standard.name, aiStatus: "缺失" as const, evidencePage: "—", evidence: "该标准项在本次范围内，但尚未获得 AI 初审结果。" };
    });
    return rowsForScope.filter((row) => {
      const matchesStatus = filter === "全部" || row.aiStatus === filter;
      const matchesQuery = `${row.id}${row.category}${row.name}`.toLowerCase().includes(query.toLowerCase());
      return matchesStatus && matchesQuery;
    });
  }, [activeAuditScope, sourceRows, filter, query]);

  const counts = useMemo(() => {
    const rowsForScope = activeAuditScope.items.map((standard) => {
      const matched = sourceRows.find((row) => row.id === standard.id);
      return matched ?? { aiStatus: "缺失" as const };
    });
    const found = rowsForScope.filter((row) => row.aiStatus === "明确找到").length;
    const notFound = rowsForScope.filter((row) => row.aiStatus === "缺失").length;
    const suspected = rowsForScope.filter((row) => row.aiStatus === "疑似对应").length;
    return {
      "明确找到": found,
      "缺失": notFound,
      "疑似对应": suspected,
      total: rowsForScope.length,
      coverageRate: rowsForScope.length ? Math.round((found / rowsForScope.length) * 1000) / 10 : 0,
    };
  }, [activeAuditScope, sourceRows]);

  const selected = rows.find((row) => row.id === selectedId) ?? rows[0];

  /** 导出第一层审核结果 CSV（UTF-8 BOM，Excel/WPS 可直接打开） */
  function exportReviewCsv() {
    if (!task?.reviewRows?.length) { show("暂无可导出的结果，请先完成 AI 解析。", "warning"); return; }
    const exportRows = activeAuditScope.items.map((standard) => {
      const matched = sourceRows.find((row) => row.id === standard.id);
      return matched ?? { id: standard.id, category: standard.category, name: standard.name, aiStatus: "缺失", evidencePage: "—", evidence: "该标准项在本次范围内，但尚未获得 AI 初审结果。" };
    });
    const escape = (value: string) => (/[",\n\r]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value);
    const header = ["标准项ID", "分类", "标准名称", "AI状态", "页码证据", "证据描述", "效力说明"];
    const lines = [header.join(",")];
    for (const row of exportRows) {
      lines.push([row.id, row.category, row.name, row.aiStatus, row.evidencePage, row.evidence ?? "", "AI初审未经业务确认"].map(escape).join(","));
    }
    const blob = new Blob(["\uFEFF" + lines.join("\r\n")], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${task.projectName}_第一层审核结果.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    show(`已导出 ${exportRows.length} 条审核结果`, "success");
  }

  const toggleScope = (item: string) => setScope((current) => current.includes(item) ? current.filter((value) => value !== item) : [...current, item]);

  async function confirmCompletenessSetup() {
    if (!scope.length || !task) return;
    setScopeSaving(true);
    try {
      const updated = { ...task, stage: projectStage, scope };
      await saveTask(updated);
      setTask(updated);
      setActiveLayer(1);
      setView("audit");
      show("阶段与范围已保存，进入完整性审核。", "success");
    } catch {
      show("保存失败，请检查浏览器存储权限后重试。", "error");
    } finally {
      setScopeSaving(false);
    }
  }

  /** 导入 CSV 预生成结果：仅作为开发测试数据源，不做人工复核操作 */
  async function importCsv() {
    if (!task || !csvFile) return;
    const text = await csvFile.text();
    const parsed = parseReviewCsv(text);
    if (!parsed.length) { show("导入失败：未找到标准项 ID、标准名称和 AI 状态字段，请检查 CSV 表头。", "error"); return; }
    const updated: LocalTask = { ...task, csvName: csvFile.name, csvText: text, csvRowCount: parsed.length, reviewRows: parsed, status: "已出结果" };
    await saveTask(updated);
    setTask(updated);
    show(`已解析 ${parsed.length} 条结果，任务状态为“已出结果”。`, "success");
  }

  /** 浏览器端渲染 PDF → 调用服务端 /api/analyze（视觉模型识别），生成逐项 AI 初审 */
  async function startAiAnalysis() {
    if (!task) return;
    // 调试日志（2026-08-16）：定位"开始 AI 解析"流程卡在哪一步
    console.log("[analyze-flow] 1. 开始，task=", task.id, "fileBlob=", !!task.fileBlob, "scope=", task.scope?.length, "stage=", task.stage);
    // 使用者必须先设置自己的模型配置（API 密钥），否则无法调用模型
    const modelConfig = getModelConfig();
    console.log("[analyze-flow] 2. modelConfig=", modelConfig ? `${modelConfig.modelName} @ ${modelConfig.baseURL}` : "null（未设置）");
    if (!modelConfig) { console.log("[analyze-flow] 3. 拦截：模型配置缺失"); show("请先在首页设置模型配置，再开始 AI 解析。", "warning"); return; }
    if (!task.fileBlob) { console.log("[analyze-flow] 3. 拦截：无 PDF 文件"); show("当前项目没有可上传的 PDF 文件，请返回新建项目后重试。", "warning"); return; }
    if (!task.scope?.length) { console.log("[analyze-flow] 3. 拦截：范围未设置"); show("请先在“设置审核阶段与范围”中确认提交范围。", "warning"); setView("scope"); return; }
    console.log("[analyze-flow] 4. 校验通过，进入渲染");
    setAnalyzing(true);
    setAnalyzeError("");
    try {
      // 1. 浏览器本地渲染 PDF 为页面图片（绕开 Cloudflare Worker 无法加载 PDF 渲染 WASM 的限制）
      setAnalyzeStage("渲染页面");
      setRenderProgress("");
      let pages: { pageNumber: number; base64: string; width: number; height: number }[];
      try {
        const { renderPdfPagesBrowser } = await import("../../lib/pdf-render-browser");
        console.log("[analyze-flow] 5. 开始渲染 PDF");
        pages = await renderPdfPagesBrowser(task.fileBlob, undefined, (done, total) => {
          setRenderProgress(`${done}/${total}`);
          if (done % 5 === 0 || done === total) console.log(`[analyze-flow] 5. 渲染进度 ${done}/${total}`);
        });
        console.log("[analyze-flow] 6. 渲染完成，页数=", pages.length);
      } catch (error) {
        const message = `PDF 页面渲染失败：${error instanceof Error ? error.message : "未知错误"}`;
        setAnalyzeError(message);
        show(message, "error");
        return;
      }
      if (!pages.length) {
        setAnalyzeError("PDF 没有可解析的页面。");
        show("PDF 没有可解析的页面。", "warning");
        return;
      }

      // 2. 把渲染好的页面图片与范围发给服务端，由视觉模型生成逐项结果
      setAnalyzeStage("AI 识别");
      console.log("[analyze-flow] 7. 发起 /api/analyze 请求，pages=", pages.length);
      const response = await fetch("/api/analyze", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": modelConfig.apiKey,
          "x-api-base": modelConfig.baseURL,
          "x-api-model": modelConfig.modelName,
        },
        body: JSON.stringify({ pages, scope: task.scope, stage: task.stage }),
      });
      const data = await response.json() as { code?: string; message?: string; rows?: StoredReviewRow[]; model?: string; standardVersion?: string };
      if (!response.ok) {
        const errorCode = data.code || "MODEL_REQUEST_FAILED";
        const errorMessage = data.message || "解析失败，请稍后重试。";
        const updated: LocalTask = { ...task, status: ["API_KEY_MISSING", "API_KEY_INVALID", "MODEL_NOT_CONFIGURED", "INVALID_BASE_URL"].includes(errorCode) ? "需要模型配置" : "解析失败", lastErrorCode: errorCode, lastErrorMessage: errorMessage, lastAttemptAt: new Date().toISOString(), parsingAttempts: (task.parsingAttempts ?? 0) + 1 };
        await saveTask(updated);
        setTask(updated);
        setAnalyzeError(errorMessage);
        show(errorMessage, "error");
        return;
      }
      if (!data.rows?.length) {
        setAnalyzeError("模型未返回任何逐项结果，请重试。");
        show("模型未返回任何逐项结果，请重试。", "warning");
        return;
      }
      const updated: LocalTask = { ...task, reviewRows: data.rows, status: "已出结果", aiModel: data.model, aiCompletedAt: new Date().toISOString(), lastErrorCode: undefined, lastErrorMessage: undefined };
      await saveTask(updated);
      setTask(updated);
      show(`AI 初审完成：${data.rows.length} 项结果已生成。`, "success");
    } catch {
      setAnalyzeError("无法连接解析服务，请检查网络后重试。");
      show("无法连接解析服务，请检查网络后重试。", "error");
    } finally {
      setAnalyzing(false);
    }
  }

  /** 第二层单项设计合规审核草稿保存：更新任务并生成递增版本快照，成功后 Toast 反馈 */
  async function handleDesignUpdate(next: LocalTask) {
    setTask(next);
    try {
      await saveTask(next);
      const nextVersion = next.designVersions?.at(-1)?.version ?? 0;
      show(`第二层审核草稿已保存，当前版本 v${nextVersion}；旧版本保留在当前设备。`, "success");
    } catch {
      show("草稿保存失败，请检查浏览器存储权限后重试。", "error");
    }
  }

  const layerTitle = activeLayer === 1 ? "标识种类完整性审核" : activeLayer === 2 ? "单项设计合规审核" : "场景融合与点位预演";

  if (notFound) {
    return (
      <main className="app-shell">
        <TopBar />
        <section className="page-shell">
          <EmptyState title="未找到该项目" description="项目可能已被删除，或本地存储被清空。" actionLabel="返回首页" onAction={() => router.push("/")} />
        </section>
      </main>
    );
  }

  if (!task) {
    return (
      <main className="app-shell">
        <TopBar />
        <section className="page-shell"><div className="form-note" role="status">正在读取项目数据…</div></section>
      </main>
    );
  }

  return (
    <main className="app-shell">
      <TopBar />

      {view === "steps" && (
        <section className="step-page">
          <PageBack href="/">返回首页</PageBack>
          <header className="step-header">
            <h1>选择审核步骤</h1>
            <p>{projectName} · {task.stage !== "待选择" ? task.stage : "请选择需要开展的审核能力"}</p>
          </header>
          <div className="audit-step-grid">
            <button className="audit-step-card" onClick={() => { setActiveLayer(1); setView(task.scope?.length ? "audit" : "scope"); }}>
              <span className="step-index">01</span><div><h2>标识种类完整性审核</h2><p>核对方案是否覆盖标准库中的应审标识种类，并查看对应证据页。</p><small>查种类 · 查缺项 →</small></div>
            </button>
            <button className="audit-step-card" onClick={() => { setActiveLayer(2); setView("audit"); }}>
              <span className="step-index">02</span><div><h2>单项设计合规审核</h2><p>从字体、VI、色彩、材质和功能表达等维度检查单项设计。</p><small>查设计 · 查表达 →</small></div>
            </button>
            <button className="audit-step-card" onClick={() => { setActiveLayer(3); setView("audit"); }}>
              <span className="step-index">03</span><div><h2>场景融合与点位预演</h2><p>上传场景与标识图，预演点位、尺度和视觉融合关系。</p><small>调点位 · 做预演 →</small></div>
            </button>
          </div>
          <div className="step-footnote">第二、三层规则仍为候选规则，审核结果需保留证据并支持后续修订。</div>
        </section>
      )}

      {view === "scope" && (
        <section className="step-page scope-page">
          <PageBack onClick={() => setView("steps")}>返回审核步骤</PageBack>
          <header className="step-header">
            <span>标识种类完整性审核</span>
            <h1>设置审核阶段与范围</h1>
            <p>阶段和提交范围将决定本次完整性审核的临时应审清单，进入审核后仍可返回修改。</p>
          </header>
          <section className="scope-panel">
            <div className="setup-section">
              <div className="setup-label"><strong>项目阶段</strong><span>选择本次 PDF 对应的设计阶段</span></div>
              <div className="stage-grid stage-grid-three">{projectStages.map((stage) => <button key={stage.name} className={projectStage === stage.name ? "selected" : ""} aria-pressed={projectStage === stage.name} onClick={() => setProjectStage(stage.name)}><strong>{stage.name}</strong><small>{stage.description}</small></button>)}</div>
            </div>
            <div className="setup-section">
              <div className="setup-label"><strong>本次提交范围</strong><span>至少选择一个需要检查的空间分类</span></div>
              <div className="scope-grid">{scopeOptions.map((item) => {
                const applicability = applicabilityFor(projectStage, item);
                const isExcluded = applicability === "不适用";
                return <button key={item} className={`${scope.includes(item) ? "selected" : ""} ${isExcluded ? "scope-excluded" : ""}`} aria-pressed={scope.includes(item)} onClick={() => toggleScope(item)}><i>{scope.includes(item) ? "✓" : ""}</i><span><strong>{item}</strong><small className={`scope-applicability scope-applicability-${applicability === "必选" ? "required" : applicability === "条件必选" ? "conditional" : "excluded"}`}>{applicability}</small></span></button>;
              })}</div>
              <div className="form-note amber-note">阶段矩阵来自 `v1.0-rc2` 候选标准（2026-08-14 业务已确认分类适用性），只形成临时应审清单；未识别到的项即视为缺失（AI 初审，最终以业务复核为准）。“条件必选”分类勾选即视为本次方案包含该范围。</div>
            </div>

            {scope.length > 0 && (
              <section className="scope-preview" aria-live="polite">
                <header>
                  <div><strong>本次临时应审清单</strong><small>按当前阶段与提交范围生成，进入审核后可按实际内容调整</small></div>
                  <span className="scope-count">{auditScopePreview.items.length} 项</span>
                </header>
                {auditScopePreview.excludedCategories.length > 0 && (
                  <p className="scope-excluded-note">以下分类在当前阶段标记为“不适用”，不会纳入应审：{auditScopePreview.excludedCategories.map((item) => item.name).join("、")}。</p>
                )}
                {auditScopePreview.items.length > 0 ? (
                  <div className="scope-preview-grid">
                    {auditScopePreview.categories.map((category) => {
                      const items = auditScopePreview.items.filter((item) => item.category === category.name);
                      return <div key={category.name} className="scope-preview-category"><strong>{category.name}<small>{items.length} 项{category.applicability === "条件必选" ? " · 条件必选" : ""}</small></strong><span>{items.map((item) => item.name).join("、")}</span>{category.condition ? <em>{category.condition}</em> : null}</div>;
                    })}
                  </div>
                ) : (
                  <div className="form-note">当前选择在所选阶段下没有可审核的分类，请调整提交范围。</div>
                )}
              </section>
            )}

            <footer className="setup-actions">
              <Button variant="secondary" onClick={() => setView("steps")}>取消</Button>
              <Button disabled={!scope.length || scopeSaving || auditScopePreview.items.length === 0} loading={scopeSaving} onClick={confirmCompletenessSetup}>确认并进入完整性审核（{auditScopePreview.items.length} 项）</Button>
            </footer>
          </section>
        </section>
      )}

      {view === "audit" && (
        <section className="audit-page">
          <div className="audit-toolbar">
            <nav className="audit-toolbar-actions" aria-label="审核页面操作">
              <PageBack onClick={() => setView("steps")}>返回审核步骤</PageBack>
              <button className="page-back" onClick={() => setView("scope")}>修改阶段与范围</button>
            </nav>
          </div>
          <section className="content audit-content">
            {activeLayer === 1 && <>
              <div className="hero">
                <div><h1>{projectName}</h1><p>本次应审 {counts.total} 项（阶段：{task.stage !== "待选择" ? task.stage : projectStage}）。上传 PDF 后由视觉模型生成逐项 AI 初审结果。</p></div>
              </div>

              <section className="analyze-panel" aria-label="AI 解析">
                <div className="analyze-copy">
                  <strong>{analyzing && analyzeStage === "渲染页面" ? "正在渲染 PDF 页面" : task.reviewRows?.length ? "已生成 AI 初审结果" : "尚未进行 AI 解析"}</strong>
                  <span>
                    {analyzing && analyzeStage === "渲染页面"
                      ? (renderProgress ? `正在将第 ${renderProgress} 页图纸转为图片，请稍候…` : "正在准备渲染，请稍候…")
                      : task.reviewRows?.length
                        ? `当前任务已有 ${task.reviewRows.length} 条 AI 初审结果（模型：${task.aiModel || "未记录"}）。重新解析会生成新结果，历史版本仍保留。`
                        : task.status === "解析失败" || analyzeError
                          ? `上次解析失败：${analyzeError || task.lastErrorMessage || "未知错误"}。可调整网络或重试。`
                          : "点击右侧按钮，先在浏览器本地渲染 PDF 页面，再由视觉模型按应审清单逐项返回初审结果。"}
                  </span>
                  {task.status === "需要模型配置" && (
                    <small className="analyze-hint">
                      使用 AI 解析需先在首页设置模型配置（含 API 密钥）。{["API_KEY_MISSING", "API_KEY_INVALID", "INVALID_BASE_URL"].includes(task.lastErrorCode ?? "") ? "（配置缺失或格式不正确）" : ""}{" "}
                      <a href="/" className="analyze-hint-link">去首页设置模型</a>
                    </small>
                  )}
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <Button disabled={analyzing} loading={analyzing} onClick={startAiAnalysis}>
                    {analyzing ? (analyzeStage === "渲染页面" ? (renderProgress ? `正在渲染 PDF 页面（${renderProgress}）…` : "正在渲染 PDF 页面…") : "AI 正在识别…") : task.reviewRows?.length ? "重新 AI 解析" : "开始 AI 解析"}
                  </Button>
                  <Button onClick={() => document.getElementById("review-table")?.scrollIntoView({ behavior: "smooth" })}>查看结果</Button>
                </div>
              </section>

              <div className="simple-summary">
                <span><b>{counts.total}</b> 应审项</span>
                <span><b>{counts["明确找到"]}</b> 明确找到</span>
                <span><b>{counts["缺失"]}</b> 缺失</span>
                <span><b>{counts["疑似对应"]}</b> 疑似对应</span>
                <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 12 }}>
                  <span>临时完整率 <b>{counts.coverageRate}%</b>{usingDemo ? " · 当前为演示数据" : ""}</span>
                  <Button variant="secondary" size="sm" onClick={exportReviewCsv}>导出 CSV</Button>
                </div>
              </div>

              <div id="review-table" className="review-grid">
                <section className="table-card">
                  <div className="table-tools">
                    <div className="tabs">{(["全部", "明确找到", "缺失", "疑似对应"] as const).map((tab) => <button key={tab} className={filter === tab ? "active" : ""} aria-pressed={filter === tab} onClick={() => setFilter(tab)}>{tab}<b>{tab === "全部" ? counts.total : counts[tab]}</b></button>)}</div>
                    <label className="search-field" htmlFor="standard-search"><span>搜索标准项</span><input id="standard-search" placeholder="输入 ID、分类或名称" value={query} onChange={(e) => setQuery(e.target.value)} /></label>
                  </div>
                  <div className="table-wrap">
                    <table>
                      <thead><tr><th>标准项</th><th>分类</th><th>AI 状态</th><th>证据页</th></tr></thead>
                      <tbody>
                        {rows.length ? rows.map((row) => <tr key={row.id} className={selected?.id === row.id ? "selected" : ""} tabIndex={0} aria-selected={selected?.id === row.id} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); setSelectedId(row.id); } }} onClick={() => { setSelectedId(row.id); }}><td data-label="标准项"><strong>{row.name}</strong><small>{row.id}</small></td><td data-label="分类">{row.category}</td><td data-label="AI 状态"><StatusPill status={row.aiStatus} /></td><td data-label="证据页">{row.evidencePage}</td></tr>)
                          : <tr className="empty-row"><td colSpan={4}><EmptyState title="没有找到符合条件的标准项" description="请调整关键词或清除当前筛选条件。" actionLabel="清除筛选" onAction={() => { setQuery(""); setFilter("全部"); }} /></td></tr>}
                      </tbody>
                    </table>
                  </div>
                </section>

                <aside className="detail-card">
                  {selected ? <div className="detail-head">
                    <span className="index">{selected.id}</span>
                    <StatusPill status={selected.aiStatus} />
                    <h2>{selected.name}</h2>
                    <p>{selected.category}</p>
                  </div> : null}
                  {selected ? <div className="evidence-preview">
                    <span>PDF 证据页</span>
                    <strong>{selected.evidencePage === "—" ? "未发现" : `P${selected.evidencePage}`}</strong>
                    <div className="mock-drawing"><i /><i /><i /><em>{selected.name}</em></div>
                    <p>{selected.evidence}</p>
                  </div> : null}
                  <div className="review-box">
                    <small>本结果为 AI 初审，未经业务确认；未识别到即视为缺失，最终以业务复核为准。</small>
                    {selected.aiStatus === "疑似对应" && <div className="rule-hint">AI“疑似对应”项不计入明确找到，不视为正式缺失。</div>}
                  </div>
                </aside>
              </div>
            </>}

            {activeLayer === 2 && <DesignComplianceWorkspace task={task} onTaskUpdate={handleDesignUpdate} />}
            {activeLayer === 3 && <ScenePreviewWorkspace task={task} />}
          </section>
        </section>
      )}

      {/* 开发测试：导入已有 CSV 结果（仅作为测试数据源，无人工复核操作） */}
      <details className="fallback-import" style={{ maxWidth: 1200, margin: "0 auto 24px" }}>
        <summary>开发测试：导入已有 CSV 结果</summary>
        <div className="csv-import">
          <label>
            <input type="file" accept=".csv,text/csv" onChange={(e) => setCsvFile(e.target.files?.[0] ?? null)} />
            <span>{csvFile?.name || task.csvName || "选择预生成审核结果 CSV"}</span>
          </label>
          <Button variant="secondary" disabled={!csvFile} onClick={importCsv}>导入</Button>
        </div>
        {task.reviewRows?.length ? (
          <div className="import-result">已导入 {task.reviewRows.length} 条 AI 初审结果，任务状态为“已出结果”。</div>
        ) : task.csvRowCount !== undefined ? <div className="import-result">CSV 已保存，但尚未解析出可展示结果。</div> : null}
      </details>

      {ToastHost}
    </main>
  );
}

export default function AuditPage() {
  return <Suspense fallback={<main className="app-shell"><TopBar /><section className="page-shell"><div className="form-note" role="status">正在打开审核工作台…</div></section></main>}><AuditWorkspace /></Suspense>;
}
