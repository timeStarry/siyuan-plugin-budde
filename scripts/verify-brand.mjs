import { chromium, expect } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
import { startPreview } from './preview.mjs';

const output = 'artifacts/qa/brand-quicksand';
await mkdir(output, { recursive: true });
const preview = await startPreview();
const browser = await chromium.launch({ channel: 'msedge', headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 });
const checks = [], measurements = [], externalRequests = [], errors = [];
page.on('pageerror', error => errors.push(error.message));
page.on('request', request => {
  if (/^https?:/.test(request.url()) && new URL(request.url()).origin !== preview.url) externalRequests.push(request.url());
});
const check = async (name, run) => {
  try { await run(); checks.push({ name, passed: true }); }
  catch (error) { checks.push({ name, passed: false, error: error.message }); }
};
const contrast = (a, b) => {
  const luminance = rgb => rgb.match(/[\d.]+/g).slice(0, 3).map(Number).map(x => { x /= 255; return x <= .04045 ? x / 12.92 : ((x + .055) / 1.055) ** 2.4; }).reduce((sum, x, i) => sum + x * [.2126, .7152, .0722][i], 0);
  const x = luminance(a), y = luminance(b);
  return (Math.max(x, y) + .05) / (Math.min(x, y) + .05);
};
try {
  await page.goto(preview.url);
  await expect(page.locator('[data-part="capture-title"]')).toBeEnabled();
  await page.evaluate(async () => {
    const { client, view } = window.buddeTest;
    for (const [n, title] of ['把零散想法整理成一条清晰线索', '给常用操作加一条键盘路径', '让下一步足够小，随时能够开始'].entries()) {
      const result = await client.execute({ kind: 'item.create', requestId: crypto.randomUUID(), title, typeId: 'software' });
      const item = result.state.items.find(i => i.id === result.itemId);
      const type = result.state.types.find(t => t.id === item.typeId);
      await client.execute({ kind: 'item.update', id: item.id, expectedVersion: item.version, patch: { promoted: true, stageId: type.stages[n % type.stages.length].id, nextStep: '先写下一个能在今天完成的小动作。' } });
    }
    await view.refresh();
  });
  await page.locator('[data-view="board"]').click();
  await page.locator('[data-board-type="software"]').click();
  await page.evaluate(() => document.fonts.ready);
  await check('actual offline Quicksand face loads and the wordmark uses real weight 600', async () => {
    const result = await page.locator('[data-brand-wordmark]').evaluate(node => {
      const s = getComputedStyle(node);
      return { family: s.fontFamily, weight: s.fontWeight, size: s.fontSize, spacing: s.letterSpacing, synthesis: s.fontSynthesis, faces: [...document.fonts].filter(f => f.family.replaceAll('"', '') === 'BuddeBrandQuicksand').map(f => ({ status: f.status, weight: f.weight })) };
    });
    expect(result.family.split(',')[0]).toBe('BuddeBrandQuicksand');
    expect(result.weight).toBe('600'); expect(result.size).toBe('18px'); expect(result.spacing).toBe('normal'); expect(result.synthesis).toBe('none');
    expect(result.faces).toEqual([{ status: 'loaded', weight: '300 700' }]);
  });
  await check('body, Chinese controls and ordinary Lucide icons remain unchanged', async () => {
    for (const selector of ['.budde', '[data-part="capture-title"]', '.card-title', '.main-nav button']) {
      expect(await page.locator(selector).first().evaluate(node => getComputedStyle(node).fontFamily)).not.toContain('BuddeBrandQuicksand');
    }
    await expect(page.locator('.main-nav [data-icon="pool"]')).toHaveClass(/lucide-inbox/);
    await expect(page.locator('.main-nav [data-icon="pool"]')).toHaveAttribute('width', '16');
    await expect(page.locator('.brand [data-icon="brand"]')).toHaveAttribute('aria-hidden', 'true');
    expect(await page.locator('.brand [data-icon="brand"]').getAttribute('class')).not.toContain('lucide-sprout');
  });
  for (const [width, height] of [[1440, 900], [1280, 800]]) for (const theme of ['light', 'dark']) {
    await page.setViewportSize({ width, height });
    await page.locator('.budde').evaluate((root, theme) => root.dataset.theme = theme, theme);
    await page.waitForFunction(() => !document.querySelector('[data-motion-busy="true"]'));
    await page.evaluate(async () => { await document.fonts.ready; await Promise.all(document.getAnimations().map(a => a.finished.catch(() => {}))); });
    await check(`${width}x${height} ${theme}: brand alignment, contrast and header remain stable`, async () => {
      const m = await page.evaluate(() => {
        const rect = selector => { const b = document.querySelector(selector).getBoundingClientRect(); return { x: b.x, y: b.y, width: b.width, height: b.height, right: b.right, bottom: b.bottom }; };
        const word = document.querySelector('[data-brand-wordmark]'), header = document.querySelector('.app-header');
        return { icon: rect('.brand svg'), word: rect('[data-brand-wordmark]'), brand: rect('.brand'), nav: rect('.main-nav'), header: rect('.app-header'), foreground: getComputedStyle(word).color, background: getComputedStyle(header).backgroundColor, rootWidth: document.documentElement.clientWidth, scrollWidth: document.documentElement.scrollWidth };
      });
      expect(m.icon.width).toBe(24); expect(m.icon.height).toBe(24);
      expect(Math.abs(m.icon.y + 12 - m.word.y - m.word.height / 2)).toBeLessThan(1);
      expect(m.word.x - m.icon.right).toBe(8);
      expect(m.word.right).toBeLessThan(m.brand.right);
      expect(m.nav.x - m.brand.right).toBeGreaterThanOrEqual(24);
      expect(m.header.height).toBe(64); expect(m.scrollWidth).toBeLessThanOrEqual(m.rootWidth);
      const ratio = contrast(m.foreground, m.background); expect(ratio).toBeGreaterThanOrEqual(4.5);
      measurements.push({ width, height, theme, contrast: ratio, ...m });
    });
    await page.screenshot({ path: `${output}/${width}x${height}-${theme}.png`, animations: 'disabled', scale: 'css' });
    if (width === 1440) await page.locator('.brand').screenshot({ path: `${output}/brand-${theme}@2x.png`, animations: 'disabled', scale: 'device' });
  }
  await check('no external runtime requests or browser errors', async () => { expect(externalRequests).toEqual([]); expect(errors).toEqual([]); });
} finally { await browser.close(); await preview.close(); }
await writeFile(`${output}/report.json`, JSON.stringify({ checks, measurements, externalRequests, errors }, null, 2));
console.log(JSON.stringify(checks, null, 2));
if (checks.some(c => !c.passed)) process.exitCode = 1;
