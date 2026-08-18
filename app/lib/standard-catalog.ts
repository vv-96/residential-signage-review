export type StandardItem = { id: string; category: string; name: string };

export type StageName = "大区" | "示范区" | "全期阶段";

export type CategoryApplicability = "必选" | "条件必选" | "不适用";

export type StageMatrixEntry = {
  category: string;
  大区: CategoryApplicability;
  示范区: CategoryApplicability;
  全期阶段: CategoryApplicability;
  condition?: string;
  matrixReviewer: string;
  matrixReviewDate: string;
};

const catalogText = `
SIGN-GATE-001|社区大门|景观水景字
SIGN-GATE-002|社区大门|景墙案名
SIGN-GATE-003|社区大门|精神堡垒
SIGN-GATE-004|社区大门|入口地刻
SIGN-PARK-001|园区部品|总平图
SIGN-PARK-002|园区部品|公告栏
SIGN-PARK-003|园区部品|楼栋单元指引
SIGN-PARK-004|园区部品|景观主题指示
SIGN-PARK-005|园区部品|果皮箱
SIGN-PARK-006|园区部品|树牌
SIGN-PARK-007|园区部品|温馨提示牌
SIGN-PARK-008|园区部品|宠物便便箱
SIGN-UNIT-001|单元门头|楼栋号
SIGN-UNIT-002|单元门头|单元号
SIGN-UNIT-003|单元门头|可视对讲
SIGN-UNIT-004|单元门头|单元门头地刻
SIGN-UNIT-005|单元门头|单元景墙
SIGN-BLDG-001|楼区公区|首层物业公告栏
SIGN-BLDG-002|楼区公区|疏散指示牌
SIGN-BLDG-003|楼区公区|楼层号
SIGN-BLDG-004|楼区公区|乘梯须知
SIGN-BLDG-005|楼区公区|门牌号
SIGN-BLDG-006|楼区公区|管井门标识
SIGN-CAR-001|地库出入口|停车引导立牌
SIGN-CAR-002|地库出入口|限高标识
SIGN-CAR-003|地库出入口|龙门标识
SIGN-CAR-004|地库出入口|前厅背景墙
SIGN-CAR-005|地下车库|车位吊牌
SIGN-CAR-006|地下车库|车道指引
SIGN-CAR-007|地下光厅|柱面-楼栋号
SIGN-CAR-008|地下光厅|墙面-单元号
SIGN-CAR-009|地下光厅|墙面-铭牌
SIGN-SALES-001|售楼处会所|接待台
SIGN-SALES-002|售楼处会所|名牌架
SIGN-SALES-003|售楼处会所|雨伞架
SIGN-SALES-004|售楼处会所|展示架
SIGN-SALES-005|售楼处会所|户型资料架
SIGN-SALES-006|售楼处会所|公示物料转轴
SIGN-SALES-007|售楼处会所|电子沙盘操作台
SIGN-SALES-008|售楼处会所|台卡
SIGN-SALES-009|售楼处会所|路锥
SIGN-SALES-010|售楼处会所|岗亭
SIGN-SALES-011|售楼处会所|一米栏
SIGN-SALES-012|售楼处会所|温馨提示牌
SIGN-SALES-013|售楼处会所|财务室牌
SIGN-SALES-014|售楼处会所|漫空间标识
SIGN-SALES-015|售楼处会所|卫生间
SIGN-SALES-016|售楼处会所|落地水牌
SIGN-MODEL-001|样板房|户型图
SIGN-MODEL-002|样板房|配置标准
SIGN-MODEL-003|样板房|非标差异产品提示`;

export const STANDARD_CATALOG: StandardItem[] = catalogText.trim().split("\n").map((line) => {
  const [id, category, name] = line.split("|");
  return { id, category, name };
});

export function standardsForScope(scope: string[]) {
  return STANDARD_CATALOG.filter((item) => scope.includes(item.category));
}

/**
 * 阶段适用矩阵 v1.0-rc2（2026-08-14 业务负责人魏浩确认）。
 * 数据源：`标准库_v1.0-rc2/阶段适用矩阵_v1.0-rc2.csv`。
 * 说明：矩阵按二级分类确认适用性；逐项匹配规则仍待逐项复核。
 */
