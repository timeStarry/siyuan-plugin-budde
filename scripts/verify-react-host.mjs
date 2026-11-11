import { chromium, expect } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
import { startPreview } from './preview.mjs';
const output = 'artifacts/qa/react-host';
await mkdir(output, {recursive:true});
const preview = await startPreview();
const browser = await chromium.launch({channel:'msedge',headless:true});
const page = await browser.newPage({viewport:{width:1440,height:900}});
page.setDefaultTimeout(4000);
const checks = [], errors = [];
page.on('pageerror', e => errors.push(e.message));
const check = async (name, run) => {try {await run();checks.push({name,passed:true});} catch(error) {checks.push({name,passed:false,error:error.message});await page.screenshot({path:`${output}/failure-${checks.length}.png`,animations:'disabled'});}};
const part = name => page.locator(`#workbench [data-part="${name}"]`);
const card = id => page.locator(`#workbench [data-item-id="${id}"]`);
const settle = () => page.waitForFunction(() => !document.querySelector('[data-motion-busy="true"]'));
const sensorReady = () => page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
const board = async () => {await expect(part('capture-title')).toBeEnabled();await page.locator('[data-view="board"]').click();await page.locator('[data-board-type="software"]').click();await settle();};
const remount = () => page.evaluate(() => {const t=window.buddeTest;t.view.destroy();t.view=t.mount(document.querySelector('#workbench'),t.client,t.notes);});
const itemStage = id => page.evaluate(async id => (await window.buddeTest.client.snapshot()).items.find(i=>i.id===id).stageId,id);
const pointerStart = async handle => {const box=await handle.boundingBox();await page.mouse.move(box.x+box.width/2,box.y+box.height/2);await page.mouse.down();await page.mouse.move(box.x+box.width/2+20,box.y+box.height/2+20,{steps:5});await expect(page.locator('[data-drag-overlay]')).toBeVisible();};
try {
  await page.goto(preview.url);
  await expect(part('capture-title')).toBeEnabled();
  const fixture = await page.evaluate(async () => {
    const root=document.querySelector('#workbench');Object.assign(root.style,{position:'absolute',left:'120px',top:'80px',width:'900px',height:'600px'});
    const host=document.createElement('button');host.id='host-probe';host.textContent='Host';host.style='position:absolute;left:20px;top:20px';host.addEventListener('click',()=>window.hostClicks=(window.hostClicks??0)+1);document.body.append(host);
    const {client,view}=window.buddeTest;let first;const stages=(await client.snapshot()).types.find(t=>t.id==='software').stages;
    for(const index of [0,2]) {const made=await client.execute({kind:'item.create',requestId:crypto.randomUUID(),typeId:'software',title:`键盘与宿主边界验收 ${index}`});const item=made.state.items.find(i=>i.id===made.itemId);if(!index)first=item.id;await client.execute({kind:'item.update',id:item.id,expectedVersion:item.version,patch:{promoted:true,stageId:stages[index].id,paused:true,nextStep:'两行很长的下一步摘要。必须先到相邻空阶段，不能因为卡片密度和大小不同跳过该阶段。'}});}
    await view.refresh();return {first,stages:stages.map(s=>s.id)};
  });
  await board();
  await check('local Radix menu stays aligned inside an offset host pane',async()=>{
    const trigger=page.locator('.header-secondary [data-menu-trigger]');await trigger.click();
    const menu=page.getByRole('menu');await expect(menu).toBeVisible();
    const a=await trigger.boundingBox(), b=await menu.boundingBox(), root=await page.locator('.budde').boundingBox();
    expect(b.x+b.width).toBeLessThanOrEqual(root.x+root.width+1);expect(Math.abs(b.x+b.width-a.x-a.width)).toBeLessThan(3);expect(b.y).toBeGreaterThanOrEqual(a.y+a.height);expect(b.y-a.y-a.height).toBeLessThan(12);
  });
  await page.keyboard.press('Escape');await expect(page.getByRole('menu')).toHaveCount(0);await sensorReady();
  await check('header menu commands run once and settings restores persistent trigger',async()=>{
    const trigger=page.locator('.header-secondary [data-menu-trigger]');await trigger.focus();await page.keyboard.press('Enter');await page.getByRole('menu').getByRole('menuitem',{name:'管理类型与阶段'}).focus();await page.keyboard.press('Enter');
    await expect(part('settings-dialog')).toBeVisible();await page.locator('[data-settings-action="close"]').click();await expect(trigger).toBeFocused();
  });
  await check('keyboard drag reaches adjacent empty stage and returns in one arrow',async()=>{
    for(const [arrow,target] of [['ArrowRight',fixture.stages[1]],['ArrowLeft',fixture.stages[0]]]) {const handle=page.locator(`[data-item-id="${fixture.first}"] [data-drag-handle]`);await handle.focus();await page.keyboard.press('Space');await expect(handle).toHaveAttribute('aria-pressed','true');await sensorReady();await page.keyboard.press(arrow);await expect(page.locator(`.stage-column[data-stage-id="${target}"]`)).toHaveAttribute('data-drag-over','true');await page.keyboard.press('Space');await expect.poll(()=>itemStage(fixture.first)).toBe(target);await expect(handle).toBeFocused();}
  });
  await page.keyboard.press('Escape');
  await check('pointer overlay follows source without doubling host offset',async()=>{
    const card=page.locator(`[data-item-id="${fixture.first}"]`);const before=await card.boundingBox();
    try {await pointerStart(card.locator('[data-drag-handle]'));const overlay=await page.locator('[data-drag-overlay]').boundingBox();expect(Math.abs(overlay.x-before.x-20)).toBeLessThan(3);expect(Math.abs(overlay.y-before.y-20)).toBeLessThan(3);} finally {await page.keyboard.press('Escape');await page.mouse.up();}
  });
  await check('long stage menu scrolls within a short local pane',async()=>{
    await page.evaluate(async()=>{const {client,view}=window.buddeTest;for(let n=0;n<22;n++){const state=await client.snapshot();await client.execute({kind:'stage.add',typeId:'software',expectedRevision:state.revision,name:`阶段 ${n}：一个用于溢出验收的较长名称`});}await view.refresh();});
    const card=page.locator(`[data-item-id="${fixture.first}"]`);await card.locator('[data-menu-trigger]').click();const menu=page.getByRole('menu');await expect(menu).toBeVisible();
    const metrics=await menu.evaluate(node=>{const rect=node.getBoundingClientRect(),root=node.closest('.budde').getBoundingClientRect();return {top:rect.top,bottom:rect.bottom,rootTop:root.top,rootBottom:root.bottom,height:node.clientHeight,scroll:node.scrollHeight,overflow:getComputedStyle(node).overflowY};});
    expect(metrics.top).toBeGreaterThanOrEqual(metrics.rootTop);expect(metrics.bottom).toBeLessThanOrEqual(metrics.rootBottom+1);expect(metrics.scroll).toBeGreaterThan(metrics.height);expect(metrics.overflow).toBe('auto');
    await menu.getByRole('menuitem').last().scrollIntoViewIfNeeded();await expect(menu.getByRole('menuitem').last()).toBeInViewport();
  });
  await page.keyboard.press('Escape');
  // Track global sensor listener ownership, not React's retained root delegation.
  await page.evaluate(()=>{
    const add=EventTarget.prototype.addEventListener, remove=EventTarget.prototype.removeEventListener, records=[];
    const tracked=(target,type)=> (target===document||target===window)&&['pointermove','pointerup','keydown','click','selectionchange','resize','visibilitychange','focusin'].includes(type);
    const capture=options=>typeof options==='boolean'?options:!!options?.capture;
    const forget=record=>{const index=records.indexOf(record);if(index>=0)records.splice(index,1);};
    EventTarget.prototype.addEventListener=function(type,fn,options){
      if(!tracked(this,type)||!fn)return add.call(this,type,fn,options);
      let record=records.find(r=>r.target===this&&r.type===type&&r.fn===fn&&r.capture===capture(options));
      if(!record){record={target:this,type,fn,capture:capture(options),wrapped:fn};
        if(options?.once)record.wrapped=function(event){forget(record);return typeof fn==='function'?fn.call(this,event):fn.handleEvent(event);};
        if(!options?.signal?.aborted)records.push(record);
        if(options?.signal)add.call(options.signal,'abort',()=>forget(record),{once:true});
      }
      return add.call(this,type,record.wrapped,options);
    };
    EventTarget.prototype.removeEventListener=function(type,fn,options){const record=records.find(r=>r.target===this&&r.type===type&&r.fn===fn&&r.capture===capture(options));if(record)forget(record);return remove.call(this,type,record?.wrapped??fn,options);};
    let baseline=[];window.sensorAuditBegin=()=>baseline=records.slice();
    window.sensorAudit=()=>records.filter(r=>!baseline.some(b=>b.target===r.target&&b.type===r.type&&b.fn===r.fn&&b.capture===r.capture)).map(r=>`${r.target===window?'window':'document'}:${r.type}:${r.capture}`).sort();
  });
  for(const mode of ['pointer','keyboard']) for(const action of ['replace-collection','destroy']) {
    await check(`${mode} sensor releases host listeners on ${action}`,async()=>{
      await page.mouse.move(30,30);await expect(page.getByRole('tooltip')).toHaveCount(0);await page.evaluate(()=>window.sensorAuditBegin());const handle=page.locator(`[data-item-id="${fixture.first}"] [data-drag-handle]`);
      try {
        if(mode==='pointer')await pointerStart(handle);else {await handle.focus();await page.keyboard.press('Space');await expect(handle).toHaveAttribute('aria-pressed','true');}
        if(action==='destroy')await page.evaluate(()=>window.buddeTest.view.destroy());else await page.evaluate(()=>window.buddeTest.replaceCollection());
        await page.mouse.move(30,30);
        await expect.poll(()=>page.evaluate(()=>window.sensorAudit()),{timeout:1500}).toEqual([]);
        await page.locator('#host-probe').click();expect(await page.evaluate(()=>window.hostClicks)).toBeGreaterThan(0);
      } finally {await page.keyboard.press('Escape');await page.mouse.up();await remount();await board();}
    });
  }
  await check('keyboard drag relinquishes keys to another control or another instance',async()=>{
    try {
      await page.evaluate(()=>{const other=document.createElement('div');other.id='second-workbench';other.style.cssText='position:absolute;left:1040px;top:80px;width:360px;height:600px';document.body.append(other);window.otherView=window.buddeTest.mount(other,window.buddeTest.client,window.buddeTest.notes);});
      for(const selector of ['#workbench','#second-workbench']) {
        const input=page.locator(`${selector} [data-part="capture-title"]`);await expect(input).toBeEnabled();
        const handle=card(fixture.first).locator('[data-drag-handle]');await handle.focus();await page.keyboard.press('Space');await expect(handle).toHaveAttribute('aria-pressed','true');await sensorReady();
        await input.focus();await expect(page.locator('[data-drag-overlay]')).toHaveCount(0);await input.fill('host');await page.keyboard.press('Space');await page.keyboard.press('ArrowLeft');await sensorReady();await expect(input).toBeFocused();await expect(input).toHaveValue('host ');await input.fill('');
      }
      expect(await page.evaluate(id=>window.buddeTest.client.snapshot().then(s=>s.items.find(i=>i.id===id).stageId),fixture.first)).toBe(fixture.stages[0]);
    } finally {await page.keyboard.press('Escape');await page.evaluate(()=>{window.otherView?.destroy();document.querySelector('#second-workbench')?.remove();});}
  });
  await check('dragging near an outer scrollable host edge scrolls only the collection',async()=>{
    try {
      await page.evaluate(()=>{const root=document.querySelector('#workbench');window.oldRootStyle=root.getAttribute('style');const host=document.createElement('div');host.id='scroll-host';host.style.cssText='position:absolute;left:120px;top:80px;width:900px;height:600px;overflow:auto';const plane=document.createElement('div');plane.style.cssText='position:relative;width:1400px;height:1200px';root.replaceWith(host);host.append(plane);plane.append(root);root.style.left='0';root.style.top='0';});
      const handle=card(fixture.first).locator('[data-drag-handle]');const b=await handle.boundingBox();await page.mouse.move(b.x+b.width/2,b.y+b.height/2);await page.mouse.down();await page.mouse.move(b.x+b.width/2+20,b.y+b.height/2+8);await expect(page.locator('[data-drag-overlay]')).toHaveCount(1);await page.mouse.move(1000,665,{steps:8});await page.evaluate(()=>new Promise(resolve=>{let frames=12;const frame=()=>--frames?requestAnimationFrame(frame):resolve();requestAnimationFrame(frame);}));
      expect(await page.locator('#scroll-host').evaluate(n=>({left:n.scrollLeft,top:n.scrollTop}))).toEqual({left:0,top:0});
    } finally {await page.keyboard.press('Escape');await page.mouse.up();await page.evaluate(()=>{const root=document.querySelector('#workbench');document.querySelector('#scroll-host')?.replaceWith(root);root.setAttribute('style',window.oldRootStyle);});await remount();await board();}
  });
  await check('pointer drop in lower empty-column space remains a valid stage target',async()=>{
    try {const handle=card(fixture.first).locator('[data-drag-handle]');const b=await handle.boundingBox();const target=await page.locator(`.stage-column[data-stage-id="${fixture.stages[1]}"]`).boundingBox();const viewport=await part('collection').boundingBox();await page.mouse.move(b.x+b.width/2,b.y+b.height/2);await page.mouse.down();await page.mouse.move(b.x+b.width/2+20,b.y+b.height/2+8);await expect(page.locator('[data-drag-overlay]')).toHaveCount(1);await page.mouse.move(target.x+target.width/2,viewport.y+viewport.height-18,{steps:12});await page.mouse.up();await expect.poll(()=>page.evaluate(id=>window.buddeTest.client.snapshot().then(s=>s.items.find(i=>i.id===id).stageId),fixture.first)).toBe(fixture.stages[1]);}
    finally {await page.keyboard.press('Escape');await page.mouse.up();await page.evaluate(async({id,stageId})=>{const {client,view}=window.buddeTest;const s=await client.snapshot();const item=s.items.find(i=>i.id===id);if(item.stageId!==stageId)await client.execute({kind:'item.update',id,expectedVersion:item.version,patch:{stageId}});await view.refresh();},{id:fixture.first,stageId:fixture.stages[0]});}
  });
  await check('reduced-motion preference opens and closes the actual drawer without displacement tweening',async()=>{
    const reduced=await browser.newPage({viewport:{width:1280,height:800},reducedMotion:'reduce'});
    try {await reduced.goto(preview.url);await expect(reduced.locator('[data-part="capture-title"]')).toBeEnabled();const id=await reduced.evaluate(async()=>{const {client,view}=window.buddeTest;const made=await client.execute({kind:'item.create',requestId:crypto.randomUUID(),title:'减少动态效果验收',typeId:'general'});await view.refresh();return made.itemId;});
      const frame=()=>reduced.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
      await reduced.evaluate(id=>document.querySelector(`[data-open="${id}"]`).click(),id);await frame();expect(await reduced.locator('.detail-frame').evaluate(n=>n.getBoundingClientRect().width)).toBe(420);expect(await reduced.locator('[data-detail-action="edit"]').evaluate(n=>parseFloat(getComputedStyle(n).transitionDuration))).toBeLessThanOrEqual(0.001);
      await reduced.evaluate(()=>document.querySelector('[data-detail-action="close"]').click());await frame();expect(await reduced.locator('.detail-frame').evaluate(n=>n.getBoundingClientRect().width)).toBe(0);
    } finally {await reduced.close();}
  });
  await check('host retains focus, page scrolling and no uncaught errors',async()=>{await page.locator('#host-probe').focus();await expect(page.locator('#host-probe')).toBeFocused();expect(await page.locator('body').evaluate(n=>n.style.overflow)).toBe('');expect(errors).toEqual([]);});
} finally {await browser.close();await preview.close();}
await writeFile(`${output}/report.json`,JSON.stringify({checks},null,2));console.log(JSON.stringify(checks,null,2));if(checks.some(c=>!c.passed))process.exitCode=1;
