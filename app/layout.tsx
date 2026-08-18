import type { Metadata } from "next";
import "./globals.css";
import "./ui-system.css";
import "./framework.css";
import "./wizard.css";

export const metadata: Metadata = {
  title: "住宅标识智能审核 · 三层核心能力",
  description: "覆盖标识种类完整性、单项设计合规、场景融合与点位预演的住宅标识审核网页。",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="zh-CN"><body>{children}</body></html>;
}
