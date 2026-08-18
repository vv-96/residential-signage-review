"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { saveTask, LocalTask } from "../lib/local-db";
import { TopBar } from "../components/layout/TopBar";
import { PageBack } from "../components/layout/PageBack";
import { FormField } from "../components/ui/FormField";
import { Button } from "../components/ui/Button";

export default function NewProjectPage() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [projectName, setProjectName] = useState("");
  const [batch, setBatch] = useState("");
  const [note, setNote] = useState("");
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState("");

  async function createTask() {
    if (!pdfFile) return;
    setCreating(true);
    setError("");
    const task: LocalTask = {
      id: crypto.randomUUID(),
      projectName: projectName.trim(),
      stage: "待选择",
      scope: [],
      standardVersion: "v1.0-rc2",
      fileName: pdfFile.name,
      fileSize: pdfFile.size,
      fileType: pdfFile.type || "application/pdf",
      fileBlob: pdfFile,
      status: "待解析",
      createdAt: new Date().toISOString(),
    };
    try {
      await saveTask(task);
      router.push(`/audit/${task.id}`);
    } catch {
      setError("保存失败：浏览器可能没有足够的本地存储空间，或存储权限被禁用。");
      setCreating(false);
    }
  }

  return (
    <main className="app-shell">
      <TopBar />
      <section className="page-shell">
        <PageBack href="/">返回首页</PageBack>
        <header className="step-header">
          <span>新建审核项目</span>
          <h1>{step === 1 ? "填写项目信息" : "上传标识方案 PDF"}</h1>
          <p>项目创建后仍为内部流程测试，不产生正式业务审核结论；进入具体审核步骤后再设置阶段与范围。</p>
        </header>

        <div className="wizard-steps" aria-hidden="true">
          <div className={step >= 1 ? "active" : ""}><b>1</b><span>项目信息</span></div>
          <i />
          <div className={step >= 2 ? "active" : ""}><b>2</b><span>上传 PDF</span></div>
        </div>

        <div className="scope-panel" style={{ marginTop: 16 }}>
          {step === 1 && (
            <div className="form-stack">
              <FormField label="项目名称" required htmlFor="project-name" error={error || undefined}>
                <input id="project-name" value={projectName} onChange={(e) => setProjectName(e.target.value)} placeholder="例如：天府云河颂大区" />
              </FormField>
              <FormField label="审核批次" hint="例如：大区标识方案第一版" htmlFor="project-batch">
                <input id="project-batch" value={batch} onChange={(e) => setBatch(e.target.value)} placeholder="例如：大区标识方案第一版" />
              </FormField>
              <FormField label="补充说明" htmlFor="project-note">
                <textarea id="project-note" value={note} onChange={(e) => setNote(e.target.value)} placeholder="填写审核边界、设计单位或特别关注内容" />
              </FormField>
              <div className="form-note">项目名称用于区分审核档案；原始 PDF 与后续判断保存在当前设备。</div>
            </div>
          )}
          {step === 2 && (
            <div className="form-stack">
              <FormField label="标识方案 PDF" required hint={pdfFile ? `${(pdfFile.size / 1024 / 1024).toFixed(1)} MB · 已准备创建项目` : "PDF 将保存在当前设备，进入具体审核步骤后再设置所需范围"} htmlFor="project-pdf">
                <label className={`upload-zone ${pdfFile ? "has-file" : ""}`} style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", textAlign: "center", cursor: "pointer" }}>
                  <input id="project-pdf" type="file" accept="application/pdf,.pdf" onChange={(e) => setPdfFile(e.target.files?.[0] ?? null)} />
                  <span className="upload-icon">{pdfFile ? "PDF" : "＋"}</span>
                  <strong>{pdfFile ? pdfFile.name : "选择标识方案 PDF"}</strong>
                  <small>{pdfFile ? "点击可重新选择" : "支持 PDF 格式，单文件不超过 50 MB"}</small>
                </label>
              </FormField>
              <div className="task-summary">
                <h3>项目摘要</h3>
                <dl>
                  <div><dt>项目名称</dt><dd>{projectName || "尚未填写"}</dd></div>
                  <div><dt>审核批次</dt><dd>{batch || "未填写"}</dd></div>
                  <div><dt>上传文件</dt><dd>{pdfFile?.name || "尚未选择"}</dd></div>
                  <div><dt>标准版本</dt><dd>v1.0-rc2 · 候选修订</dd></div>
                </dl>
              </div>
              {error ? <div className="form-note amber-note" role="alert">{error}</div> : null}
            </div>
          )}
          <footer className="setup-actions">
            <Button variant="secondary" onClick={() => (step === 1 ? router.push("/") : setStep(1))}>{step === 1 ? "取消" : "上一步"}</Button>
            <span style={{ color: "var(--ui-text-secondary)", fontSize: 12 }}>第 {step} / 2 步</span>
            {step === 1
              ? <Button disabled={!projectName.trim()} onClick={() => { setError(""); setStep(2); }}>下一步</Button>
              : <Button disabled={!pdfFile} loading={creating} onClick={createTask}>创建项目</Button>}
          </footer>
        </div>
      </section>
    </main>
  );
}
