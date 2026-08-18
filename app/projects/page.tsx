"use client";

// 注：用 <a> 替代 next/link，绕开 vinext 1.0.0-beta.2 的 RSC prefetch bug
// （客户端代码引用 server-only 函数，触发 "te is not a function"）。
// 等 vinext 修复后改回 <Link prefetch={false}>。

import { useEffect, useState } from "react";
import { deleteTask, listTasks, LocalTask } from "../lib/local-db";
import { TopBar } from "../components/layout/TopBar";
import { PageBack } from "../components/layout/PageBack";
import { Pill } from "../components/ui/Pill";
import { EmptyState } from "../components/ui/EmptyState";
import { useToast } from "../components/ui/Toast";
import { Button } from "../components/ui/Button";

export default function ProjectsPage() {
  const [tasks, setTasks] = useState<LocalTask[]>([]);
  const [ready, setReady] = useState(false);
  const [confirmingId, setConfirmingId] = useState<string | null>(null);
  const { show, ToastHost } = useToast();

  const refresh = () => listTasks().then((items) => { setTasks(items); setReady(true); }).catch(() => setReady(true));

  useEffect(() => { refresh(); }, []);

  async function handleDelete(id: string) {
    try {
      await deleteTask(id);
      setConfirmingId(null);
      show("项目已删除（当前设备本地数据）。", "success");
      await refresh();
    } catch {
      show("删除失败，请检查浏览器存储权限。", "error");
    }
  }

  return (
    <main className="app-shell">
      <TopBar />
      <section className="page-shell">
        <PageBack href="/">返回首页</PageBack>
        <header className="step-header">
          <span>项目档案</span>
          <h1>全部审核项目</h1>
          <p>项目任务保存在当前设备浏览器中；原始文件与历史判断不会被覆盖。</p>
        </header>

        {ready && !tasks.length ? (
          <EmptyState title="还没有审核项目" description="点击「新建审核项目」，上传方案 PDF 开始第一次审核。" actionLabel="新建审核项目" onAction={undefined}>
            <a className="secondary" href="/new-project">新建审核项目</a>
          </EmptyState>
        ) : (
          <div className="project-grid">
            {tasks.map((task) => (
              <article key={task.id} className="project-card">
                <Pill tone={task.status === "已出结果" ? "green" : task.status === "解析失败" ? "red" : "amber"}>{task.status}</Pill>
                <h3>{task.projectName}</h3>
                <div className="project-meta">
                  <span>{task.stage !== "待选择" ? task.stage : "阶段未设置"}</span>
                  <span>{task.fileName}</span>
                </div>
                <p className="project-desc">{task.scope.length ? `本次提交范围：${task.scope.join("、")}` : "提交范围未设置，进入审核步骤时选择。"}</p>
                <footer>
                  <time>{new Date(task.createdAt).toLocaleString("zh-CN", { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" })}</time>
                  <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                    {confirmingId === task.id ? (
                      <>
                        <span style={{ fontSize: 12, color: "var(--ui-error)" }}>确认删除？</span>
                        <Button size="sm" variant="danger" onClick={() => handleDelete(task.id)}>删除</Button>
                        <Button size="sm" variant="text" onClick={() => setConfirmingId(null)}>取消</Button>
                      </>
                    ) : (
                      <>
                        <a className="btn-secondary btn-sm" href={`/audit/${task.id}`}>进入</a>
                        <Button size="sm" variant="text" onClick={() => setConfirmingId(task.id)}>删除</Button>
                      </>
                    )}
                  </div>
                </footer>
              </article>
            ))}
          </div>
        )}
        <div style={{ marginTop: 24 }}><a className="btn-primary btn-md" href="/new-project">＋ 新建审核项目</a></div>
        {ToastHost}
      </section>
    </main>
  );
}
