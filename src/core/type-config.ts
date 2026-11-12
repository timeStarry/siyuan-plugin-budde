/** Offline presentation vocabulary; pure data, independent of UI and SiYuan. */
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

export function isValidReviewDays(value: unknown): value is number | null {
  if (value === null) return true;
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 1 && value <= 365;
}

export const STAGE_TEMPLATES = {
  basic: {
    label: "基础 · 想法到完成",
    defaultIcon: "Lightbulb",
    defaultColor: "amber" as TypeColor,
    defaultReviewDays: 14,
    stages: [
      { name: "想法", completed: false },
      { name: "进行中", completed: false },
      { name: "完成", completed: true },
    ],
  },
  article: {
    label: "文章 · 选题到发布",
    defaultIcon: "PenLine",
    defaultColor: "blue" as TypeColor,
    defaultReviewDays: 14,
    stages: [
      { name: "选题", completed: false },
      { name: "写作", completed: false },
      { name: "修改", completed: false },
      { name: "已发布", completed: true },
    ],
  },
  software: {
    label: "软件 · 想法到发布",
    defaultIcon: "Code2",
    defaultColor: "violet" as TypeColor,
    defaultReviewDays: 7,
    stages: [
      { name: "想法", completed: false },
      { name: "验证", completed: false },
      { name: "开发", completed: false },
      { name: "已发布", completed: true },
    ],
  },
  travel: {
    label: "旅行 · 想去到结束",
    defaultIcon: "Compass",
    defaultColor: "emerald" as TypeColor,
    defaultReviewDays: 30,
    stages: [
      { name: "想去", completed: false },
      { name: "规划", completed: false },
      { name: "已预订", completed: false },
      { name: "已结束", completed: true },
    ],
  },
  blank: {
    label: "极简 · 仅一个起始阶段",
    defaultIcon: "Shapes",
    defaultColor: "default" as TypeColor,
    defaultReviewDays: 14,
    stages: [{ name: "想法", completed: false }],
  },
} as const;

export type StageTemplateId = keyof typeof STAGE_TEMPLATES;
