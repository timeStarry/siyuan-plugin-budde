import { chromium, expect } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import path from 'node:path';
import { startPreview } from './preview.mjs';

// Synthetic approved examples only. Never reads a real SiYuan workspace.
const output = `artifacts/qa/visual-parity/${process.env.PARITY_BASELINE ? 'before' : 'current'}`;
await mkdir(output, { recursive: true });
const preview = await startPreview();
const browser = await chromium.launch({ channel: 'msedge', headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
const checks = [];
const check = async (name, run) => { try { await run(); checks.push({ name, passed: true }); } catch (e) { checks.push({ name, passed: false, error: e.message }); } };
try {
  await page.goto(preview.url);
  await expect(page.locator('[data-part="capture-title"]')).toBeEnabled();
  await page.evaluate(async () => {
    const { client, view } = window.buddeTest;
    const titles = ['让订阅内容可以稍后再读', '做一个简洁的阅读计时器', '给照片做一个本地整理工具', '把常用命令放在一个地方', '让清单导出更省心'];
    for (let n = 0; n < titles.length; n++) {
      const result = await client.execute({ kind: 'item.create', requestId: crypto.randomUUID(), title: titles[n], typeId: 'software' });
      const item = result.state.items.find(i => i.id === result.itemId);
      const type = result.state.types.find(t => t.id === 'software');
      const updated = await client.execute({ kind: 'item.update', id: item.id, expectedVersion: item.version, patch: {
        promoted: true, paused: n === 0, stageId: type.stages[Math.max(0, n - 1)].id,
        nextStep: n === 2 ? '画出导入后第一次整理的界面' : n === 3 ? '试用一次键盘搜索流程' : '',
        description: n === 2 ? '经常拍很多照片，但整理这件事总是拖着。\n\n先做一个只在本地使用的小工具，能按拍摄时间和地点分组。' : '',
        links: n === 2 ? [{ id: 'fixture-note', target: 'siyuan://blocks/20260101000000-demo001', title: '照片整理工具 · 初步想法', role: 'reference' }] : [],
      } });
      if (n === 2) await client.execute({ kind: 'item.update', id: item.id, expectedVersion: updated.state.items.find(i => i.id === item.id).version, patch: { reviewedAt: '2000-01-01T00:00:00.000Z' } });
    }
    await view.refresh();
  });
  await page.locator('[data-view="board"]').click();
  await page.locator('[data-board-type="software"]').click();
  await page.getByRole('button', { name: '给照片做一个本地整理工具', exact: true }).click();
  await expect(page.locator('.detail-read')).toBeVisible();
  const reference = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  await reference.goto(pathToFileURL(path.resolve('design/workbench-v2-preview/index.html')).href);
  // Remove only the static-preview disclosure footer, absent from the real plugin.
  await reference.addStyleTag({ content: '.preview-bar{display:none}.app{grid-template-rows:var(--layout-header) var(--layout-capture) minmax(0,1fr)}' });
  for (const theme of ['light', 'dark']) {
    await page.locator('.budde').evaluate((root, theme) => root.dataset.theme = theme, theme);
    await reference.locator(`[data-theme-choice="${theme}"]`).evaluate(button => button.click());
    await page.screenshot({ animations: 'disabled', path: `${output}/production-${theme}-board.png` });
    await reference.screenshot({ animations: 'disabled', path: `${output}/reference-${theme}-board.png` });
  }
  await check('all main navigation and archive icons are rendered', async () => {
    for (const [view, icon] of [['pool', 'pool'], ['board', 'board'], ['active', 'active'], ['archive', 'archive']])
      await expect(page.locator(`[data-view="${view}"] svg[data-icon="${icon}"]`)).toHaveCount(1);
  });
  await check('type index, search and stage heading icons are rendered', async () => {
    await expect(page.locator('[data-board-type="software"] [data-type-icon]')).toHaveAttribute('data-color', 'default');
    await expect(page.locator('[data-board-type="software"] [data-type-icon] svg')).toHaveClass(/lucide-shapes/);
    await expect(page.locator('.search-field svg[data-icon="search"]')).toHaveCount(1);
    await expect(page.locator('.stage-heading > span:first-child svg')).toHaveCount(4);
    await expect(page.locator('.stage-heading [data-menu-trigger] svg')).toHaveCount(4);
  });
  await check('reading toolbar and footer use edit, pause, check and archive SVGs', async () => {
    await expect(page.locator('.detail-heading [data-detail-action="edit"] svg[data-icon="edit"]')).toHaveCount(1);
    for (const [action, icon] of [['pause', 'pause'], ['review', 'check'], ['archive', 'archive']])
      await expect(page.locator(`.detail-footer [data-detail-action="${action}"] svg[data-icon="${icon}"]`)).toHaveCount(1);
  });
  await check('Lucide functional icons and the original brand retain 16px/24px geometry and decoration semantics', async () => {
    const icons = await page.locator('svg[data-icon]').evaluateAll(nodes => nodes.filter(n => n.getBoundingClientRect().width).map(n => ({ name: n.dataset.icon, lucide: n.classList.contains('lucide'), width: n.getBoundingClientRect().width, height: n.getBoundingClientRect().height, stroke: getComputedStyle(n).strokeWidth, hidden: n.getAttribute('aria-hidden') })));
    expect(icons.length).toBeGreaterThan(25);
    for (const icon of icons) {
      expect(icon.lucide, icon.name).toBe(icon.name !== 'brand');
      expect(icon.width).toBe(icon.name === 'brand' ? 24 : 16);
      expect(icon.height).toBe(icon.width); expect(icon.stroke).toBe(icon.name === 'brand' ? '1.75px' : '1.5px'); expect(icon.hidden).toBe('true');
    }
  });
  await page.waitForFunction(() => !document.querySelector('[data-motion-busy="true"]'));
  await check('header, capture and attached reading panel follow current Zinc geometry', async () => {
    const geometry = await page.evaluate(() => {
      const rect = selector => { const r = document.querySelector(selector).getBoundingClientRect(); return { x: r.x, y: r.y, width: r.width, height: r.height, right: r.right, bottom: r.bottom }; };
      return { header: rect('.app-header'), capture: rect('[data-part="capture"]'), nav: rect('.main-nav'), detail: rect('.detail-pane'), title: rect('.view-heading'), index: rect('[data-part="type-index"]'), workspace: rect('.workspace') };
    });
    expect(geometry.header.height).toBe(64); expect(geometry.capture.height).toBe(62);
    expect(geometry.nav.x).toBe(192); expect(geometry.title.x).toBe(200);
    expect(geometry.index.width).toBe(176); expect(geometry.detail.width).toBe(420);
    expect(geometry.detail.right).toBe(1440); expect(geometry.detail.y).toBe(geometry.workspace.y); expect(geometry.detail.bottom).toBe(1000);
  });
  await check('capture input and ghost navigation stay quiet; native select retains a clear boundary', async () => {
    const styles = await page.evaluate(() => Object.fromEntries(['[data-part="capture-title"]', '[data-part="create-type"]', '[data-view="board"]'].map(selector => [selector, getComputedStyle(document.querySelector(selector)).borderColor])));
    expect(styles['[data-part="capture-title"]']).toBe('rgba(0, 0, 0, 0)');expect(styles['[data-view="board"]']).toBe('rgba(0, 0, 0, 0)');expect(styles['[data-part="create-type"]']).toBe('rgb(63, 63, 70)');
  });
  await check('quiet Zinc columns, next-step callout and note hover/pressed affordances', async () => {
    expect(await page.locator('.stage-column').first().evaluate(n => getComputedStyle(n).backgroundColor)).toBe('rgba(39, 39, 42, 0.7)');
    await expect(page.locator('.next-step svg[data-icon="arrow"]')).toHaveCount(1);
    await expect(page.locator('.detail-read .item-context svg')).toHaveCount(3);
    await expect(page.locator('.note-link svg[data-icon="open"]')).toHaveCount(1);
    const note = page.locator('.note-link');
    const settle = () => note.evaluate(n => Promise.all(n.getAnimations().map(a => a.finished.catch(() => {}))));
    await note.hover(); await settle(); await expect(note).toHaveCSS('border-color', 'rgba(0, 0, 0, 0)');
    await page.mouse.down();
    try { await settle(); await expect(note).toHaveCSS('border-color', 'rgba(0, 0, 0, 0)'); } finally { await page.mouse.up(); }
    expect(await page.locator('.detail-footer [data-detail-action="pause"]').evaluate(n => getComputedStyle(n).borderColor)).toBe('rgba(0, 0, 0, 0)');
  });
  await page.evaluate(async () => {
    const { client, view } = window.buddeTest;
    let state = await client.snapshot();
    for (const [index, stage] of state.types.find(t => t.id === 'software').stages.entries()) {
      state = (await client.execute({ kind: 'stage.update', typeId: 'software', id: stage.id, expectedRevision: state.revision, name: `自定义阶段 ${index + 1}：较长的阶段名称完整换行、不横向滚动`, completed: stage.completed })).state;
    }
    await view.refresh();
  });
  for (const width of [1024, 720, 480, 320]) {
    await page.setViewportSize({ width, height: 900 });
    await check(`${width}px detail overlay, SVG controls and long path remain usable`, async () => {
      await expect(page.locator('.detail-pane')).toHaveAttribute('role', 'dialog');
      const metrics = await page.evaluate(() => ({ outer: document.documentElement.scrollWidth - innerWidth, detail: document.querySelector('.detail-pane').getBoundingClientRect().width }));
      expect(metrics.outer).toBeLessThanOrEqual(1); expect(metrics.detail).toBe(Math.min(width,420));
      expect(await page.locator('.stage-path ol').evaluate(n => n.scrollWidth - n.clientWidth)).toBeLessThanOrEqual(1);
      await expect(page.locator('.stage-path ol')).toHaveAttribute('aria-label', '可点击的垂直阶段时间轴');
      const labels = await page.locator('.path-label').evaluateAll(nodes => nodes.map(n => { const r = n.getBoundingClientRect(); return { top: r.top, bottom: r.bottom, overflow: getComputedStyle(n).textOverflow, whiteSpace: getComputedStyle(n).whiteSpace }; }));
      expect(labels.every(label => label.overflow !== 'ellipsis' && label.whiteSpace !== 'nowrap')).toBe(true);
      expect(labels.slice(1).every((label, i) => label.top >= labels[i].bottom + 8), 'wrapped vertical path labels must not overlap').toBe(true);
      const stageButtons = page.locator('.stage-path button'); await stageButtons.first().focus(); await page.keyboard.press('Tab'); await expect(stageButtons.nth(1)).toBeFocused();
      await expect(page.locator('[data-detail-action="edit"]')).toBeVisible();
    });
    await page.screenshot({ animations: 'disabled', path: `${output}/production-dark-${width}-detail.png` });
  }
  // Exercise the pool state using synthetic items and the long custom lifecycle.
  await page.locator('[data-detail-action="close"]').click();
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.locator('[data-view="pool"]').click();
  await page.screenshot({ animations: 'disabled', path: `${output}/production-dark-pool.png` });
  await writeFile(`${output}/results.json`, JSON.stringify({ scope: 'Current ui-design-system.md contract and retained interaction regressions; static reference screenshots are historical, not the current contract. Isolated fixture, not native-host acceptance', checks }, null, 2));
  const failures = checks.filter(c => !c.passed);
  console.log(JSON.stringify({ checks: checks.length, passed: checks.length - failures.length, failures, screenshots: output }, null, 2));
  if (failures.length) process.exitCode = 1;
} finally { await browser.close(); await preview.close(); }
