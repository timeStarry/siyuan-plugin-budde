import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { chromium } from '@playwright/test';
import { measureControls, verifySystem, sampleContrast, verifySupplemental } from './verify-system.mjs';
import { buildDesignSystem } from './system.mjs';

const source = fileURLToPath(new URL('./index.html', import.meta.url));
const output = fileURLToPath(new URL('../../artifacts/design/workbench-v2-system/', import.meta.url));
await mkdir(output, { recursive: true });
const html = await readFile(source, 'utf8');
await writeFile(`${output}/budde-v2-system.html`, html);
const kit=buildDesignSystem(html);
await writeFile(`${output}/budde-component-kit.html`,kit.page);
await writeFile(`${output}/budde-tokens.css`,kit.tokens);
await writeFile(`${output}/budde-components.css`,kit.components);
const browser = await chromium.launch({ channel: 'msedge', headless: true });
const captures = [];
const errors = [], requests = [];
try {
  for (const theme of ['light', 'dark']) {
    for (const [width, height] of [[1440,1000],[1024,768],[720,900],[480,800]]) {
      const page = await browser.newPage({ viewport: { width,height }, colorScheme: theme, reducedMotion: 'reduce' });
      page.on('pageerror', e => errors.push(e.message));
      page.on('request', r => { if (/^https?:/.test(r.url())) requests.push(r.url()); });
      await page.goto(pathToFileURL(`${output}/budde-v2-system.html`).href);
      await page.evaluate(() => document.fonts.ready);
      assert.equal(await page.locator('input,textarea,select').count(),0,'Reading is not an edit form');
      assert.equal(await page.locator('.stage-path li').count(),4);
      assert.equal(await page.locator('.stage-path [aria-current="step"]').innerText(),'验证\n当前');
      assert.equal(await page.locator('.stage-path svg').count(),0,'No false completed-node ticks');
      assert.equal(await page.locator('[data-theme-choice="'+theme+'"]').getAttribute('aria-pressed'),'true');
      assert.equal(await page.locator('[href^="https"],[src^="http"]').count(),0);
      const components = await measureControls(page);
      for(const id of ['budde-tokens','budde-components','budde-layout']) assert.equal(await page.locator(`#${id}`).count(),1);
      const palette = await page.evaluate(() => ['html','.brand .icon','.primary','.nav-button.is-active','.item-card.selected','.path-node.current','.review-status','.detail','.capture-area'].map(selector=>{
        const css=getComputedStyle(document.querySelector(selector));
        return {selector,color:css.color,background:css.backgroundColor,border:css.borderColor};
      }));
      for(const sample of palette) for(const key of ['color','background','border']) {
        const [r,g,b]=sample[key].match(/[\d.]+/g).slice(0,3).map(Number);
        assert.ok(r===g && g===b,`${theme} ${sample.selector} ${key} is not neutral: ${sample[key]}`);
      }
      const geometry = await page.evaluate(() => {
        const root = document.documentElement;
        const d = document.querySelector('.detail').getBoundingClientRect();
        const p = document.querySelector('.path-scroll');
        return { outerWidth:root.scrollWidth, outerHeight:root.scrollHeight,
          detail:{x:d.x,y:d.y,width:d.width,right:d.right,bottom:d.bottom},
          path:{clientWidth:p.clientWidth,scrollWidth:p.scrollWidth},
          scrim:document.querySelector('#scrim').getBoundingClientRect().toJSON(),
          footerInsideDetail:document.querySelector('.detail').contains(document.querySelector('.preview-bar')) };
      });
      assert.ok(geometry.outerWidth <= width,JSON.stringify(geometry));
      assert.ok(geometry.outerHeight <= height,JSON.stringify(geometry));
      assert.equal(Math.round(geometry.detail.width),width < 720 ? width : 420);
      assert.ok(geometry.detail.right <= width && geometry.detail.x >= 0);
      assert.equal(geometry.footerInsideDetail,width < 1200);
      if(width < 1200) {
        assert.equal(geometry.detail.y,0); assert.equal(geometry.detail.bottom,height);
        assert.equal(geometry.scrim.y,0); assert.equal(geometry.scrim.height,height);
      }
      assert.match(await page.locator('.review-status').innerText(),/需复查/);
      const ratios = await sampleContrast(page,['.detail-title','.section-title','.description p','.next-step p','.path-node.current .path-label','.path-node .path-label','.path-caption','.capture-prompt','.primary','.card-note','.review-mark','.preview-caption','.status-label','.review-status']);
      for(const check of ratios) assert.ok(check.ratio>=4.5,`${theme} ${check.selector} ${check.ratio}`);
      await page.screenshot({ path:`${output}/${theme}-${width}.png`, fullPage:true });
      // Small preview affordances, not business behavior.
      if(width < 1200) {
        await page.locator('[data-theme-choice="dark"]').focus();
        await page.keyboard.press('Tab');
        assert.equal(await page.evaluate(()=>document.activeElement.textContent.trim()),'编辑','Theme controls participate in the modal focus cycle');
        await page.keyboard.press('Shift+Tab');
        assert.equal(await page.evaluate(()=>document.activeElement.getAttribute('aria-label')),'深色主题','Reverse modal focus cycle');
        await page.keyboard.press('Escape');
        assert.equal(await page.locator('.detail').isVisible(),false);
        assert.equal(await page.evaluate(()=>document.activeElement.id),'selected-card','Escape restores selected card focus');
        await page.locator('#selected-card').click();
      }
      await page.getByRole('button',{name:'关闭详情',exact:true}).click();
      assert.equal(await page.locator('.detail').isVisible(),false);
      const afterClose=await measureControls(page);
      assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'Closed detail must not cause page overflow');
      await page.screenshot({path:`${output}/${theme}-${width}-board.png`,fullPage:true});
      await page.locator('#selected-card').click();
      assert.equal(await page.locator('.detail').isVisible(),true);
      await page.getByRole('button',{name:'编辑',exact:true}).click();
      assert.match(await page.locator('#preview-message').innerText(),/静态视觉草图/);
      assert.equal(await page.locator('input,textarea,select').count(),0);
      await page.getByRole('button',{name:theme==='light'?'深色主题':'浅色主题',exact:true}).click();
      assert.equal(await page.locator('html').getAttribute('data-theme'),theme==='light'?'dark':'light');
      captures.push({theme,width,height,geometry,components,afterClose,palette,contrast:ratios,passed:true});
      await page.close();
    }
  }
  // Probe the host contract without claiming real SiYuan integration.
  const host = await browser.newPage({ viewport:{width:1440,height:1000} });
  await host.goto(pathToFileURL(source).href);
  const mapped = await host.evaluate(() => {
    const root=document.documentElement;
    // A colored host primary must not reintroduce a green brand palette.
    root.style.setProperty('--b3-theme-primary','rgb(63, 113, 86)');
    root.style.setProperty('--b3-theme-primary-lightest','rgb(237, 244, 239)');
    root.style.setProperty('--b3-theme-on-background','rgb(31, 31, 31)');
    root.style.setProperty('--b3-theme-background','rgb(250, 250, 250)');
    root.style.setProperty('--b3-theme-surface','rgb(238, 238, 238)');
    root.style.setProperty('--b3-font-family','serif');
    return {accent:getComputedStyle(document.querySelector('.status-label')).color,
      background:getComputedStyle(document.querySelector('.detail')).backgroundColor,
      canvas:getComputedStyle(document.querySelector('.capture-area')).backgroundColor,
      selected:getComputedStyle(document.querySelector('.item-card.selected')).backgroundColor,
      font:getComputedStyle(document.querySelector('.detail-title')).fontFamily};
  });
  assert.equal(mapped.accent,'rgb(31, 31, 31)');
  assert.equal(mapped.background,'rgb(250, 250, 250)');
  assert.equal(mapped.canvas,'rgb(238, 238, 238)');
  assert.equal(mapped.selected,'rgb(233, 233, 233)');
  assert.notEqual(mapped.background,mapped.canvas,'Host surfaces remain distinct');
  assert.equal(mapped.font,'serif');
  await host.close();
  const system=await verifySystem(browser,output,html,errors,requests);
  const supplemental=await verifySupplemental(browser,output,errors,requests);
  assert.deepEqual(errors,[]); assert.deepEqual(requests,[]);
  await writeFile(`${output}/results.json`,JSON.stringify({generatedAt:new Date().toISOString(),
    scope:'Static visual preview only; no business, persistence, or real SiYuan acceptance',
    sourceSha256:createHash('sha256').update(html).digest('hex'),captures,system,supplemental,hostTokenProbe:mapped,pageErrors:errors,networkRequests:requests},null,2));
  console.log(`PASS ${captures.length} workbench configurations + ${system.length} component-kit configurations; shared 36px controls, 16px icons, states, contrast, responsive layout, same-source CSS, host probe, normal-motion160ms and 320px open/closed; no page errors or HTTP(S).`);
} finally { await browser.close(); }
