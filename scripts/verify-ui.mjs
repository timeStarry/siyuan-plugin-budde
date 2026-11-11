import { chromium, expect } from "@playwright/test";
import { mkdir, writeFile, readFile } from "node:fs/promises";
import { startPreview } from "./preview.mjs";
const preview = await startPreview();
const browser = await chromium.launch({ channel: "msedge", headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 }, acceptDownloads: true, reducedMotion: 'reduce' });
const errors = []; const passed = [];
page.on("pageerror", error => errors.push(error.message));
await mkdir("artifacts/qa", { recursive: true });
const part = name => page.locator(`[data-part="${name}"]`);
const action = name => page.locator(`[data-detail-action="${name}"]`);
const snapshot = () => page.evaluate(() => window.buddeTest.client.snapshot());
const capture = async title => { await part("capture-title").fill(title); await part("capture").getByRole("button", { name: "记下来", exact: true }).click(); await expect(part("capture-title")).toHaveValue(""); };
const open = async title => { await page.getByRole("button", { name: title, exact: true }).click(); await expect(page.locator(".detail-pane")).toBeVisible(); };
try {
  await page.goto(preview.url);
  // Works against the production entry, not the isolated design fixture.
  await expect(part("capture-title")).toBeVisible();
  await capture("旅行照片整理工具");
  expect((await snapshot()).items[0].promoted).toBe(false);
  await open("旅行照片整理工具");
  await expect(page.locator(".detail-read")).toBeVisible();
  await expect(part("detail-title")).toBeHidden();
  await expect(page.locator(".stage-path")).toContainText("当前位置");
  expect((await snapshot()).items[0].reviewedAt).toBe(null);
  await action("edit").click();
  await part("detail-next").fill("先验证本地图片读取");
  await part("detail-description").fill("从一小批照片开始。");
  await part("detail-save").click();
  await expect(page.locator(".detail-read")).toContainText("先验证本地图片读取");
  passed.push("title-only capture, read-first detail and explicit draft save");
  await page.evaluate(() => {
    const client = window.buddeTest.client;
    const realExecute = client.execute.bind(client); const realSnapshot = client.snapshot.bind(client);
    window.qa = { realExecute, realSnapshot, fault: '', calls: 0 };
    client.execute = async command => {
      const qa = window.qa; qa.calls++;
      const fault = qa.fault; qa.fault = '';
      if (fault === 'reject') throw Error('模拟写入失败');
      if (fault === 'delay') await new Promise(resolve => qa.release = resolve);
      const result = await realExecute(command);
      if (fault === 'lost') throw Error('模拟提交成功但响应丢失');
      return result;
    };
  });
  const fault = mode => page.evaluate(mode => window.qa.fault = mode, mode);
  const close = async () => { await action('close').click(); await expect(page.locator('.detail-pane')).toBeHidden(); };
  const menu = async command => { await page.locator('.header-secondary [data-menu-trigger]').click(); await page.getByRole('menu').locator(`[data-action="${command}"]`).click(); };
  const settingsAction = name => page.locator(`[data-settings-action="${name}"]`);
  // Rejected save and conflict keep every input and original expected version.
  await action('edit').click(); await part('detail-next').fill('失败也保留下一步');
  await fault('reject'); await part('detail-save').click();
  await expect(part('detail-error')).toContainText('模拟写入失败');
  await expect(part('detail-next')).toHaveValue('失败也保留下一步');
  await page.evaluate(async () => { const s = await window.qa.realSnapshot(); const i = s.items[0]; await window.qa.realExecute({kind:'item.update',id:i.id,expectedVersion:i.version,patch:{description:'另一个窗口'}}); });
  await part('detail-save').click(); await expect(part('detail-status')).toContainText('版本已变化');
  await expect(part('detail-next')).toHaveValue('失败也保留下一步');
  await action('close').click(); await page.locator('[data-choice="cancel"]').click();
  await expect(part('detail-next')).toHaveValue('失败也保留下一步');
  await action('reload').click(); await page.locator('[data-choice="reload"]').click();
  await expect(page.locator('.detail-read')).toContainText('另一个窗口');
  passed.push('write failure, item conflict, dirty-close cancellation and explicit reload');
  // Notes validate locally through the injected host bridge, without dropping invalid text.
  await action('edit').click(); await action('link').click();
  await part('note-target').fill('不是思源目标'); await action('add-link').click();
  await expect(part('detail-error')).toContainText('有效思源链接');
  await expect(part('note-target')).toHaveValue('不是思源目标');
  await part('note-target').fill('siyuan://blocks/20260101000000-demo001'); await action('add-link').click();
  await expect(part('note-links')).toContainText('研究资料');
  await part('note-role').selectOption('outcome'); await part('note-target').fill('20260101000000-demo002'); await action('add-link').click();
  await expect(part('note-links').locator('li')).toHaveCount(2);
  await part('detail-save').click(); await page.locator('[data-note-open]').first().click();
  expect(await page.evaluate(() => window.lastOpenedNote)).toContain('siyuan://blocks/');
  expect((await snapshot()).items[0].links.map(link => link.role)).toEqual(['reference','outcome']);
  await action('edit').click(); await page.locator('[data-remove-link]').first().click(); await part('detail-save').click();
  expect((await snapshot()).items[0].links.length).toBe(1);
  passed.push('reference/outcome note links, invalid-input retention, open and unlink');
  // Dirty promotion saves both draft and action in a single command.
  await action('edit').click(); await part('detail-next').fill('一起开始推进');
  const beforePromotion = (await snapshot()).items[0];
  await action('promote').click(); await page.locator('[data-choice="cancel"]').click();
  expect((await snapshot()).items[0].promoted).toBe(false);
  await action('promote').click(); await page.locator('[data-choice="save"]').click();
  await expect(page.locator('.detail-read')).toContainText('一起开始推进');
  const promoted = (await snapshot()).items[0];
  expect(promoted.promoted).toBe(true); expect(promoted.stageId).toBe(beforePromotion.stageId); expect(promoted.version).toBe(beforePromotion.version+1);
  await action('pause').click(); await expect(action('pause')).toHaveText('恢复推进'); await close();
  await page.locator('[data-view="active"]').click(); await expect(part('collection').locator('[data-item-id]')).toHaveCount(0);
  await page.locator('[data-view="pool"]').click(); await open('旅行照片整理工具'); await action('pause').click();
  await expect(action('pause')).toHaveText('暂停推进'); await action('archive').click(); await expect(action('archive')).toHaveAccessibleName('移出归档'); await close();
  await page.locator('[data-view="archive"]').click(); await open('旅行照片整理工具'); await action('archive').click(); await expect(action('archive')).toHaveAccessibleName('归档事项'); await close();
  passed.push('atomic draft+promotion, pause exclusion, archive and restore');
  await page.locator('[data-view="pool"]').click();
  // Lost create response retries the same request ID, not a second item.
  await fault('lost'); await part('capture-title').fill('响应丢失的想法'); await part('capture').getByRole('button').click();
  await expect(part('error')).toContainText('响应丢失'); await expect(part('capture-title')).toHaveValue('响应丢失的想法');
  await part('capture').getByRole('button').click(); await expect(part('capture-title')).toHaveValue('');
  expect((await snapshot()).items.filter(i => i.title === '响应丢失的想法').length).toBe(1);
  await part('capture-title').fill('输入法未完成');
  await part('capture-title').dispatchEvent('compositionstart'); await part('capture-title').press('Enter');
  expect((await snapshot()).items.some(i => i.title === '输入法未完成')).toBe(false);
  await part('capture-title').dispatchEvent('compositionend'); await part('capture-title').fill('');
  await capture('<img src=x onerror="window.xss=true">'); expect(await page.evaluate(() => window.xss)).toBeUndefined();
  await part('title-search').fill('响应丢失'); await expect(part('collection').locator('[data-item-id]')).toHaveCount(1);
  await part('title-search').fill(''); await page.locator('[data-pool="unpromoted"]').click();
  expect(await part('collection').locator('[data-item-id]').count()).toBe(2);
  await page.locator('[data-pool="all"]').click();
  passed.push('lost-response exactly-once capture, IME, XSS and pool filtering');
  // Explicit cross-type stage choice, keyboard board stage movement, drag movement.
  await open('旅行照片整理工具'); await action('edit').click(); await part('detail-type').selectOption('software');
  await part('detail-save').click(); await expect(part('detail-error')).not.toBeEmpty();
  const software = (await snapshot()).types.find(t => t.id === 'software');
  await part('detail-stage').selectOption(software.initialStageId); await part('detail-save').click(); await expect(page.locator('.detail-read')).toBeVisible(); await close();
  await page.locator('[data-view="board"]').click(); await page.locator('[data-board-type="software"]').click();
  const currentItem = (await snapshot()).items.find(i => i.title === '旅行照片整理工具');
  const secondStage = software.stages.find(s => s.id !== currentItem.stageId && !s.completed);
  const card = page.locator(`[data-item-id="${currentItem.id}"]`);
  await card.locator('[data-menu-trigger]').focus(); await page.keyboard.press('Enter');
  await page.getByRole('menu').locator(`[data-stage-target="${secondStage.id}"]`).focus(); await page.keyboard.press('Enter');
  await expect.poll(async () => (await snapshot()).items.find(i => i.id === currentItem.id).stageId).toBe(secondStage.id);
  const handleBox = await card.locator('[data-drag-handle]').boundingBox();
  const targetBox = await page.locator(`.stage-column[data-stage-id="${software.initialStageId}"]`).boundingBox();
  await page.mouse.move(handleBox.x + handleBox.width / 2, handleBox.y + handleBox.height / 2); await page.mouse.down();
  await page.mouse.move(handleBox.x + handleBox.width / 2 + 20, handleBox.y + handleBox.height / 2 + 20, {steps: 4});
  await expect(page.locator('[data-drag-overlay]')).toBeVisible();
  await page.mouse.move(targetBox.x + targetBox.width / 2, targetBox.y + 100, {steps: 12}); await page.mouse.up();
  await expect.poll(async () => (await snapshot()).items.find(i => i.id === currentItem.id).stageId).toBe(software.initialStageId);
  passed.push('explicit cross-type migration, keyboard and drag board movement');
  // Config CRUD, optimistic conflict retention, initial stage, completed independent of order.
  const softwareSettings = page.locator('[data-type-row="software"] [data-action="type.settings"]');
  await page.locator('[data-type-row="software"]').hover(); await expect(softwareSettings).toHaveCSS('opacity', '1');
  await softwareSettings.click(); await expect(part('settings-dialog')).toBeVisible();
  await settingsAction('type.create').click(); await part('setting-name').fill('新类型'); await part('settings-form').getByRole('button',{name:'保存设置',exact:true}).click();
  await expect(page.locator('[data-settings-type]').filter({hasText:'新类型'})).toBeVisible();
  await settingsAction('type.update').click(); await part('setting-name').fill('改名类型');
  await page.evaluate(async () => { const s = await window.qa.realSnapshot(); await window.qa.realExecute({kind:'type.create',name:'外部类型',expectedRevision:s.revision}); });
  await part('settings-form').getByRole('button',{name:'保存设置',exact:true}).click(); await expect(part('settings-status')).toContainText('版本已变化'); await expect(part('setting-name')).toHaveValue('改名类型');
  await settingsAction('reload').click(); await page.locator('[data-choice="reload"]').click(); await expect(part('settings-editor')).toContainText('选择一个设置项');
  await page.locator('[data-settings-type]').filter({hasText:'新类型'}).click();
  await settingsAction('stage.add').click(); await part('setting-name').fill('测试阶段'); await part('settings-form').getByRole('button',{name:'保存设置',exact:true}).click();
  let config = await snapshot(); let newType = config.types.find(t=>t.name==='新类型'); const added = newType.stages.find(s=>s.name==='测试阶段');
  await page.locator(`[data-stage-row="${added.id}"] [data-settings-action="stage.update"]`).click();
  await part('settings-form').getByRole('checkbox').check(); await part('settings-form').getByRole('button',{name:'保存设置',exact:true}).click();
  for (let position = newType.stages.findIndex(stage=>stage.id===added.id); position > 0; position--) {
    await page.locator(`[data-stage-row="${added.id}"] [data-settings-action="up"]`).click();
    await expect.poll(async ()=>(await snapshot()).types.find(t=>t.id===newType.id).stages.findIndex(stage=>stage.id===added.id)).toBe(position-1);
  }
  expect((await snapshot()).types.find(t=>t.id===newType.id).stages[0].completed).toBe(true);
  await settingsAction('type.update').click(); await part('setting-initial').selectOption(added.id); await part('settings-form').getByRole('button',{name:'保存设置',exact:true}).click();
  // Seed an archived item via the real command service, then exercise UI migration.
  await page.evaluate(async typeId => { const result = await window.qa.realExecute({kind:'item.create',typeId,title:'归档迁移覆盖',requestId:crypto.randomUUID()}); const i=result.state.items.find(i=>i.id===result.itemId); await window.qa.realExecute({kind:'item.update',id:i.id,expectedVersion:i.version,patch:{archived:true,paused:true}}); },newType.id);
  await settingsAction('reload').click(); await page.locator('[data-choice="reload"]').click();
  await page.locator(`[data-stage-row="${added.id}"] [data-settings-action="stage.delete"]`).click();
  await expect(part('migration-impact')).toContainText('1 个归档');
  newType = (await snapshot()).types.find(t=>t.id===newType.id); const target = newType.stages.find(s=>s.id!==added.id);
  await part('setting-target').selectOption(target.id); await part('settings-form').getByRole('button',{name:'确认删除并迁移'}).click();
  const migrated = (await snapshot()).items.find(i=>i.title==='归档迁移覆盖'); expect(migrated.stageId).toBe(target.id); expect(migrated.archived && migrated.paused).toBe(true);
  await settingsAction('type.delete').click(); await expect(part('settings-form').getByRole('button',{name:'确认删除类型'})).toBeDisabled();
  await settingsAction('cancel-editor').click();
  await page.locator('[data-settings-type]').filter({hasText:'外部类型'}).click(); await settingsAction('type.delete').click(); await part('settings-form').getByRole('button',{name:'确认删除类型'}).click();
  expect((await snapshot()).types.some(t=>t.name==='外部类型')).toBe(false);
  await settingsAction('close').click();
  passed.push('type/stage CRUD, config conflict, completion/order independence and archived migration');
  // A pending save rejects a duplicate submission and keeps control geometry stable.
  await page.locator('[data-view="pool"]').click(); await open('旅行照片整理工具'); await action('edit').click(); await part('detail-next').fill('等待写入');
  const geometry = await part('detail-save').boundingBox(); const calls = await page.evaluate(() => window.qa.calls);
  await fault('delay'); await part('detail-save').click(); await expect(part('detail-status')).toContainText('保存中');
  await page.evaluate(() => document.querySelector('[data-part="detail-form"]').requestSubmit());
  expect(await page.evaluate(() => window.qa.calls)).toBe(calls+1);
  expect((await part('detail-save').boundingBox()).height).toBe(geometry.height);
  await page.evaluate(() => window.qa.release()); await expect(page.locator('.detail-read')).toContainText('等待写入'); await close();
  const downloadPromise = page.waitForEvent('download');
  await menu('export'); const download = await downloadPromise; const exported = JSON.parse(await readFile(await download.path(),'utf8'));
  expect(exported.noteContentsIncluded).toBe(false); expect(exported.data).toEqual(await snapshot());
  passed.push('pending duplicate prevention, stable busy geometry and complete JSON download');
  // Container width (not viewport) controls detail mode and visual contracts.
  for (const theme of ['light','dark']) for (const width of [1440,1024,720,480,320]) {
    await page.evaluate(({theme,width}) => { const root=document.querySelector('.budde'); root.dataset.theme=theme; root.style.width=width+'px'; },{theme,width});
    await open('旅行照片整理工具');
    await expect(page.locator('.detail-pane')).toHaveAttribute('role',width<1200?'dialog':'region');
    const metrics=await page.evaluate(() => { const root=document.querySelector('.budde'); const visible=node=>node.getClientRects().length&&!node.closest('[inert]'); return { overflow:root.scrollWidth-root.clientWidth, controls:[...root.querySelectorAll('button:not(.card-open):not(.note-link):not([data-detail-stage-target]),summary,input:not([type=checkbox]),select')].filter(visible).map(node=>({height:node.getBoundingClientRect().height,label:node.textContent||node.getAttribute('aria-label')})), icons:[...root.querySelectorAll('svg')].filter(visible).map(node=>({name:node.dataset.icon,size:node.getBoundingClientRect().width,stroke:getComputedStyle(node).strokeWidth})), stageControls:[...root.querySelectorAll('[data-detail-stage-target]')].filter(visible).map(node=>node.getBoundingClientRect().height), path:root.querySelector('.stage-path').scrollWidth-root.querySelector('.stage-path').clientWidth }; });
    expect(metrics.overflow,JSON.stringify({theme,width,metrics})).toBeLessThanOrEqual(1);
    expect(metrics.controls.filter(entry=>Math.abs(entry.height-36)>0.1),JSON.stringify({theme,width,metrics})).toEqual([]);
    expect(metrics.stageControls.every(height=>height>=36)).toBe(true); expect(metrics.path).toBeLessThanOrEqual(1);
    expect(metrics.icons.every(entry=>[16,24].includes(entry.size)&&entry.stroke===(entry.name==='brand'?'1.75px':'1.5px')),JSON.stringify({theme,width,icons:metrics.icons})).toBe(true);
    await page.screenshot({path:`artifacts/qa/production-${theme}-${width}.png`}); await close();
  }
  await page.evaluate(()=>{document.querySelector('.budde').style.width='100%';delete document.querySelector('.budde').dataset.theme;});
  passed.push('10 light/dark container-width screenshots, 36px controls, SVG sizing and overflow');
  expect(errors).toEqual([]);
  await writeFile("artifacts/qa/results.json", JSON.stringify({ passed, errors }, null, 2));
  console.log(JSON.stringify({ passed, errors }, null, 2));
} catch (error) {
  await page.screenshot({ path: "artifacts/qa/failure.png", fullPage: true });
  console.error(error); process.exitCode = 1;
} finally { await browser.close(); await preview.close(); }
