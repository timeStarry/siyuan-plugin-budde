import { readFile } from 'node:fs/promises';
import { chromium, expect } from '@playwright/test';
import { startPreview } from './preview.mjs';
// Built CJS in a browser DOM, with a synthetic SiYuan API and in-memory service.
// Actual Node built-ins/storage loader are separately exercised by smoke-plugin.
const preview=await startPreview();const browser=await chromium.launch({channel:'msedge',headless:true});const page=await browser.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
try{
  await page.goto(preview.url);await expect(page.locator('[data-part="capture-title"]')).toBeEnabled();
  await page.evaluate(({code,css})=>{
    window.buddeTest.view.destroy();const style=document.createElement('style');style.textContent=css;document.head.append(style);
    const registrations={tabs:[],commands:[],topbars:[],opened:[],icons:[]};window.hostRegistrations=registrations;
    class Plugin{constructor(){this.name='siyuan-plugin-budde';this.app={};}addIcons(svg){registrations.icons.push(svg);}addTab(options){registrations.tabs.push(options);}addCommand(options){registrations.commands.push(options);}addTopBar(options){registrations.topbars.push(options);}}
    const host={Plugin,openTab:async options=>{registrations.opened.push(options);},showMessage:()=>{}};
    window.siyuan={config:{system:{dataDir:'/synthetic-only/data'}}};
    const require=name=>{if(name==='siyuan')return host;if(name==='node:path')return{resolve:value=>value,join:(...parts)=>parts.join('/')};if(name==='node:crypto')return{randomUUID:()=>crypto.randomUUID()};if(name.startsWith('node:'))return{};throw Error(`Unexpected external ${name}`);};
    const module={exports:{}};new Function('require','module','exports',code)(require,module,module.exports);
    const plugin=new module.exports.default();window.hostPlugin=plugin;plugin.onload();
    if(!plugin.service||!plugin.notes)throw Error('CJS host initialization failed');
    plugin.service=window.buddeTest.client;plugin.notes=window.buddeTest.notes;plugin.onLayoutReady();
    registrations.tabs[0].init.call({element:document.querySelector('#workbench')});
  },{code:await readFile('dist/index.js','utf8'),css:await readFile('dist/index.css','utf8')});
  const capture=page.locator('[data-part="capture-title"]');await expect(capture).toBeEnabled();await capture.fill('构建产物页签初始化');await page.locator('[data-part="capture"] button').click();await expect(capture).toHaveValue('');
  await page.getByRole('button',{name:'构建产物页签初始化',exact:true}).click();await expect(page.locator('.detail-read')).toContainText('构建产物页签初始化');
  expect(await page.evaluate(()=>window.hostRegistrations.tabs[0].type)).toBe('workbench');
  const hostMark=await page.evaluate(()=>{
    const symbol=new DOMParser().parseFromString(window.hostRegistrations.icons[0],'image/svg+xml').querySelector('symbol');
    const icon=document.querySelector('.brand [data-icon="brand"]');
    return {hostPath:symbol.querySelector('path').getAttribute('d'),workbenchPath:icon.querySelector('path').getAttribute('d'),hostViewBox:symbol.getAttribute('viewBox'),workbenchViewBox:icon.getAttribute('viewBox'),topbarIcon:window.hostRegistrations.topbars[0].icon};
  });
  expect(hostMark.hostPath).toBeTruthy();expect(hostMark.hostPath).toBe(hostMark.workbenchPath);expect(hostMark.hostViewBox).toBe(hostMark.workbenchViewBox);expect(hostMark.topbarIcon).toBe('iconBudde');
  await page.evaluate(()=>{window.hostRegistrations.commands[0].callback();window.hostRegistrations.topbars[0].callback();});
  await expect.poll(()=>page.evaluate(()=>window.hostRegistrations.opened.length)).toBe(2);
  await page.evaluate(()=>window.hostRegistrations.tabs[0].destroy.call({element:document.querySelector('#workbench')}));await expect(page.locator('#workbench')).toBeEmpty();
  await page.evaluate(()=>{window.hostRegistrations.tabs[0].init.call({element:document.querySelector('#workbench')});});await expect(capture).toBeEnabled();
  await page.evaluate(()=>window.hostPlugin.onunload());await expect(page.locator('#workbench')).toBeEmpty();expect(errors).toEqual([]);
  console.log('Built CJS tab.init, production UI capture/read, command/topbar, tab.destroy/remount and unload passed in synthetic browser host. Not a native SiYuan acceptance.');
}finally{await browser.close();await preview.close();}
