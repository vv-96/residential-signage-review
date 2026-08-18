"use client";

// 注：用 <a> 替代 next/link，绕开 vinext 1.0.0-beta.2 的 RSC prefetch bug
// （客户端代码引用 server-only 函数，触发 "te is not a function"）。
// 等 vinext 修复后改回 <Link prefetch={false}>。
export function PageBack({ href, onClick, children = "返回" }: { href?: string; onClick?: () => void; children?: React.ReactNode }) {
  const className = "page-back";
  if (href) return <a className={className} href={href}>{children}</a>;
  return <button className={className} onClick={onClick}>{children}</button>;
}

export function Breadcrumb({ items }: { items: string[] }) {
  return <div className="breadcrumb">{items.join(" / ")}</div>;
}
