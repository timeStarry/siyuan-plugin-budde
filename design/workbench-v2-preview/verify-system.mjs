import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';

export async function measureControls(page) {
  const controls = await page.locator('button:not(.item-card):not(.note-link),a.button,summary.button').evaluateAll(nodes => nodes.filter(el=>el.checkVisibility()).map(el => {
    const css=getComputedStyle(el), box=el.getBoundingClientRect();
    return {label:el.getAttribute('aria-label') || el.textContent.trim(),height:box.height,width:box.width,
      shared:el.classList.contains('button'),icon:el.classList.contains('icon-button'),font:css.fontSize,line:css.lineHeight,radius:css.borderRadius};
  }));
  for (const control of controls) {
    assert.equal(control.shared,true,`${control.label}: shared component`);
    assert.equal(control.height,36,`${control.label}: 36px height`);
    if(control.icon) assert.equal(control.width,36,`${control.label}: square icon control`);
    assert.equal(control.font,'13px',`${control.label}: control font`);
    assert.equal(control.line,'20px',`${control.label}: control line-height`);
    assert.equal(control.radius,'6px',`${control.label}: control radius`);
  }
  const icons = await page.locator('svg.icon').evaluateAll(nodes=>nodes.filter(el=>el.checkVisibility()).map(el=>({
    size:el.getBoundingClientRect().width,height:el.getBoundingClientRect().height,
    brand:!!el.closest('.brand'),stroke:getComputedStyle(el).strokeWidth
  })));
  for (const icon of icons) {
    assert.equal(icon.size,icon.brand?24:16); assert.equal(icon.height,icon.size); assert.equal(icon.stroke,'1.75px');
  }
  const content=await page.locator('.item-card,.note-link').evaluateAll(nodes=>nodes.filter(el=>el.checkVisibility()).map(el=>({
    kind:el.classList.contains('item-card')?'card':'note',height:el.getBoundingClientRect().height
  })));
  for(const entry of content)assert.ok(entry.height>=(entry.kind==='card'?80:56),`${entry.kind}: content entrance minimum height`);
  return {controls,icons,content};
}

// Let the browser convert rgb(), color(srgb …), and color-mix() to sRGB.
export async function sampleContrast(page, selectors) {
  return page.evaluate(selectors=>{
    const ctx=document.createElement('canvas').getContext('2d');
    const rgb=color=>{ctx.clearRect(0,0,1,1);ctx.fillStyle=color;ctx.fillRect(0,0,1,1);return [...ctx.getImageData(0,0,1,1).data];};
    const lum=color=>rgb(color).slice(0,3).map(n=>{const v=n/255;return v<=.04045?v/12.92:((v+.055)/1.055)**2.4;}).reduce((s,n,i)=>s+n*[.2126,.7152,.0722][i],0);
    const ratio=(a,b)=>(Math.max(lum(a),lum(b))+.05)/(Math.min(lum(a),lum(b))+.05);
    const background=node=>{
      for(let current=node;current;current=current.parentElement) {
        const color=getComputedStyle(current).backgroundColor;
        if(rgb(color)[3]===255)return color;
        if(rgb(color)[3]!==0)throw Error('Semi-transparent surface requires compositing');
      }
      throw Error('No opaque background');
    };
    return selectors.map(selector=>{
      const node=document.querySelector(selector),c=getComputedStyle(node);
      return {selector,color:c.color,background:background(node),ratio:ratio(c.color,background(node)),
        boundary:rgb(c.borderColor)[3]===255?ratio(c.borderColor,background(node.parentElement)):null};
    });
  },selectors);
}

export async function verifySupplemental(browser,output,errors,requests) {
  const page=await browser.newPage({viewport:{width:1440,height:1000},reducedMotion:'no-preference',colorScheme:'light'});
  page.on('pageerror',e=>errors.push(e.message));
  page.on('request',r=>{if(/^https?:/.test(r.url()))requests.push(r.url());});
  await page.goto(pathToFileURL(`${output}/budde-v2-system.html`).href);
  const duration=await page.evaluate(async()=>{
    document.querySelector('[aria-label="关闭详情"]').click();
    document.querySelector('#selected-card').click();
    const animation=document.querySelector('.detail').getAnimations()[0];
    const duration=animation.effect.getTiming().duration;
    await animation.finished;return duration;
  });
  assert.equal(duration,160,'Normal-motion reopening consumes panel duration token');
  await page.setViewportSize({width:320,height:800});
  // matchMedia's change event is delivered on the next rendering update.
  await page.waitForFunction(()=>document.querySelector('.detail').getAttribute('aria-modal')==='true');
  assert.equal(await page.locator('.detail').getAttribute('aria-modal'),'true');
  const open=await measureControls(page);
  await page.screenshot({path:`${output}/light-320.png`});
  await page.keyboard.press('Escape');
  assert.equal(await page.locator('.detail').isVisible(),false);
  const closed=await measureControls(page);
  const rootWidth=await page.evaluate(()=>document.documentElement.scrollWidth);
  assert.ok(rootWidth<=320,'Extreme narrow pane must not enlarge the grid track');
  await page.screenshot({path:`${output}/light-320-board.png`});
  await page.close();
  return {normalMotionDuration:duration,paneWidth:320,open,closed,rootWidth,passed:true};
}

