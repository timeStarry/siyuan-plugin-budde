import { chromium, expect } from '@playwright/test';
import { startPreview } from './preview.mjs';
import { mkdir, writeFile } from 'node:fs/promises';
const preview=await startPreview(); const browser=await chromium.launch({channel:'msedge',headless:true});
const page=await browser.newPage({viewport:{width:1440,height:1000}}); const errors=[]; const passed=[];
page.on('pageerror',error=>errors.push(error.message));
const part=name=>page.locator(`[data-part="${name}"]`);
const action=name=>page.locator(`[data-detail-action="${name}"]`);
try {
  await page.goto(preview.url); await expect(part('capture-title')).toBeEnabled();
  await part('capture-title').fill('异步测试'); await part('capture').getByRole('button').click(); await expect(part('capture-title')).toHaveValue('');
  await page.getByRole('button',{name:'异步测试',exact:true}).click(); await action('edit').click(); await part('detail-next').fill('草稿');
  await page.evaluate(async()=>{const c=window.buddeTest.client;window.realExecute=c.execute.bind(c);window.realSnapshot=c.snapshot.bind(c);const s=await c.snapshot();const i=s.items[0];await c.execute({kind:'item.update',id:i.id,expectedVersion:i.version,patch:{description:'外部修改'}});});
  await part('detail-save').click(); await expect(part('detail-status')).toContainText('版本已变化');
  await action('reload').click();
  await page.evaluate(()=>{window.buddeTest.client.snapshot=async()=>{const s=await window.realSnapshot();await new Promise(resolve=>window.releaseSnapshot=resolve);return s;};});
  await page.locator('[data-choice="reload"]').click();
  await expect(part('detail-next')).toBeDisabled(); await expect(action('close')).toBeDisabled();
  await page.evaluate(()=>window.releaseSnapshot()); await expect(page.locator('.detail-read')).toContainText('外部修改');
  await page.evaluate(()=>window.buddeTest.client.snapshot=window.realSnapshot);
  passed.push('pending explicit reload locks the original draft until snapshot settles');
  // Stale refresh cannot regress a newer successful save.
  await page.evaluate(()=>{window.buddeTest.client.snapshot=async()=>{const s=await window.realSnapshot();await new Promise(resolve=>window.releaseSnapshot=resolve);return s;};void window.buddeTest.view.refresh();});
  await action('edit').click(); await part('detail-next').fill('新版本不会回退'); await part('detail-save').click(); await expect(page.locator('.detail-read')).toContainText('新版本不会回退');
  await page.evaluate(()=>window.releaseSnapshot()); await page.evaluate(()=>window.buddeTest.client.snapshot=window.realSnapshot);
  await expect(page.locator('.detail-read')).toContainText('新版本不会回退');
  passed.push('out-of-order refresh is monotonic and preserves current detail');
  // Newer refresh wins over a previously committed but late save response.
  await page.evaluate(()=>{window.committed=false;window.buddeTest.client.execute=async command=>{const result=await window.realExecute(command);window.committed=true;await new Promise(resolve=>window.releaseResult=resolve);return result;};});
  await action('edit').click();await part('detail-next').fill('旧提交响应');await part('detail-save').click();
  await expect.poll(()=>page.evaluate(()=>window.committed)).toBe(true);
  await page.evaluate(async()=>{const s=await window.realSnapshot();const i=s.items[0];await window.realExecute({kind:'item.update',id:i.id,expectedVersion:i.version,patch:{nextStep:'更新的外部提交'}});await window.buddeTest.view.refresh();window.releaseResult();});
  await expect(page.locator('.detail-read')).toContainText('更新的外部提交');
  await page.evaluate(()=>window.buddeTest.client.execute=window.realExecute);
  // Config-only revision invalidates read detail without inventing item history.
  await page.evaluate(async()=>{const s=await window.realSnapshot();const i=s.items[0];const type=s.types.find(t=>t.id===i.typeId);const stage=type.stages.find(t=>t.id===i.stageId);window.itemVersion=i.version;await window.realExecute({kind:'stage.update',expectedRevision:s.revision,typeId:type.id,id:stage.id,name:'外部改名阶段',completed:stage.completed});await window.buddeTest.view.refresh();});
  await expect(page.locator('.detail-read')).toContainText('外部改名阶段');
  expect(await page.evaluate(async()=>(await window.realSnapshot()).items[0].version)).toBe(await page.evaluate(()=>window.itemVersion));
  await page.evaluate(()=>window.buddeTest.client.execute=async()=>{await new Promise(resolve=>window.rejectAction=resolve);throw new Error('读取动作写入失败');});
  await action('promote').click();await expect(part('detail-status')).toContainText('保存中');
  await page.evaluate(async()=>{const s=await window.realSnapshot();const i=s.items[0];await window.realExecute({kind:'stage.update',expectedRevision:s.revision,typeId:i.typeId,id:i.stageId,name:'忙碌期间配置更新',completed:false});await window.buddeTest.view.refresh();window.rejectAction();});
  await expect(page.locator('.detail-read')).toContainText('忙碌期间配置更新');await expect(part('detail-error')).toContainText('读取动作写入失败');
  await page.evaluate(()=>window.buddeTest.client.execute=window.realExecute);
  passed.push('late save response and config-only refresh, including failed read actions, cannot leave detail stale');
  await part('title-search').focus();await page.evaluate(()=>document.querySelector('#workbench').style.width='900px');
  await expect(page.locator('.detail-pane')).toHaveAttribute('aria-modal','true');
  await expect(page.locator('.detail-pane')).toBeFocused();
  await page.keyboard.press('Tab');expect(await page.evaluate(()=>!!document.activeElement.closest('.detail-pane'))).toBe(true);
  await page.evaluate(()=>document.querySelector('#workbench').style.width='100%');
  passed.push('desktop-to-overlay resize moves only own background focus into the pane');
  await expect(page.locator('.detail-pane')).toHaveAttribute('role','region');
  await action('edit').click();await part('detail-next').fill('确认期间缩放');await action('close').click();
  await page.evaluate(()=>document.querySelector('#workbench').style.width='900px');await expect(page.locator('.detail-pane')).toHaveAttribute('role','dialog');
  await page.locator('[data-choice="cancel"]').click();
  expect(await part('capture-title').evaluate(n=>!!n.closest('[inert]'))).toBe(true);
  await action('close').click();await page.locator('[data-choice="discard"]').click();
  await page.evaluate(()=>document.querySelector('#workbench').style.width='100%');
  passed.push('guard completion recomputes inert ownership after container resize');
  // Host sentinel and second plugin instance remain independent of this instance's modal/settings.
  await page.evaluate(async()=>{const host=document.createElement('div');host.id='host-sentinel';host.innerHTML='<button>宿主按钮</button><input value="宿主输入">';document.body.append(host);const second=document.createElement('div');second.id='second';second.style.cssText='position:absolute;right:0;top:0;width:480px;height:1000px;';document.body.append(second);document.querySelector('#workbench').style.width='720px';window.secondView=window.buddeTest.mount(second,window.buddeTest.client,window.buddeTest.notes);await window.secondView.refresh();});
  const first=page.locator('#workbench'); const second=page.locator('#second');
  await expect(second.locator('[data-part="capture-title"]')).toBeEnabled();
  const hostBefore=await page.locator('#host-sentinel button').evaluate(n=>{const c=getComputedStyle(n);return {height:c.height,color:c.color,bg:c.backgroundColor,font:c.font};});
  const themeBefore=await page.locator('html').getAttribute('data-theme-mode');
  await first.getByRole('button',{name:'异步测试',exact:true}).click();
  await expect(first.locator('.detail-pane')).toHaveAttribute('aria-modal','true');
  await expect(second.locator('[data-part="capture-title"]')).toBeEnabled();
  expect(await page.locator('#host-sentinel').evaluate(n=>n.inert)).toBe(false);
  await first.locator('[data-detail-action="edit"]').click(); await first.locator('[data-part="detail-next"]').fill('嵌套确认'); await first.locator('[data-detail-action="close"]').click();
  await expect(first.locator('.guard-dialog')).toBeVisible();
  expect(await second.evaluate(n=>n.inert)).toBe(false);
  expect(await page.evaluate(()=>[...document.querySelectorAll('[id]')].map(n=>n.id).filter((id,i,ids)=>ids.indexOf(id)!==i))).toEqual([]);
  await first.locator('[data-choice="cancel"]').click(); await first.locator('[data-detail-action="close"]').click(); await first.locator('[data-choice="discard"]').click();
  await first.locator('.header-secondary [data-menu-trigger]').click(); await first.getByRole('menu').locator('[data-action="settings"]').click();
  await expect(first.locator('[data-part="settings-dialog"]')).toBeVisible();
  await expect(second.locator('[data-part="capture-title"]')).toBeEnabled();
  const hostAfter=await page.locator('#host-sentinel button').evaluate(n=>{const c=getComputedStyle(n);return {height:c.height,color:c.color,bg:c.backgroundColor,font:c.font};});
  expect(hostAfter).toEqual(hostBefore); expect(await page.locator('html').getAttribute('data-theme-mode')).toBe(themeBefore);
  await first.locator('[data-settings-action="close"]').click(); await page.evaluate(()=>{window.secondView.destroy();document.querySelector('#second').remove();document.querySelector('#workbench').style.width='100%';});
  passed.push('two instances: unique IDs, container overlay, nested modal and untouched host theme/styles/inert');
  // Two rapid settings invocations share one open; no second render or inert owner.
  await page.evaluate(()=>{window.openSnapshots=0;window.buddeTest.client.snapshot=async()=>{window.openSnapshots++;await new Promise(resolve=>window.releaseSnapshot=resolve);return window.realSnapshot();};const button=document.querySelector('[data-action="settings"]');button.click();button.click();});
  await expect.poll(()=>page.evaluate(()=>window.openSnapshots)).toBe(1);
  await page.evaluate(()=>window.releaseSnapshot());await expect(part('settings-dialog')).toBeVisible();
  await page.locator('[data-settings-action="type.create"]').click();await part('setting-name').fill('没有被第二次打开抹掉');await expect(part('setting-name')).toHaveValue('没有被第二次打开抹掉');
  await page.locator('[data-settings-action="close"]').click();await page.locator('[data-choice="discard"]').click();
  await expect(part('capture-title')).toBeEnabled();expect(await part('capture-title').evaluate(n=>!!n.closest('[inert]'))).toBe(false);
  await page.evaluate(()=>window.buddeTest.client.snapshot=window.realSnapshot);
  passed.push('double settings open is single-flight and restores its only inert ownership');
  // Destroy during a settings.open snapshot must not show a detached dialog or inert host.
  await page.evaluate(()=>window.buddeTest.client.snapshot=async()=>{await new Promise(resolve=>window.releaseSnapshot=resolve);return window.realSnapshot();});
  await page.locator('.header-secondary [data-menu-trigger]').click(); await page.getByRole('menu').locator('[data-action="settings"]').click();
  await expect.poll(()=>page.evaluate(()=>typeof window.releaseSnapshot)).toBe('function');
  await page.evaluate(()=>window.buddeTest.view.destroy()); await page.evaluate(()=>window.releaseSnapshot());
  await expect(page.locator('#workbench')).toBeEmpty();
  passed.push('destroy while settings snapshot is pending has no dialog resurrection');
  // Each deferred async operation is torn down independently with a clean host mount.
  for (const operation of ['refresh','save','note','guard']) {
    await page.goto(preview.url); await expect(part('capture-title')).toBeEnabled();
    await part('capture-title').fill('卸载保护');await part('capture').getByRole('button').click();await expect(part('capture-title')).toHaveValue('');
    await page.getByRole('button',{name:'卸载保护',exact:true}).click();
    if(operation==='refresh')await page.evaluate(()=>{const c=window.buddeTest.client;const original=c.snapshot.bind(c);c.snapshot=async()=>{await new Promise(resolve=>window.release=resolve);return original();};void window.buddeTest.view.refresh();});
    else {await action('edit').click();await part('detail-next').fill('保留');
      if(operation==='save'){await page.evaluate(()=>{const c=window.buddeTest.client;const original=c.execute.bind(c);c.execute=async command=>{await new Promise(resolve=>window.release=resolve);return original(command);};});await part('detail-save').click();await expect(part('detail-status')).toContainText('保存中');}
      if(operation==='note'){await action('link').click();await part('note-target').fill('20260101000000-demo001');await page.evaluate(()=>{window.buddeTest.notes.resolve=async()=>{await new Promise(resolve=>window.release=resolve);return {target:'siyuan://blocks/20260101000000-demo001',title:'迟到的笔记'};};});await action('add-link').click();await expect(part('detail-status')).toContainText('验证笔记');}
      if(operation==='guard'){await action('close').click();await expect(page.locator('.guard-dialog')).toBeVisible();}
    }
    await page.evaluate(()=>{const sentinel=document.createElement('input');sentinel.id='focus-sentinel';document.body.append(sentinel);sentinel.focus();window.buddeTest.view.destroy();if(window.release)window.release();});
    await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
    await expect(page.locator('#workbench')).toBeEmpty();await expect(page.locator('#focus-sentinel')).toBeFocused();
    expect(await page.locator('body').evaluate(n=>n.inert)).toBe(false);
    passed.push(`destroy during ${operation}: no DOM, focus or inert leak`);
  }
  expect(errors).toEqual([]);await mkdir('artifacts/qa',{recursive:true});await writeFile('artifacts/qa/lifecycle.json',JSON.stringify({passed,errors},null,2));console.log(JSON.stringify({passed,errors},null,2));
} catch(error){await page.screenshot({path:'artifacts/qa/lifecycle-failure.png'});console.error(error);process.exitCode=1;} finally{await browser.close();await preview.close();}
