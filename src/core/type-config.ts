/** Offline presentation & workflow vocabulary; pure data, independent of UI and SiYuan. */
export const TYPE_ICONS = [
  { name: "Shapes", label: "通用", keywords: "形状 分类 类型" },
  { name: "Lightbulb", label: "灵感", keywords: "想法 创意 点子 通用" },
  { name: "FileText", label: "文档", keywords: "文章 文件 文字" },
  { name: "NotebookPen", label: "笔记", keywords: "记录 日记 手帐" },
  { name: "BookOpen", label: "阅读", keywords: "书籍 学习 资料" },
  { name: "PenLine", label: "写作", keywords: "创作 编辑 文章" },
  { name: "Code2", label: "代码", keywords: "软件 开发 编程" },
  { name: "Terminal", label: "终端", keywords: "命令 脚本 开发" },
  { name: "Bug", label: "问题", keywords: "缺陷 调试 软件" },
  { name: "Wrench", label: "工具", keywords: "维修 构建 设置" },
  { name: "FlaskConical", label: "实验", keywords: "研究 科学 验证" },
  { name: "Rocket", label: "发布", keywords: "火箭 项目 启动" },
  { name: "Target", label: "目标", keywords: "计划 专注 任务" },
  { name: "Flag", label: "里程碑", keywords: "旗帜 目标 阶段" },
  { name: "CheckCircle2", label: "完成", keywords: "检查 确认 清单" },
  { name: "Circle", label: "圆点", keywords: "起点 简单 通用" },
  { name: "Folder", label: "文件夹", keywords: "分类 整理 资料" },
  { name: "Briefcase", label: "工作", keywords: "职业 项目 公文包" },
  { name: "CalendarDays", label: "日程", keywords: "日历 日期 安排" },
  { name: "Clock3", label: "时间", keywords: "时钟 等待 复查" },
  { name: "Plane", label: "旅行", keywords: "飞机 出行 旅游" },
  { name: "Map", label: "地图", keywords: "旅行 路线 地点" },
  { name: "Compass", label: "探索", keywords: "指南针 方向 旅行" },
  { name: "Mountain", label: "户外", keywords: "山峰 登山 徒步" },
  { name: "Camera", label: "摄影", keywords: "相机 照片 图片" },
  { name: "Music2", label: "音乐", keywords: "歌曲 乐器 声音" },
  { name: "Film", label: "影像", keywords: "电影 视频 剪辑" },
  { name: "Palette", label: "设计", keywords: "绘画 美术 颜色" },
  { name: "Heart", label: "生活", keywords: "喜欢 健康 关怀" },
  { name: "Dumbbell", label: "运动", keywords: "健身 锻炼 健康" },
  { name: "GraduationCap", label: "学习", keywords: "教育 课程 毕业" },
  { name: "Coffee", label: "休闲", keywords: "咖啡 饮食 休息" },
  { name: "Home", label: "家庭", keywords: "家居 房屋 生活" },
  { name: "ShoppingBag", label: "购物", keywords: "采购 清单 消费" },
  { name: "Gamepad2", label: "游戏", keywords: "娱乐 兴趣 手柄" },
  { name: "Leaf", label: "成长", keywords: "叶子 自然 植物" },
] as const;

export type TypeLucideIcon = (typeof TYPE_ICONS)[number]["name"];
export const TYPE_COLORS = ["default", "blue", "emerald", "amber", "violet", "rose"] as const;
export type TypeColor = (typeof TYPE_COLORS)[number];

export const ITEM_PRIORITIES = ["high", "medium", "low"] as const;
export const PRIORITY_LABELS = {
  high: "重点",
  medium: "常规",
  low: "随缘",
} as const;

export const DEFAULT_REVIEW_DAYS = 14;
export const REVIEW_DAY_PRESETS = [
  { value: 7, label: "7 天" },
  { value: 14, label: "14 天（默认）" },
  { value: 30, label: "30 天" },
  { value: 60, label: "60 天" },
  { value: null, label: "关闭复查提醒" },
] as const;

const iconNames = new Set<string>(TYPE_ICONS.map((icon) => icon.name));
const segmenter = new Intl.Segmenter("zh", { granularity: "grapheme" });