export async function verifySystem(browser, output, html, errors, requests) {
  const css = id => html.match(new RegExp(`<style id="${id}">([\\s\\S]*?)</style>`))[1];
  assert.equal(await readFile(`${output}/budde-tokens.css`,'utf8'),css('budde-tokens'));
  assert.equal(await readFile(`${output}/budde-components.css`,'utf8'),css('budde-components'));
  const states=[], tokens={};
  for (const theme of ['light','dark']) for (const width of [1120,480]) {
    const page=await browser.newPage({viewport:{width,height:1000},colorScheme:theme,reducedMotion:'reduce'});
    page.on('pageerror',e=>errors.push(e.message));
    page.on('request',r=>{if(/^https?:/.test(r.url()))requests.push(r.url());});
    await page.goto(pathToFileURL(`${output}/budde-component-kit.html`).href);
    await page.evaluate(()=>document.fonts.ready);
    for(const id of ['budde-tokens','budde-components']) assert.equal(await page.locator(`#${id}`).textContent(),css(id),'Kit and page must use identical CSS');
    const dimensions=await measureControls(page);
    const metrics = (selector='#sample-default') => page.locator(selector).evaluate(el=>{const c=getComputedStyle(el),b=el.getBoundingClientRect();return {width:b.width,height:b.height,bg:c.backgroundColor,padding:c.paddingLeft,gap:c.gap,border:c.borderWidth};});
    const variants=[];
    for(const selector of ['#sample-default','#sample-primary','#sample-ghost']) {
      await page.mouse.move(0,0);
      const inspect=async()=>({...await metrics(selector),contrast:(await sampleContrast(page,[selector]))[0]});
      const normal=await inspect();
      assert.equal(normal.padding,'12px'); assert.equal(normal.gap,'8px'); assert.equal(normal.border,'1px');
      await page.locator(selector).hover(); const hover=await inspect();
      assert.notEqual(hover.bg,normal.bg,`${selector}: hover surface`);
      await page.mouse.down(); const pressed=await inspect(); await page.mouse.up();
      assert.notEqual(pressed.bg,hover.bg,`${selector}: pressed surface`);
      for(const state of [normal,hover,pressed]) {
        assert.equal(state.height,normal.height); assert.equal(state.width,normal.width);
        assert.ok(state.contrast.ratio>=4.5,`${theme} ${selector}: state text contrast`);
        if(selector!=='#sample-ghost')assert.ok(state.contrast.boundary>=3,`${theme} ${selector}: state boundary contrast`);
      }
      variants.push({selector,normal,hover,pressed});
    }
    const {normal,hover,pressed}=variants[0];
    await page.locator('#sample-default').evaluate(el=>{el.disabled=true;el.setAttribute('aria-busy','true');});
    const busy=await metrics(); assert.equal(busy.width,normal.width); assert.equal(busy.height,normal.height);
    assert.equal(await page.locator('#sample-loading').isDisabled(),true);
    assert.equal(await page.locator('#sample-loading').getAttribute('aria-busy'),'true');
    await page.locator('#sample-default').evaluate(el=>{el.disabled=false;el.removeAttribute('aria-busy');});
    await page.mouse.move(0,0);
    await page.evaluate(()=>{
      const test=document.createElement('span'); test.id='color-regression';
      test.style.cssText='color:color(srgb 0 0 0);background:color(srgb 1 1 1)';
      document.querySelector('main').append(test);
    });
    const [colorRegression]=await sampleContrast(page,['#color-regression']);
    assert.match(colorRegression.background,/^color\(srgb /); assert.equal(colorRegression.ratio,21);
    await page.locator('#color-regression').evaluate(el=>el.remove());
    await page.keyboard.press('Tab'); await page.locator('#sample-focus').focus();
    const focus=await page.locator('#sample-focus').evaluate(el=>{const c=getComputedStyle(el);return {visible:el.matches(':focus-visible'),width:c.outlineWidth,offset:c.outlineOffset,style:c.outlineStyle};});
    assert.deepEqual(focus,{visible:true,width:'2px',offset:'2px',style:'solid'});
    const contrast=await sampleContrast(page,['#sample-primary','#sample-focus']);
    for(const c of contrast) {assert.ok(c.ratio>=4.5,`${theme}: text contrast`); assert.ok(c.boundary>=3,`${theme}: control boundary contrast`);}
    const geometry=await page.evaluate(()=>({width:document.documentElement.scrollWidth,viewport:innerWidth}));
    assert.ok(geometry.width<=geometry.viewport,'Kit must not overflow horizontally');
    tokens[theme]=await page.evaluate(()=>Object.fromEntries([...document.querySelectorAll('[data-token]')].map(el=>[el.dataset.token,getComputedStyle(document.documentElement).getPropertyValue(el.dataset.token).trim()])));
    assert.ok(Object.keys(tokens[theme]).length>=100,'Complete token inventory');
    await page.emulateMedia({reducedMotion:'no-preference'});
    assert.equal(await page.locator('#sample-focus').evaluate(el=>getComputedStyle(el).transitionDuration),'0.12s, 0.12s, 0.12s');
    await page.emulateMedia({reducedMotion:'reduce'});
    assert.equal(await page.locator('#sample-focus').evaluate(el=>getComputedStyle(el).transitionDuration),'0s');
    await page.screenshot({path:`${output}/system-${theme}-${width}.png`,fullPage:true});
    states.push({theme,width,dimensions,variants,normal,hover,pressed,busy,focus,contrast,colorRegression,passed:true});
    await page.close();
  }
  await writeFile(`${output}/tokens.json`,JSON.stringify({source:'index.html#budde-tokens',values:tokens},null,2));
  return states;
}
