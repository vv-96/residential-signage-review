"use client";

// 注：用 <a> 替代 next/link，绕开 vinext 1.0.0-beta.2 的 RSC prefetch bug
// （客户端代码引用 server-only 函数，触发 "te is not a function"）。
// 整页刷新对首页导航可接受。等 vinext 修复后改回 <Link prefetch={false}>。

import { useEffect, useState } from "react";
import { listTasks, LocalTask } from "./lib/local-db";
import { getModelConfig, maskApiKey } from "./lib/model-config";
import { TopBar } from "./components/layout/TopBar";
import { Pill } from "./components/ui/Pill";
import { EmptyState } from "./components/ui/EmptyState";
import { Button } from "./components/ui/Button";
import { useToast } from "./components/ui/Toast";
import { KeySettingsModal } from "./components/ui/KeySettingsModal";

export default function Home() {
  const [tasks, setTasks] = useState<LocalTask[]>([]);
  const [ready, setReady] = useState(false);
  const [keyModalOpen, setKeyModalOpen] = useState(false);
  const [recentExpanded, setRecentExpanded] = useState(false);
  // 修复 Hydration mismatch（2026-08-16）：modelLabel 初始为空，SSR/客户端首次渲染都显示"未设置"；
  // localStorage 只在 useEffect（客户端）读取，避免 SSR 输出与客户端不一致
  const [modelLabel, setModelLabel] = useState("");
  const { show, ToastHost } = useToast();

  useEffect(() => {
    listTasks().then((items) => { setTasks(items); setReady(true); }).catch(() => setReady(true));
    // 客户端读取模型配置（消除 SSR hydration mismatch）
    const current = getModelConfig();
    if (current) setModelLabel(`${current.modelName} · ${maskApiKey(current.apiKey)}`);
  }, []);

  // 最近项目：默认折叠 3 个，"更多项目"按钮展开到 6 个
  const showMore = tasks.length > 3;
  const recent = tasks.slice(0, recentExpanded ? 6 : 3);

  return (
    <main className="app-shell">
      <TopBar />
      <section className="landing-page">
        <div className="landing-card">
          <div className="landing-symbol">标识</div>
          <a className="primary landing-action" href="/new-project">＋ 新建审核项目</a>
          <div className="landing-key-row">
            <Button variant="secondary" size="sm" onClick={() => setKeyModalOpen(true)}>模型设置</Button>
            <span className={modelLabel ? "key-status key-status-set" : "key-status"}>{modelLabel || "未设置"}</span>
          </div>
        </div>
        {ready && (
          <section className="recent-projects" aria-label="最近项目">
            <div className="recent-projects-header">
              <h2>最近项目</h2>
              {showMore && (
                <Button variant="secondary" size="sm" onClick={() => setRecentExpanded(!recentExpanded)}>
                  {recentExpanded ? "收起" : "更多项目"}
                </Button>
              )}
            </div>
            {recent.length ? (
              <div className="project-grid">
                {recent.map((task) => (
                  <a key={task.id} className="project-card" href={`/audit/${task.id}`}>
                    <Pill tone={task.status === "已出结果" ? "green" : task.status === "解析失败" ? "red" : "amber"}>{task.status}</Pill>
                    <h3>{task.projectName}</h3>
                    <div className="project-meta">
                      <span>{task.stage !== "待选择" ? task.stage : "阶段未设置"}</span>
                      <span>{task.fileName}</span>
                      <span>{task.scope.length ? `${task.scope.length} 个分类` : "范围未设置"}</span>
                    </div>
                    <footer>
                      <time>{new Date(task.createdAt).toLocaleString("zh-CN", { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" })}</time>
                      <span className="project-link">进入工作台 →</span>
                    </footer>
                  </a>
                ))}
              </div>
            ) : (
              <EmptyState title="还没有审核项目" description="点击上方「新建审核项目」，上传方案 PDF 开始第一次审核。" />
            )}
          </section>
        )}
        <div className="landing-footer">住宅标识审核工作台</div>
      </section>
      {ToastHost}
      <KeySettingsModal
        key={keyModalOpen ? "open" : "closed"}
        open={keyModalOpen}
        onClose={() => setKeyModalOpen(false)}
        onSaved={() => {
          const current = getModelConfig();
          setModelLabel(current ? `${current.modelName} · ${maskApiKey(current.apiKey)}` : "");
        }}
        showToast={show}
      />
    </main>
  );
}
