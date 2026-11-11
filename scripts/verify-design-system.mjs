import { chromium, expect } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
import { startPreview } from './preview.mjs';

const output = 'artifacts/qa/zinc-react';
await mkdir(output, { recursive: true });
const preview = await startPreview();
const browser = await chromium.launch({ channel: 'msedge', headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
page.setDefaultTimeout(5000);
const checks = [];
const check = async (name, run) => { try { await run(); checks.push({ name, passed: true }); } catch (error) { checks.push({ name, passed: false, error: error.message }); } };
const errors = [];
page.on('pageerror', error => errors.push(error.message));
const settle = async () => {
  await page.evaluate(() => document.fonts.ready);
  await page.waitForFunction(() => !document.querySelector('[data-motion-busy="true"]'));
  await page.evaluate(() => Promise.all(document.getAnimations().map(a => a.finished.catch(() => {}))));
};
try {
  await page.goto(preview.url);
  await expect(page.locator('[data-part="capture-title"]')).toBeEnabled();
  await page.evaluate(async () => {
    const { client, view } = window.buddeTest;
    const titles = ['把零散的阅读整理成一条清晰线索', '做一个只在本地使用的照片整理工具', '给常用操作加一条键盘路径', 'SuperLongUnbrokenSyntheticTitleToExerciseTruncationWithoutBreakingTheBoardEdge'];
    for (let n = 0; n < titles.length; n++) {
      const created = await client.execute({ kind: 'item.create', requestId: crypto.randomUUID(), title: titles[n], typeId: 'software' });
      const item = created.state.items.find(i => i.id === created.itemId);
      const type = created.state.types.find(t => t.id === item.typeId);
      await client.execute({ kind: 'item.update', id: item.id, expectedVersion: item.version, patch: { promoted: true, stageId: type.stages[n % type.stages.length].id, nextStep: '先画出第一步，再决定是否继续。下一步摘要需要保持两行以内，而不是把卡片不断撑高。', description: '合成验收内容，不来自真实思源工作空间。' } });
    }
    await view.refresh();
  });
  await page.locator('[data-view="board"]').click();
  await page.locator('[data-board-type="software"]').click();
  for (const [width, height] of [[1440, 900], [1280, 800]]) {
    await page.setViewportSize({ width, height });
    await settle();
    await check(`${width}: exact light surfaces, 1px borders and density`, async () => {
      const style = await page.evaluate(() => {
        const get = s => getComputedStyle(document.querySelector(s));
        return { workspace: get('.budde').backgroundColor, column: get('.stage-column').backgroundColor, card: get('.item-card').backgroundColor, line: get('.item-card').borderColor, border: get('.item-card').borderWidth, padding: get('.item-card').padding, gap: get('.stage-items').gap, title: get('.card-title').fontSize, weight: get('.card-title').fontWeight, count: get('.count').fontVariantNumeric };
      });
      expect(style.workspace).toBe('rgb(249, 250, 251)');
      expect(['rgb(243, 244, 246)', 'rgba(243, 244, 246, 0.7)']).toContain(style.column);
      expect(style.card).toBe('rgb(255, 255, 255)'); expect(style.line).toBe('rgb(228, 228, 231)'); expect(style.border).toBe('1px');
      expect(style.padding).toBe('14px'); expect(style.gap).toBe('10px'); expect(style.title).toBe('14px'); expect(style.weight).toBe('500'); expect(style.count).toContain('tabular-nums');
    });
    await check(`${width}: columns retain 240px minimum and title/count separation`, async () => {
      const columns = await page.locator('.stage-column').evaluateAll(nodes => nodes.map(node => {
        const title = node.querySelector('h2').getBoundingClientRect(); const count = node.querySelector('.count').getBoundingClientRect();
        return { width: node.getBoundingClientRect().width, titleRight: title.right, countLeft: count.left, titleHeight: title.height };
      }));
      expect(columns.length).toBeGreaterThan(2);
      for (const column of columns) { expect(column.width).toBeGreaterThanOrEqual(240); expect(column.titleRight).toBeLessThan(column.countLeft); expect(column.titleHeight).toBeLessThanOrEqual(20); }
    });
    await page.screenshot({ path: `${output}/${width}x${height}-board.png`, animations: 'disabled' });
    await page.getByRole('button', { name: '做一个只在本地使用的照片整理工具', exact: true }).click();
    await expect(page.locator('.detail-read')).toBeVisible(); await settle();
    await check(`${width}: drawer owns scrolling and 24px content padding`, async () => {
      const geometry = await page.evaluate(() => {
        const root = document.querySelector('.budde'); const detail = document.querySelector('.detail-body'); const collection = document.querySelector('[data-part="collection"]');
        const style = getComputedStyle(detail);
        return { outerX: document.documentElement.scrollWidth > innerWidth, outerY: document.documentElement.scrollHeight > innerHeight, rootX: root.scrollWidth > root.clientWidth, rootY: root.scrollHeight > root.clientHeight, padding: style.padding, detailOverflow: style.overflowY, boardOverflow: getComputedStyle(collection).overflowX, detailRight: document.querySelector('.detail-pane').getBoundingClientRect().right };
      });
      expect(geometry.outerX).toBe(false); expect(geometry.outerY).toBe(false); expect(geometry.rootX).toBe(false); expect(geometry.rootY).toBe(false);
      expect(geometry.padding).toBe('24px'); expect(geometry.detailOverflow).toBe('auto'); expect(geometry.boardOverflow).toBe('auto'); expect(geometry.detailRight).toBeLessThanOrEqual(width);
    });
    await page.screenshot({ path: `${output}/${width}x${height}-detail.png`, animations: 'disabled' });
    await page.locator('[data-detail-action="close"]').click();
    await expect(page.locator('.detail-pane')).toHaveCount(0);
    await settle();
  }
  await check('Lucide icons have consistent geometry and accessible decoration', async () => {
    const icons = await page.locator('svg[data-icon]').evaluateAll(nodes => nodes.filter(n => n.getBoundingClientRect().width).map(n => ({ name: n.dataset.icon, lucide: n.classList.contains('lucide'), width: n.getBoundingClientRect().width, stroke: getComputedStyle(n).strokeWidth, hidden: n.getAttribute('aria-hidden') })));
    expect(icons.length).toBeGreaterThan(20);
    for (const icon of icons) { expect(icon.lucide, icon.name).toBe(icon.name !== 'brand'); expect(icon.width).toBe(icon.name === 'brand' ? 24 : 16); expect(icon.stroke).toBe(icon.name === 'brand' ? '1.75px' : '1.5px'); expect(icon.hidden).toBe('true'); }
  });
  await check('real dnd-kit pointer drag shows translucent overlay and commits stage movement', async () => {
    const source = page.locator('.stage-column').first();
    const handle = source.locator('[data-drag-handle]').first();
    const itemId = await source.locator('[data-item-id]').first().getAttribute('data-item-id');
    const target = page.locator('.stage-column').nth(1);
    const stageId = await target.getAttribute('data-stage-id');
    const a = await handle.boundingBox(); const b = await target.boundingBox();
    await page.mouse.move(a.x + a.width / 2, a.y + a.height / 2); await page.mouse.down();
    await page.mouse.move(a.x + a.width / 2 + 20, a.y + a.height / 2 + 20, { steps: 4 });
    await expect(page.locator('[data-drag-overlay]')).toBeVisible();
    expect(Number(await page.locator('[data-drag-overlay]').evaluate(n => getComputedStyle(n).opacity))).toBeLessThan(1);
    await page.mouse.move(b.x + b.width / 2, b.y + 130, { steps: 12 }); await page.mouse.up();
    await expect(target.locator(`[data-item-id="${itemId}"]`)).toHaveCount(1);
    expect(await page.evaluate(async id => (await window.buddeTest.client.snapshot()).items.find(i => i.id === id).stageId, itemId)).toBe(stageId);
  });
  await check('Zinc dark tokens remain local and readable', async () => {
    await page.locator('.budde').evaluate(root => root.dataset.theme = 'dark');
    await expect(page.locator('.item-card').first()).toHaveCSS('background-color', 'rgb(24, 24, 27)');
    await expect(page.locator('.item-card').first()).toHaveCSS('color', 'rgb(244, 244, 245)');
    await page.screenshot({ path: `${output}/1280x800-dark.png`, animations: 'disabled' });
  });
  await check('preview has no uncaught browser errors', async () => expect(errors).toEqual([]));
} finally { await browser.close(); await preview.close(); }
await writeFile(`${output}/report.json`, JSON.stringify({ checks }, null, 2));
console.log(JSON.stringify(checks, null, 2));
if (checks.some(check => !check.passed)) process.exitCode = 1;
