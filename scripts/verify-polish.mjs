import { chromium, expect } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
import { startPreview } from './preview.mjs';

// These checks catch lost ownership, premature success and inaccessible hidden actions,
// not the implementation's choice of animation library.
const preview = await startPreview();
const browser = await chromium.launch({ channel: 'msedge', headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
page.setDefaultTimeout(4000);
const root = page.locator('#workbench'), part = name => root.locator(`[data-part="${name}"]`);
const action = name => root.locator(`[data-detail-action="${name}"]`);
const checks = [], errors = [];
page.on('pageerror', error => errors.push(error.message));
let id;
const reset = async () => {
  await page.evaluate(async id => {
    const t = window.buddeTest; t.client.execute = window.originalExecute; t.view.destroy();
    const item = (await t.client.snapshot()).items.find(item => item.id === id);
    await t.client.execute({ kind: 'item.update', id, expectedVersion: item.version, patch: { archived: false, paused: false, reviewedAt: null } });
    t.view = t.mount(document.querySelector('#workbench'), t.client, t.notes);
  }, id);
  await expect(part('capture-title')).toBeEnabled(); await page.mouse.move(1430, 890);
};
const board = async () => { await root.locator('[data-view="board"]').click(); await root.locator('[data-board-type="software"]').click(); };
const open = async () => { await board(); await root.locator(`[data-open="${id}"]`).click(); await expect(action('edit')).toBeVisible(); };
const check = async (name, run) => { try { await reset(); await run(); checks.push({ name, passed: true }); } catch (error) { checks.push({ name, passed: false, error: error.message }); } };
try {
  await mkdir('artifacts/qa', { recursive: true });
  await page.goto(preview.url); await expect(part('capture-title')).toBeEnabled();
  id = await page.evaluate(async () => {
    const t = window.buddeTest; window.originalExecute = t.client.execute;
    const made = await t.client.execute({ kind: 'item.create', requestId: crypto.randomUUID(), title: '质感与交互验收', typeId: 'software' });
    await t.client.execute({ kind: 'item.update', id: made.itemId, expectedVersion: 1, patch: { promoted: true, nextStep: '保留真实保存与宿主边界' } });
    await t.view.refresh(); return made.itemId;
  });
  await check('ordinary icons remain outlines while the original brand is untouched', async () => {
    for (const svg of await root.locator('svg[data-icon]:not([data-icon="brand"])').all()) {
      await expect(svg).toHaveAttribute('stroke-width', '1.5'); await expect(svg).toHaveAttribute('fill', 'none');
      await expect(svg).toHaveAttribute('stroke', 'currentColor'); await expect(svg).toHaveAttribute('stroke-linecap', 'round');
    }
    await expect(root.locator('[data-icon="brand"]')).toHaveAttribute('stroke-width', '1.75');
  });
  await check('secondary card actions reveal on hover and keyboard focus within 150ms', async () => {
    await board(); const card = root.locator(`[data-item-id="${id}"]`), actions = card.locator('.card-actions');
    await expect(actions).toHaveCSS('opacity', '0'); await card.hover(); await expect(actions).toHaveCSS('opacity', '1');
    await expect(actions).toHaveCSS('transition-duration', '0.15s'); await page.mouse.move(1430, 890);
    await card.locator('[data-drag-handle]').focus(); await expect(actions).toHaveCSS('opacity', '1');
  });
  await check('drag leaves a dashed quiet placeholder and a lifted overlay', async () => {
    await board(); const card = root.locator(`[data-item-id="${id}"]`), handle = card.locator('[data-drag-handle]');
    await handle.focus(); await page.keyboard.press('Space');
    try {
      const placeholder = root.locator('[data-drag-placeholder="true"]'); await expect(placeholder).toHaveCSS('border-style', 'dashed');
      const overlay = root.locator('[data-drag-overlay]'); await expect(overlay).toBeVisible();
      expect(await overlay.evaluate(node => getComputedStyle(node).transform)).toMatch(/1\.02/);
      expect(await overlay.locator('.item-card').evaluate(node => getComputedStyle(node).boxShadow)).toContain('28px');
    } finally { await page.keyboard.press('Escape'); }
  });
  await check('one nav capsule follows the actual selected view and carries no pointer target', async () => {
    for (const view of ['board', 'active', 'pool']) {
      await root.locator(`[data-view="${view}"]`).click();
      const selected = root.locator(`.main-nav [data-view="${view}"]`);
      await expect(selected.locator('[data-nav-indicator]')).toHaveCount(1);
      await expect(root.locator('[data-nav-indicator]')).toHaveCount(1);
      await expect(selected.locator('[data-nav-indicator]')).toHaveCSS('pointer-events', 'none');
    }
  });
  await check('dirty save breathes, guard shakes once and Escape never discards the draft', async () => {
    await open(); await action('edit').click(); await part('detail-next').fill('不可静默丢失的修改');
    await expect(part('detail-save')).toHaveAttribute('data-dirty', 'true');
    expect(await part('detail-save').evaluate(node => getComputedStyle(node).animationName)).toContain('budde-dirty');
    await part('detail-next').press('Escape'); const guard = root.locator('.guard-dialog[open]'); await expect(guard).toBeVisible();
    expect(await guard.evaluate(node => getComputedStyle(node).animationName)).toContain('budde-guard');
    await guard.locator('[data-choice="cancel"]').dispatchEvent('keydown', { key: 'Escape', isComposing: true, bubbles: true }); await expect(guard).toBeVisible();
    await page.keyboard.press('Escape'); await expect(guard).toHaveCount(0); await expect(part('detail-next')).toHaveValue('不可静默丢失的修改');
  });
  await check('tracked composition cannot accidentally open an unsaved-close guard', async () => {
    await open(); await action('edit').click(); await part('detail-next').fill('输入法候选中');
    await part('detail-next').dispatchEvent('compositionstart');
    await part('detail-next').dispatchEvent('keydown', { key: 'Escape', bubbles: true });
    await expect(root.locator('.guard-dialog')).toHaveCount(0); await expect(part('detail-next')).toBeVisible();
    await part('detail-next').dispatchEvent('compositionend');
  });
  await check('C focuses capture only inside its own non-editable non-modal root', async () => {
    const pool = root.locator('[data-view="pool"]'); await pool.focus(); await page.keyboard.press('c'); await expect(part('capture-title')).toBeFocused();
    for (const key of ['Control+c', 'Alt+c', 'Meta+c']) { await pool.focus(); await page.keyboard.press(key); await expect(pool).toBeFocused(); }
    await part('title-search').focus(); await page.keyboard.press('c'); await expect(part('title-search')).toHaveValue('c'); await expect(part('title-search')).toBeFocused();
    await pool.focus(); await pool.dispatchEvent('keydown', { key: 'c', isComposing: true, bubbles: true }); await expect(pool).toBeFocused();
    await pool.dispatchEvent('compositionstart'); await pool.press('c'); await expect(pool).toBeFocused(); await pool.dispatchEvent('compositionend');
    await page.evaluate(() => { const edit = document.createElement('div'); edit.contentEditable = 'true'; edit.id = 'editable-probe'; document.querySelector('#workbench').append(edit); });
    await page.locator('#editable-probe').focus(); await page.keyboard.press('c'); await expect(page.locator('#editable-probe')).toBeFocused();
    await page.evaluate(() => document.querySelector('#editable-probe').remove());
    await board(); await root.locator('[data-action="type.create"]').click(); const name = part('settings-name');
    await page.keyboard.press('c'); await expect(part('settings-dialog')).toBeVisible(); await expect(part('capture-title')).not.toBeFocused();
  });
  await check('C does not leak between instances or into the host', async () => {
    await page.evaluate(() => { const t = window.buddeTest, second = document.createElement('div'); second.id = 'second-polish'; second.style.cssText = 'position:absolute;inset:0;width:500px;height:500px'; document.body.append(second); window.secondPolish = t.mount(second, t.client, t.notes); const host = document.createElement('button'); host.id = 'host-polish'; host.textContent = '宿主'; document.body.append(host); });
    try {
      const other = page.locator('#second-polish'); await expect(other.locator('[data-part="capture-title"]')).toBeEnabled();
      await other.locator('[data-view="pool"]').focus(); await page.keyboard.press('c'); await expect(other.locator('[data-part="capture-title"]')).toBeFocused(); await expect(part('capture-title')).not.toBeFocused();
      await page.locator('#host-polish').focus(); await page.keyboard.press('c'); await expect(page.locator('#host-polish')).toBeFocused();
    } finally { await page.evaluate(() => { window.secondPolish.destroy(); document.querySelector('#second-polish').remove(); document.querySelector('#host-polish').remove(); }); }
  });
  await check('capture advertises Enter and clean detail closes on Escape but not IME Escape', async () => {
    await expect(root.locator('[data-capture-hint]')).toContainText('Enter'); await open();
    await action('edit').focus(); await action('edit').dispatchEvent('keydown', { key: 'Escape', isComposing: true, bubbles: true }); await expect(action('edit')).toBeVisible();
    await page.keyboard.press('Escape'); await expect(action('edit')).toHaveCount(0);
  });
  await check('persisted pause review and archive show a local bottom-center transient blurred HUD', async () => {
    for (const command of ['pause', 'review', 'archive']) {
      await open(); await action(command).click(); const hud = part('success-hud'); await expect(hud).toBeVisible();
      const stored = await page.evaluate(async id => (await window.buddeTest.client.snapshot()).items.find(item => item.id === id), id);
      if (command === 'pause') expect(stored.paused).toBe(true);
      if (command === 'review') expect(stored.reviewedAt).not.toBeNull();
      if (command === 'archive') expect(stored.archived).toBe(true);
      const geometry = await hud.evaluate(node => { const a = node.getBoundingClientRect(), b = node.closest('.budde').getBoundingClientRect(); return { center: Math.abs((a.left + a.width / 2) - (b.left + b.width / 2)), bottom: b.bottom - a.bottom, blur: getComputedStyle(node).backdropFilter }; });
      expect(geometry.center).toBeLessThan(2); expect(geometry.bottom).toBeGreaterThanOrEqual(12); expect(geometry.blur).toContain('blur');
      await expect(hud).toBeHidden({ timeout: 5000 }); await page.keyboard.press('Escape');
    }
  });
  await check('failed and pending writes cannot announce success; destroy clears pending HUD ownership', async () => {
    await open();
    await page.evaluate(() => { window.buddeTest.client.execute = async () => { throw new Error('synthetic save failure'); }; });
    await action('review').click(); await expect(part('detail-error')).toContainText('synthetic save failure'); await expect(part('success-hud')).toBeHidden();
    await page.evaluate(() => { window.buddeTest.client.execute = async command => { await new Promise(resolve => window.releasePolish = resolve); return window.originalExecute(command); }; });
    await action('review').click(); await expect(root.locator('[aria-busy="true"]')).not.toHaveCount(0); await expect(part('success-hud')).toBeHidden();
    await page.evaluate(() => { window.buddeTest.view.destroy(); window.releasePolish(); }); await expect(root).toBeEmpty();
  });
  await check('dark surfaces separate inset edges and menus retain a blurred backdrop', async () => {
    await root.evaluate(node => node.dataset.theme = 'dark'); await board();
    expect(await root.locator('.item-card').first().evaluate(node => getComputedStyle(node).boxShadow)).toContain('inset');
    await root.locator('.header-secondary [data-menu-trigger]').click(); await expect(root.getByRole('menu')).toHaveCSS('backdrop-filter', 'blur(12px)');
    await page.screenshot({ path: 'artifacts/qa/alpha2-polish-dark.png', animations: 'disabled' });
    await page.keyboard.press('Escape'); await root.evaluate(node => node.dataset.theme = 'light');
    await page.screenshot({ path: 'artifacts/qa/alpha2-polish-light.png', animations: 'disabled' });
  });
  await check('reduced motion disables dirty breathing and guard shake', async () => {
    await page.emulateMedia({ reducedMotion: 'reduce' }); await open(); await action('edit').click(); await part('detail-next').fill('减少动态效果');
    await expect(part('detail-save')).toHaveCSS('animation-name', 'none'); await part('detail-next').press('Escape'); await expect(root.locator('.guard-dialog')).toHaveCSS('animation-name', 'none');
    await page.keyboard.press('Escape'); await page.emulateMedia({ reducedMotion: 'no-preference' });
  });
  expect(errors).toEqual([]);
} finally { await browser.close(); await preview.close(); }
await writeFile('artifacts/qa/alpha2-polish-results.json', JSON.stringify({ checks, errors }, null, 2));
console.log(JSON.stringify({ checks, errors }, null, 2));
if (checks.some(check => !check.passed)) process.exitCode = 1;
