import { chromium, expect } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
import { startPreview } from './preview.mjs';

const preview = await startPreview();
const browser = await chromium.launch({ channel: 'msedge', headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, reducedMotion: 'reduce' });
const errors = [], passed = [];
page.on('pageerror', error => errors.push(error.message));
const part = name => page.locator(`[data-part="${name}"]`);
const action = name => page.locator(`[data-detail-action="${name}"]`);
const path = page.locator('.stage-path');
const target = id => path.locator(`[data-detail-stage-target="${id}"]`);
const item = () => page.evaluate(async () => (await window.buddeTest.client.snapshot()).items.find(item => item.id === window.pathFixture.itemId));
try {
  await mkdir('artifacts/qa', { recursive: true });
  await page.goto(preview.url); await expect(part('capture-title')).toBeEnabled();
  const fixture = await page.evaluate(async () => {
    const { client, view } = window.buddeTest;
    let state = await client.snapshot();
    state = (await client.execute({ kind: 'type.create', expectedRevision: state.revision, name: '长名称阶段验收', icon: '🧭', color: 'blue', template: 'software' })).state;
    const typeId = state.types.at(-1).id;
    for (let n = 0; n < 3; n++) state = (await client.execute({ kind: 'stage.add', typeId, name: `额外阶段 ${n}`, expectedRevision: state.revision })).state;
    const stages = state.types.at(-1).stages;
    for (const [index, stage] of stages.entries()) {
      const name = index === 2 ? '连续英文长名称' + 'LongUnbrokenStageName'.repeat(4) : `阶段 ${index + 1}：完整展示资料调研、方案整理与下一步验证，不依赖省略号或横向滚动`;
      state = (await client.execute({ kind: 'stage.update', typeId, id: stage.id, name, completed: index === 1, expectedRevision: state.revision })).state;
    }
    const made = await client.execute({ kind: 'item.create', requestId: crypto.randomUUID(), typeId, title: '阶段路径保护验收' });
    const item = made.state.items.find(item => item.id === made.itemId);
    await client.execute({ kind: 'item.update', id: item.id, expectedVersion: item.version, patch: { promoted: true, nextStep: '原始下一步' } });
    await view.refresh();
    window.pathFixture = { itemId: item.id, typeId, stages: state.types.at(-1).stages };
    return window.pathFixture;
  });
  await page.getByRole('button', { name: '阶段路径保护验收', exact: true }).click();
  await expect(path.getByRole('list')).toHaveAttribute('aria-label', '可点击的垂直阶段时间轴');
  await expect(path.locator('[data-detail-stage-target]')).toHaveCount(7);
  await expect(page.locator('.detail-meta [data-type-icon]')).toContainText('🧭');
  for (const theme of ['light', 'dark']) for (const width of [1440, 1280, 320]) {
    await page.evaluate(({ theme, width }) => { const root = document.querySelector('.budde'); root.dataset.theme = theme; root.style.width = `${width}px`; }, { theme, width });
    const metrics = await path.evaluate(node => {
      const list = node.querySelector('ol');
      return { overflow: list.scrollWidth - list.clientWidth, rootOverflow: document.querySelector('.budde').scrollWidth - document.querySelector('.budde').clientWidth,
        labels: [...node.querySelectorAll('.path-label')].map(label => ({ text: label.textContent, clip: getComputedStyle(label).textOverflow, whiteSpace: getComputedStyle(label).whiteSpace, overflow: label.scrollWidth - label.clientWidth })),
        buttons: [...node.querySelectorAll('button')].map(button => button.getBoundingClientRect().height), scroll: getComputedStyle(list).overflowX };
    });
    expect(metrics.overflow).toBeLessThanOrEqual(1); expect(metrics.rootOverflow).toBeLessThanOrEqual(1);
    expect(metrics.labels.map(label => label.text)).toEqual(fixture.stages.map(stage => stage.name));
    expect(metrics.labels.every(label => label.clip !== 'ellipsis' && label.whiteSpace !== 'nowrap' && label.overflow <= 1)).toBe(true);
    expect(metrics.buttons.every(height => height >= 36)).toBe(true); expect(['auto', 'scroll']).not.toContain(metrics.scroll);
    if (width === 320) await page.screenshot({ path: `artifacts/qa/stage-path-${theme}-320.png` });
  }
  await page.evaluate(() => { document.querySelector('.budde').style.width = '100%'; });
  passed.push('seven full-length/continuous-word stages wrap vertically in both themes at 1440/1280/320 without horizontal scroll');

  let before = await item();
  await target(fixture.stages[1].id).click();
  await expect.poll(async () => (await item()).stageId).toBe(fixture.stages[1].id);
  await expect(target(fixture.stages[1].id)).toHaveAttribute('aria-current', 'step');
  await expect(page.locator('.detail-meta')).toContainText('已完成');
  expect((await item()).version).toBe(before.version + 1);
  await target(fixture.stages[0].id).click();
  await expect(page.locator('.detail-meta')).toContainText('正在推进');
  expect((await item()).nextStep).toBe('原始下一步');
  passed.push('forward/back stage buttons persist with optimistic item versions and completion independent of order');

  await action('edit').click(); await part('detail-next').fill('草稿与阶段一起保存');
  before = await item();
  await part('detail-stage').focus(); await part('detail-stage').selectOption(fixture.stages[1].id);
  await expect(target(fixture.stages[1].id)).toHaveAttribute('aria-current', 'step');
  await expect(part('detail-stage')).toBeFocused();
  await expect(part('detail-next')).toHaveValue('草稿与阶段一起保存'); expect(await item()).toEqual(before);
  await part('detail-stage').selectOption(before.stageId);
  await expect(target(before.stageId)).toHaveAttribute('aria-current', 'step');
  passed.push('editable stage select synchronizes the draft path without persisting or replacing other inputs and focus');
  await target(fixture.stages[2].id).click(); await page.locator('[data-choice="cancel"]').click();
  expect(await item()).toEqual(before); await expect(part('detail-next')).toHaveValue('草稿与阶段一起保存');
  await target(fixture.stages[2].id).click(); await page.locator('[data-choice="save"]').click();
  await expect(page.locator('.detail-read')).toContainText('草稿与阶段一起保存');
  expect((await item()).stageId).toBe(fixture.stages[2].id); expect((await item()).version).toBe(before.version + 1);
  passed.push('editing path uses the same unsaved guard and saves draft plus stage in one command');

  before = await item();
  await page.evaluate(() => { const client = window.buddeTest.client, execute = client.execute.bind(client); window.pathExecute = execute; client.execute = async () => { client.execute = execute; throw Error('阶段写入失败'); }; });
  await target(fixture.stages[3].id).click(); await expect(part('detail-error')).toContainText('阶段写入失败');
  expect(await item()).toEqual(before); await expect(target(before.stageId)).toHaveAttribute('aria-current', 'step');
  await page.evaluate(async () => { const client = window.buddeTest.client, state = await client.snapshot(), item = state.items.find(item => item.id === window.pathFixture.itemId); await client.execute({ kind: 'item.update', id: item.id, expectedVersion: item.version, patch: { description: '外部版本' } }); });
  await target(fixture.stages[3].id).click(); await expect(part('detail-status')).toContainText('版本已变化');
  expect((await item()).stageId).toBe(before.stageId);
  await action('reload').click(); await page.locator('[data-choice="reload"]').click();
  await expect(page.locator('.detail-read')).toContainText('外部版本');
  passed.push('failed and stale path commands retain current stage and require explicit conflict reload');

  await page.evaluate(() => {
    const client = window.buddeTest.client, execute = client.execute.bind(client); let release;
    const gate = new Promise(resolve => { release = resolve; });
    window.pendingPath = { release, calls: 0 };
    client.execute = async command => { window.pendingPath.calls++; await gate; client.execute = execute; return execute(command); };
  });
  await target(fixture.stages[3].id).click();
  await expect(target(fixture.stages[0].id)).toBeDisabled();
  await target(fixture.stages[4].id).evaluate(button => button.click());
  expect(await page.evaluate(() => window.pendingPath.calls)).toBe(1);
  await page.evaluate(() => window.pendingPath.release());
  await expect(target(fixture.stages[3].id)).toHaveAttribute('aria-current', 'step');
  await expect(target(fixture.stages[0].id)).toBeEnabled();
  before = await item();
  const travel = await page.evaluate(async () => (await window.buddeTest.client.snapshot()).types.find(type => type.id === 'travel'));
  await action('edit').click(); await part('detail-next').fill('跨类型草稿保留');
  await part('detail-type').selectOption('travel');
  await expect(part('detail-next')).toHaveValue('跨类型草稿保留');
  await expect(path.locator('button')).toHaveCount(travel.stages.length);
  await expect(path.locator('[aria-current="step"]')).toHaveCount(0);
  await target(travel.stages[0].id).click(); await page.locator('[data-choice="cancel"]').click();
  await expect(part('detail-next')).toHaveValue('跨类型草稿保留'); expect(await item()).toEqual(before);
  await action('cancel-edit').click(); await page.locator('[data-choice="discard"]').click();
  await expect(target(before.stageId)).toHaveAttribute('aria-current', 'step');
  passed.push('pending stage writes lock all path controls; editable type change refreshes stages without losing fields or bypassing discard guards');

  const unusedType = await page.evaluate(async () => {
    const { client, view } = window.buddeTest, state = await client.snapshot();
    const result = await client.execute({ kind: 'type.create', name: '草稿专用临时类型', template: 'article', expectedRevision: state.revision });
    await view.refresh(); return result.state.types.at(-1);
  });
  before = await item();
  await action('edit').click(); await part('detail-next').fill('并发删除类型也保留草稿');
  await part('detail-type').selectOption(unusedType.id);
  await part('detail-stage').selectOption(unusedType.stages[0].id);
  await page.evaluate(async id => {
    const { client, view } = window.buddeTest, state = await client.snapshot();
    await client.execute({ kind: 'type.delete', id, expectedRevision: state.revision }); await view.refresh();
  }, unusedType.id);
  await part('detail-stage').selectOption(unusedType.stages[1].id);
  await expect(part('detail-next')).toHaveValue('并发删除类型也保留草稿');
  await expect(target(unusedType.stages[1].id)).toHaveAttribute('aria-current', 'step');
  await part('detail-save').click(); await expect(part('detail-error')).not.toBeEmpty();
  await expect(part('detail-next')).toHaveValue('并发删除类型也保留草稿'); expect(await item()).toEqual(before);
  await action('reload').click(); await page.locator('[data-choice="reload"]').click();
  await expect(target(before.stageId)).toHaveAttribute('aria-current', 'step');
  await expect(page.locator('.detail-read')).not.toContainText('并发删除类型也保留草稿');
  passed.push('concurrently deleted draft type retains its editing config and inputs; failed save is atomic and explicit reload recovers');

  expect(errors).toEqual([]);
  await writeFile('artifacts/qa/stage-path-results.json', JSON.stringify({ passed, errors }, null, 2));
  console.log(`${passed.length} vertical stage-path groups passed`);
} finally { await browser.close(); await preview.close(); }
