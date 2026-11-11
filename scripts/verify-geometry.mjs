import { chromium, expect } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
import { startPreview } from './preview.mjs';
const preview=await startPreview();const browser=await chromium.launch({channel:'msedge',headless:true});const page=await browser.newPage({viewport:{width:1440,height:1000},reducedMotion:'reduce'});const errors=[];page.on('pageerror',e=>errors.push(e.message));const checked=[];
async function geometry(label){
  const metrics=await page.evaluate(()=>{const root=document.querySelector('.budde');return{overflow:root.scrollWidth-root.clientWidth,controls:[...root.querySelectorAll('button:not(.card-open):not(.note-link):not([data-detail-stage-target]),summary,input:not([type=checkbox]),select')].filter(n=>n.getClientRects().length&&!n.closest('[inert]')).map(n=>({label:n.getAttribute('aria-label')||n.textContent,height:n.getBoundingClientRect().height})),stageControls:[...root.querySelectorAll('[data-detail-stage-target]')].filter(n=>n.getClientRects().length&&!n.closest('[inert]')).map(n=>n.getBoundingClientRect().height),dialogOverflow:[...root.querySelectorAll('dialog[open]')].map(n=>n.scrollWidth-n.clientWidth)};});
  expect(metrics.overflow,label).toBeLessThanOrEqual(1);expect(metrics.dialogOverflow.every(n=>n<=1),label).toBe(true);expect(metrics.controls.filter(n=>Math.abs(n.height-36)>.1),label).toEqual([]);expect(metrics.stageControls.every(height=>height>=36),label).toBe(true);checked.push(label);
}
try{
  await mkdir('artifacts/qa',{recursive:true});await page.goto(preview.url);await expect(page.locator('[data-part="capture-title"]')).toBeEnabled();
  await page.evaluate(async()=>{const {client}=window.buddeTest;let state=await client.snapshot();const type=state.types[0];state=(await client.execute({kind:'type.update',id:type.id,name:'超长类型名称与离线资料管理'.repeat(10).slice(0,120),expectedRevision:state.revision})).state;await client.execute({kind:'stage.update',typeId:type.id,id:type.stages[0].id,name:'LongUnbrokenStageName'.repeat(6).slice(0,120),completed:false,expectedRevision:state.revision});const result=await window.buddeTest.client.execute({kind:'item.create',requestId:crypto.randomUUID(),title:'工作台几何测试'});const item=result.state.items[0];await window.buddeTest.client.execute({kind:'item.update',id:item.id,expectedVersion:item.version,patch:{promoted:true}});await window.buddeTest.view.refresh();});
  for(const theme of ['light','dark'])for(const width of [1440,1024,720,480,320]){
    await page.evaluate(({theme,width})=>{const root=document.querySelector('.budde');root.dataset.theme=theme;root.style.width=width+'px';},{theme,width});
    for(const view of ['pool','board','active','archive']){await page.locator(`[data-view="${view}"]`).click();await geometry(`${theme}/${width}/${view}`);}
    await page.locator('[data-view="pool"]').click();
    if(width===320)await page.screenshot({path:`artifacts/qa/surface-${theme}-320.png`});
    await page.locator('[data-view="board"]').click();await page.locator('[data-action="type.settings"]').first().click();await expect(page.locator('[data-part="settings-dialog"]')).toBeVisible();
    await page.locator('[data-settings-action="type.update"]').click();await geometry(`${theme}/${width}/settings-edit`);
    if(width===320)await page.screenshot({path:`artifacts/qa/settings-${theme}-320.png`});
    await page.locator('[data-editor-field="name"]').fill('未保存的设置');await page.locator('[data-settings-action="close"]').click();await expect(page.locator('.guard-dialog')).toBeVisible();await geometry(`${theme}/${width}/guard`);
    await page.locator('[data-choice="discard"]').click();await expect(page.locator('[data-part="settings-dialog"]')).not.toBeVisible();
    await page.locator('[data-view="pool"]').click();await page.getByRole('button',{name:'工作台几何测试',exact:true}).click();await page.locator('[data-detail-action="edit"]').click();await geometry(`${theme}/${width}/detail-edit`);
    await page.locator('[data-detail-action="cancel-edit"]').click();await page.locator('[data-detail-action="close"]').click();
  }
  expect(errors).toEqual([]);await writeFile('artifacts/qa/geometry.json',JSON.stringify({checked,errors},null,2));console.log(`36px controls and no external/dialog overflow: ${checked.length} light/dark width/view/editor/guard combinations passed.`);
}catch(error){console.error(await page.evaluate(()=>['.budde','.dialog-layer:has(dialog[open])','dialog[open]'].map(selector=>{const n=document.querySelector(selector);return n&&{selector,width:n.getBoundingClientRect().width,left:n.getBoundingClientRect().left,scrollWidth:n.scrollWidth,columns:getComputedStyle(n).gridTemplateColumns};})));await page.screenshot({path:'artifacts/qa/geometry-failure.png'});throw error;}finally{await browser.close();await preview.close();}
