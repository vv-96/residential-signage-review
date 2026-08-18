"use client";

type PillTone = "green" | "amber" | "gray" | "blue" | "red";

const toneClass: Record<PillTone, string> = {
  green: "pill-green",
  amber: "pill-amber",
  gray: "pill-gray",
  blue: "pill-blue",
  red: "pill-red",
};

export function Pill({ tone = "gray", children, className = "" }: { tone?: PillTone; children: React.ReactNode; className?: string }) {
  return <span className={`pill ${toneClass[tone]} ${className}`}>{children}</span>;
}

export function StatusPill({ status }: { status: string }) {
  // 兼容第一层 aiStatus（明确找到/缺失/疑似对应）与第二层 decision（符合候选规则/不符合候选规则/证据不足）
  const tone: PillTone = (() => {
    if (status === "明确找到" || status === "符合候选规则") return "green";
    if (status === "疑似对应" || status === "证据不足") return "amber";
    if (status === "缺失" || status === "不符合候选规则") return "red";
    if (status === "不适用") return "blue";
    return "gray"; // 待评估 / 未识别到 / 其他
  })();
  return <Pill tone={tone}>{status}</Pill>;
}
