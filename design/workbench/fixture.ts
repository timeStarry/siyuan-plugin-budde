import { createInitialState } from "../../src/core/service";
import type { BuddeState, Item } from "../../src/core/types";

export const DEMO_NOW = "2026-11-11T00:00:00.000Z";
export const DEMO_NOTES = [
  { id: "20260101000000-demo001", title: "照片整理工具 · 界面草图" },
  { id: "20260101000000-demo002", title: "一个可以慢慢写的文章提纲" },
];

export function createDemoState(): BuddeState {
  const state = createInitialState();
  const make = (id: string, title: string, typeId: string, stage: number, patch: Partial<Item> = {}): Item => ({
    id, title, typeId, stageId: `${typeId}-${stage}`, description: "", nextStep: "", links: [],
    promoted: true, paused: false, archived: false,
    createdAt: "2026-10-20T00:00:00.000Z", updatedAt: "2026-11-08T00:00:00.000Z",
    reviewedAt: "2026-11-08T00:00:00.000Z", version: 1, ...patch,
  });
  state.items = [
    make("demo-general-1", "给阳台留一个阅读角", "general", 0, { paused: true, reviewedAt: "2026-10-20T00:00:00.000Z" }),
    make("demo-general-2", "把工作台整理得轻一点", "general", 1, { nextStep: "列出真正需要留在桌面的三样东西" }),
    make("demo-article-1", "整理那些还没写完的读书笔记", "article", 0, { paused: true }),
    make("demo-article-2", "写一篇关于缓慢工作的文章", "article", 1, { nextStep: "先写一段具体的工作片段", links: [
      { id: "demo-link-2", target: `siyuan://blocks/${DEMO_NOTES[1].id}`, title: DEMO_NOTES[1].title, role: "reference" },
    ] }),
    make("demo-article-3", "分享一次无计划的散步", "article", 3),
    make("demo-software-1", "让订阅内容可以稍后再读", "software", 0, { paused: true }),
    make("demo-software-2", "做一个简洁的阅读计时器", "software", 0),
    make("demo-software-3", "给照片做一个本地整理工具", "software", 1, {
      description: "先验证整理照片的流程，而不是从完整图库开始。\n\n只做自己愿意每天打开的那一小部分。",
      nextStep: "画出导入后第一次整理的界面", reviewedAt: "2026-10-20T00:00:00.000Z", links: [
        { id: "demo-link-1", target: `siyuan://blocks/${DEMO_NOTES[0].id}`, title: DEMO_NOTES[0].title, role: "reference" },
      ],
    }),
    make("demo-software-4", "把常用命令放在一个地方", "software", 2, { nextStep: "试用一次键盘搜索流程" }),
    make("demo-software-5", "让清单导出更省心", "software", 3),
    make("demo-travel-1", "找个周末去看看海", "travel", 0, { paused: true }),
    make("demo-travel-2", "安排一次山间小住", "travel", 1, { nextStep: "比较两个能坐火车到达的地方" }),
    make("demo-pool-1", "把偶然想到的小问题记下来", "general", 0, { promoted: false, reviewedAt: null }),
    make("demo-pool-2", "写写那些没有效率目标的时刻", "article", 0, { promoted: false, reviewedAt: null }),
    make("demo-archive-1", "以前试过的键盘小工具", "software", 2, { archived: true }),
  ];
  return state;
}