export const STAGE_MATRIX: StageMatrixEntry[] = [
  { category: "社区大门", 大区: "必选", 示范区: "条件必选", 全期阶段: "必选", condition: "示范区实际包含社区入口时适用", matrixReviewer: "魏浩", matrixReviewDate: "2026-08-14" },
  { category: "园区部品", 大区: "必选", 示范区: "条件必选", 全期阶段: "必选", condition: "示范区实际开放园区范围时适用", matrixReviewer: "魏浩", matrixReviewDate: "2026-08-14" },
  { category: "单元门头", 大区: "必选", 示范区: "条件必选", 全期阶段: "必选", condition: "示范区实际开放单元时适用", matrixReviewer: "魏浩", matrixReviewDate: "2026-08-14" },
  { category: "楼区公区", 大区: "必选", 示范区: "不适用", 全期阶段: "必选", condition: "第一层种类完整性审核采用此口径", matrixReviewer: "魏浩", matrixReviewDate: "2026-08-14" },
  { category: "地库出入口", 大区: "必选", 示范区: "不适用", 全期阶段: "必选", condition: "第一层种类完整性审核采用此口径", matrixReviewer: "魏浩", matrixReviewDate: "2026-08-14" },
  { category: "地下车库", 大区: "必选", 示范区: "不适用", 全期阶段: "必选", condition: "第一层种类完整性审核采用此口径", matrixReviewer: "魏浩", matrixReviewDate: "2026-08-14" },
  { category: "地下光厅", 大区: "必选", 示范区: "不适用", 全期阶段: "必选", condition: "第一层种类完整性审核采用此口径", matrixReviewer: "魏浩", matrixReviewDate: "2026-08-14" },
  { category: "售楼处会所", 大区: "不适用", 示范区: "条件必选", 全期阶段: "必选", condition: "示范区包含售楼处或会所时适用；售楼处会所属于提交范围，不再单列为项目阶段", matrixReviewer: "魏浩", matrixReviewDate: "2026-08-14" },
  { category: "样板房", 大区: "不适用", 示范区: "条件必选", 全期阶段: "必选", condition: "示范区设置并开放样板房时适用；样板房属于提交范围，不再单列为项目阶段", matrixReviewer: "魏浩", matrixReviewDate: "2026-08-14" },
];

export function applicabilityFor(stage: StageName, category: string): CategoryApplicability {
  const entry = STAGE_MATRIX.find((item) => item.category === category);
  return entry ? entry[stage] : "不适用";
}

export function categoryCondition(category: string): string | undefined {
  return STAGE_MATRIX.find((item) => item.category === category)?.condition;
}

export type AuditScopeResult = {
  /** 本次应审的标准项（按阶段矩阵：必选 + 条件必选且已纳入提交范围） */
  items: StandardItem[];
  /** 本次应审的二级分类（含适用性） */
  categories: Array<{ name: string; applicability: CategoryApplicability; condition?: string }>;
  /** 被判定为不适用、不纳入应审的分类 */
  excludedCategories: Array<{ name: string; applicability: CategoryApplicability; condition?: string }>;
};

/**
 * 按“项目阶段 + 业务提交范围”生成临时应审清单。
 * 规则：
 * 1. 提交范围之外的分类不纳入（乙方未声明覆盖）。
 * 2. 提交范围内，矩阵为“必选”或“条件必选”的分类纳入应审；勾选条件必选分类视为声明满足该条件。
 * 3. 矩阵为“不适用”的分类即使勾选也不纳入，并单独提示。
 * 4. 只生成临时应审清单，不自动形成正式缺失判断。
 */
export function buildAuditScope(stage: StageName, selectedCategories: string[]): AuditScopeResult {
  const included: Array<{ name: string; applicability: CategoryApplicability; condition?: string }> = [];
  const excluded: Array<{ name: string; applicability: CategoryApplicability; condition?: string }> = [];

  for (const category of selectedCategories) {
    const applicability = applicabilityFor(stage, category);
    const condition = categoryCondition(category);
    if (applicability === "不适用") excluded.push({ name: category, applicability, condition });
    else included.push({ name: category, applicability, condition });
  }

  const includedNames = new Set(included.map((item) => item.name));
  const items = STANDARD_CATALOG.filter((item) => includedNames.has(item.category));

  return { items, categories: included, excludedCategories: excluded };
}