export function isTypeIcon(value: unknown): value is string {
  if (typeof value !== "string" || !value || value.length > 64) return false;
  if (iconNames.has(value)) return true;
  return (
    [...segmenter.segment(value)].length === 1 &&
    (/\p{Extended_Pictographic}/u.test(value) ||
      /^\p{Regional_Indicator}{2}$/u.test(value) ||
      /^[0-9#*]\uFE0F?\u20E3$/u.test(value))
  );
}

export function isTypeColor(value: unknown): value is TypeColor {
  return typeof value === "string" && (TYPE_COLORS as readonly string[]).includes(value);
}

export function isItemPriority(value: unknown): value is (typeof ITEM_PRIORITIES)[number] {
  return typeof value === "string" && (ITEM_PRIORITIES as readonly string[]).includes(value);
}

export function isValidReviewDays(value: unknown): value is number | null {
  if (value === null) return true;
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 1 && value <= 365;
}

export interface StageTemplateItem {
  name: string;
  completed: boolean;
  criteria?: readonly string[];
}

export interface StageTemplateConfig {
  label: string;
  defaultIcon: TypeLucideIcon;
  defaultColor: TypeColor;
  defaultReviewDays: number;
  defaultDocTemplate?: string;
  stages: readonly StageTemplateItem[];
}

export const STAGE_TEMPLATES = {
  basic: {
    label: "基础 · 想法到完成",
    defaultIcon: "Lightbulb",
    defaultColor: "amber",
    defaultReviewDays: 14,
    defaultDocTemplate: `# {{title}}

> {{description}}

## 进行中
- [ ] {{nextStep}}`,
    stages: [
      { name: "想法", completed: false },
      { name: "进行中", completed: false },
      { name: "完成", completed: true },
    ],
  },
  article: {
    label: "写作 · 选题到发布",
    defaultIcon: "PenLine",
    defaultColor: "blue",
    defaultReviewDays: 14,
    defaultDocTemplate: `# {{title}}

> {{description}}

## 选题
- 核心想回答的一个问题：
- 读者读完后的最大收获：

## 大纲素材
- 核心论点与章节结构：
- 关键案例 / 引用数据：

## 初稿
- （只管写完，暂不打磨措辞）

## 润色定稿
- 检查标题、首段与结论是否前后呼应`,
    stages: [
      {
        name: "选题",
        completed: false,
        criteria: ["一句话写清本文只回答哪一个核心问题", "明确目标读者与文章立意"],
      },
      {
        name: "大纲素材",
        completed: false,
        criteria: ["确定 3~5 个一级章节脉络", "补齐核心案例、数据或思源参考块"],
      },
      {
        name: "初稿",
        completed: false,
        criteria: ["一气呵成写完完整草稿（写完再改）", "补全结尾行动号召或总结"],
      },
      {
        name: "润色定稿",
        completed: false,
        criteria: ["通读删减冗余段落", "校准标题表达与排版细节"],
      },
      { name: "已发布", completed: true },
    ],
  },
  project: {
    label: "项目开发 · 构想到发布",
    defaultIcon: "Code2",
    defaultColor: "violet",
    defaultReviewDays: 7,
    defaultDocTemplate: `# {{title}}

> {{description}}

## 构想
- 真实痛点与触发场景：
- 为什么现在值得做：

## 方案设计
- 核心架构 / 交互方案：
- 本次坚决不做的边界（Non-goals）：

## 原型实现
- 下一步：{{nextStep}}

## 打磨验收
- 核心路径走查与边界测试记录：`,
    stages: [
      {
        name: "构想",
        completed: false,
        criteria: ["明确要解决的真实痛点", "确认个人做这件事的最小动机"],
      },
      {
        name: "方案设计",
        completed: false,
        criteria: [
          "一句话说清最小可行方案（MVP）",
          "明确本次不做的范围边界",
          "关键数据流或技术风险点已验证",
        ],
      },
      {
        name: "原型实现",
        completed: false,
        criteria: ["核心主流程端到端跑通", "关键边界与异常有兜底"],
      },
      {
        name: "打磨验收",
        completed: false,
        criteria: ["关键测试或真实环境走查通过", "补齐使用说明或记录总结"],
      },
      { name: "已发布", completed: true },
    ],
  },
  reading: {
    label: "阅读课题 · 想读到沉淀",
    defaultIcon: "BookOpen",
    defaultColor: "emerald",
    defaultReviewDays: 30,
    defaultDocTemplate: `# {{title}}

> {{description}}

## 想读
- 带着什么具体问题去读：

## 在读摘录
- 关键原文摘录与出处：

## 消化整理
- 用自己的话转述核心观点（可拆成独立卡片）：`,
    stages: [
      {
        name: "想读",
        completed: false,
        criteria: ["写下带着阅读的 1~2 个具体问题"],
      },
      {
        name: "在读摘录",
        completed: false,
        criteria: ["记录核心原文摘录与自己当下的批注"],
      },
      {
        name: "消化整理",
        completed: false,
        criteria: ["用自己的话写一段核心复盘结论"],
      },
      { name: "已沉淀", completed: true },
    ],
  },
  travel: {
    label: "旅行 · 想去到结束",
    defaultIcon: "Compass",
    defaultColor: "emerald",
    defaultReviewDays: 30,
    defaultDocTemplate: `# {{title}}

> {{description}}

## 规划
- 出行时间窗口与同行人：
- 每日主线安排与必去点：

## 已预订
- 交通与住宿确认信息：`,
    stages: [
      { name: "想去", completed: false },
      { name: "规划", completed: false, criteria: ["确定大致时间窗与交通方式", "拟定每日主线行程"] },
      { name: "已预订", completed: false, criteria: ["核对机票/车票与住宿订单"] },
      { name: "已结束", completed: true },
    ],
  },
  blank: {
    label: "极简 · 仅一个起始阶段",
    defaultIcon: "Shapes",
    defaultColor: "default",
    defaultReviewDays: 14,
    stages: [{ name: "想法", completed: false }],
  },
} as const satisfies Record<string, StageTemplateConfig>;

export type StageTemplateId = keyof typeof STAGE_TEMPLATES;
