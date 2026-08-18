/**
 * 第二层 · 2.3 标识字体大小设计标准（2026-08-16 重构为「字体类型 × 标题层级」树形结构）。
 * 判定流程：先看第一层“标识种类完整性审核”是否明确找到该字体类型对应的标识，
 * 找到才进入字高判定；未找到则该字体类型不参与判定。
 *
 * firstLayerIds 为“第一层标准项 ID → 字体类型”映射表（2026-08-16 魏浩逐项确认）。
 * 本文件从 UI（layer-workspaces.tsx）中独立出来，便于单独维护映射关系。
 */

export type SubRule = { id: string; level: string; rule: string };
export type FontType = { id: string; name: string; source: string; firstLayerIds: string[]; subRules: SubRule[] };

export const designFontTypes: FontType[] = [
  {
    id: "FT-WALL",
    name: "空间墙面指引标识字体",
    source: "2.3 标识字体大小设计标准",
    // 疏散指示牌、漫空间、卫生间 + 精神堡垒（魏浩 2026-08-16 定）
    // 疏散指示牌、漫空间、卫生间（魏浩 2026-08-16 定；精神堡垒后改归单元门头）
    firstLayerIds: ["SIGN-BLDG-002", "SIGN-SALES-014", "SIGN-SALES-015"],
    subRules: [
      { id: "D-FONT-01", level: "一级标题", rule: "一级标题字体大小高为 50mm" },
      { id: "D-FONT-02", level: "二级标题", rule: "二级标题字体大小高为 35mm" },
    ],
  },
  {
    id: "FT-UNIT",
    name: "单元门头字体",
    source: "2.3 标识字体大小设计标准",
    // 楼栋号、单元号、单元景墙、精神堡垒；可视对讲（设备）、单元门头地刻（地面雕刻）已排除（魏浩 2026-08-16 定）
    firstLayerIds: ["SIGN-UNIT-001", "SIGN-UNIT-002", "SIGN-UNIT-005", "SIGN-GATE-003"],
    subRules: [
      { id: "D-FONT-03", level: "字高控制", rule: "单元门头字体控制在 250mm" },
    ],
  },
  {
    id: "FT-LAND",
    name: "景观空间字体",
    source: "2.3 标识字体大小设计标准",
    // 景观水景字、景墙案名、公告栏、楼栋单元指引、景观主题指示、树牌、温馨提示牌（魏浩 2026-08-16 定）
    firstLayerIds: ["SIGN-GATE-001", "SIGN-GATE-002", "SIGN-PARK-002", "SIGN-PARK-003", "SIGN-PARK-004", "SIGN-PARK-006", "SIGN-PARK-007"],
    subRules: [
      { id: "D-FONT-04a", level: "字高控制", rule: "景观空间字体控制在 50mm" },
    ],
  },
  {
    id: "FT-CLUB",
    name: "功能会所入口字体",
    source: "2.3 标识字体大小设计标准",
    // 暂不映射：51 项标准库中暂无明确"功能会所入口"标识（岗亭/财务室牌/落地水牌均排除，魏浩 2026-08-16 定）。待标准库补充该标识后再填。
    firstLayerIds: [],
    subRules: [
      { id: "D-FONT-04b", level: "字高控制", rule: "功能会所入口字体控制在 50mm" },
    ],
  },
];
