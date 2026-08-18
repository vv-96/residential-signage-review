"use client";

// 注：使用原生 <a> 而非 next/link，是绕开 vinext 1.0.0-beta.2 的 RSC prefetch
// bug——beta 客户端代码引用了 server-only 的 getPrefetchInterceptionContext 等
// 函数，导致点击 next/link 时报 "te is not a function"。顶部导航点击频率低，
// 整页刷新可接受。等 vinext 修复后改回 <Link prefetch={false}>。
export function TopBar() {
  return (
    <header className="topbar">
      <a className="brand-home" href="/" aria-label="返回首页">
        <span className="brand-mark">标识</span>
        <span className="brand-copy"><small>三层核心能力 · 网页 MVP</small></span>
      </a>
      <div className="top-actions">
        <span className="version">v1.0-rc2</span>
        <div className="avatar" aria-hidden="true">龙湖研发</div>
      </div>
    </header>
  );
}
