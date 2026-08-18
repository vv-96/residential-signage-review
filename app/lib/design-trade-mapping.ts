/**
 * 第二层 · 2.4 标识 logo 排版设计标准 ——「三专业」维度映射表。
 * 一级分类为建筑 / 精装 / 景观三专业，51 项第一层标准项各归其一（魏浩 2026-08-16 确认）。
 *
 * ⚠️ 本表与 2.3 字体映射表（design-font-mapping.ts）相互独立：同一标准项在
 * 两个维度可归不同组（如精神堡垒在 2.3 归"单元门头字体"、在 2.4 归"景观"）。
 */

export type TradeType = { id: string; name: string; source: string; firstLayerIds: string[] };

export const designTrades: TradeType[] = [
  {
    id: "TRADE-ARCH",
    name: "建筑",
    source: "2.4 标识logo排版设计标准",
    // 单元门头 5 + 楼区公区 6 + 地库出入口 4 + 地下车库 2 + 地下光厅 3
    firstLayerIds: [
      "SIGN-UNIT-001", "SIGN-UNIT-002", "SIGN-UNIT-003", "SIGN-UNIT-004", "SIGN-UNIT-005",
      "SIGN-BLDG-001", "SIGN-BLDG-002", "SIGN-BLDG-003", "SIGN-BLDG-004", "SIGN-BLDG-005", "SIGN-BLDG-006",
      "SIGN-CAR-001", "SIGN-CAR-002", "SIGN-CAR-003", "SIGN-CAR-004",
      "SIGN-CAR-005", "SIGN-CAR-006",
      "SIGN-CAR-007", "SIGN-CAR-008", "SIGN-CAR-009",
    ],
  },
  {
    id: "TRADE-INT",
    name: "精装",
    source: "2.4 标识logo排版设计标准",
    // 售楼处会所 16 + 样板房 3
    firstLayerIds: [
      "SIGN-SALES-001", "SIGN-SALES-002", "SIGN-SALES-003", "SIGN-SALES-004", "SIGN-SALES-005",
      "SIGN-SALES-006", "SIGN-SALES-007", "SIGN-SALES-008", "SIGN-SALES-009", "SIGN-SALES-010",
      "SIGN-SALES-011", "SIGN-SALES-012", "SIGN-SALES-013", "SIGN-SALES-014", "SIGN-SALES-015", "SIGN-SALES-016",
      "SIGN-MODEL-001", "SIGN-MODEL-002", "SIGN-MODEL-003",
    ],
  },
  {
    id: "TRADE-LAND",
    name: "景观",
    source: "2.4 标识logo排版设计标准",
    // 园区部品 8 + 社区大门 4（景观水景字/景墙案名/精神堡垒/入口地刻，魏浩 2026-08-16 归景观）
    firstLayerIds: [
      "SIGN-PARK-001", "SIGN-PARK-002", "SIGN-PARK-003", "SIGN-PARK-004", "SIGN-PARK-005",
      "SIGN-PARK-006", "SIGN-PARK-007", "SIGN-PARK-008",
      "SIGN-GATE-001", "SIGN-GATE-002", "SIGN-GATE-003", "SIGN-GATE-004",
    ],
  },
];

/** 2.4 排版规则（2026-08-16 魏浩定：去掉 D-VI-02，建筑不规定排版形式） */
export type ViRule = { id: string; name: string; rule: string };

/** 通用规则：三专业都适用 */
export const viCommonRules: ViRule[] = [
  { id: "D-VI-01", name: "三专业统一采用营销 VI", rule: "三专业应统一采用营销提供的 vi" },
  { id: "D-VI-03", name: "三专业标识符号明确统一", rule: "三专业的标识符号应明确统一" },
];

/** 专业专属排版规则（key = 专业 id）：建筑无专属（不规定排版形式） */
export const viTradeRules: Record<string, ViRule[]> = {
  "TRADE-ARCH": [],
  "TRADE-INT": [{ id: "D-VI-05", name: "精装采用功能icon＋名字", rule: "精装应采用“功能 icon＋名字”的形式" }],
  "TRADE-LAND": [{ id: "D-VI-04", name: "景观采用项目logo＋名字", rule: "景观应采用“项目 logo＋名字”的形式" }],
};
