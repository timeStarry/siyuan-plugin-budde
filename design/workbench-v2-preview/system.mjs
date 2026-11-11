// Extract, never fork: these blocks are the only token/component source.
export function buildDesignSystem(html) {
  const block=id=>{
    const match=html.match(new RegExp(`<style id="${id}">([\\s\\S]*?)</style>`));
    if(!match)throw new Error(`Missing canonical style block: ${id}`);
    return match[1];
  };
  const tokens=block('budde-tokens'), components=block('budde-components');
  const names=[...new Set([...tokens.matchAll(/(--[\w-]+)\s*:/g)].map(match=>match[1]))];
  const icon=(name,extra='')=>`<svg class="icon ${extra}" aria-hidden="true"><use href="#i-${name}"/></svg>`;
  const sprite=html.match(/<svg class="sprite"[\s\S]*?<\/svg>/)[0];
  const swatches=['canvas','surface','subtle','text','muted','line','control-line','accent','selected','hover','pressed','warning'];
  const page=`<!doctype html>
<html lang="zh-CN" data-theme="light"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; script-src 'unsafe-inline'; img-src data:; font-src 'none'; connect-src 'none'; base-uri 'none'; form-action 'none'">
<title>Budde · 设计系统与组件样张</title>
<style id="budde-tokens">${tokens}</style>
<style id="budde-components">${components}</style>
<style id="kit-layout">
.kit { width:min(1120px,100%); margin:0 auto; padding:var(--s-6); }
.kit-header,.kit-row,.kit-nav,.theme-controls { display:flex; align-items:center; flex-wrap:wrap; gap:var(--s-2); }
.kit-header { justify-content:space-between; }
.brand { display:flex; align-items:center; gap:var(--s-2); font:var(--weight-strong) var(--font-brand)/var(--line-brand) var(--font-family); }
.brand .icon { width:var(--brand-icon-size); height:var(--brand-icon-size); }
.kit h1,.type-title { margin:0; font:var(--weight-strong) var(--font-title)/var(--line-title) var(--font-family); }
.kit h2 { margin:0 0 var(--s-4); font:var(--weight-strong) var(--font-brand)/var(--line-brand) var(--font-family); }
.kit h3,.type-label { margin:0; font:var(--weight-medium) var(--font-card)/var(--line-label) var(--font-family); }
.kit p { margin:var(--s-2) 0; }
.kit-intro { margin:var(--s-8) 0 var(--s-4); }
.kit-caption,small { font:var(--weight-regular) var(--font-meta)/var(--line-meta) var(--font-family); color:var(--c-muted); }
.kit-nav { padding-bottom:var(--s-6); border-bottom:var(--border-width) solid var(--c-line); }
.kit-nav a { text-decoration:none; }
.kit-section { padding:var(--s-8) 0; border-bottom:var(--border-width) solid var(--c-line); scroll-margin-top:var(--s-6); }
.kit-examples { display:flex; flex-wrap:wrap; gap:var(--s-6); align-items:flex-start; margin:var(--s-4) 0; }
.kit-examples figure { margin:0; display:flex; flex-direction:column; align-items:flex-start; gap:var(--s-2); }
.kit-examples figcaption { font:var(--weight-regular) var(--font-meta)/var(--line-meta) var(--font-family); color:var(--c-muted); }
.kit-grid { display:grid; grid-template-columns:repeat(3,minmax(0,1fr)); gap:var(--s-4); }
.swatch { display:flex; gap:var(--s-3); align-items:center; min-width:0; }
.swatch-color { width:var(--control-height); height:var(--control-height); flex:none; border:var(--border-width) solid var(--c-control-line); border-radius:var(--r-control); }
.swatch-text { display:flex; flex-direction:column; min-width:0; }
.swatch-text code { overflow-wrap:anywhere; }
.kit code { font:inherit; }
.kit table { width:100%; border-collapse:collapse; margin-top:var(--s-4); table-layout:fixed; }
.kit td,.kit th { padding:var(--s-2); border-bottom:var(--border-width) solid var(--c-line); text-align:left; overflow-wrap:anywhere; font:var(--weight-regular) var(--font-meta)/var(--line-meta) var(--font-family); }
.kit th { font-weight:var(--weight-strong); }
.kit-content { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:var(--s-6); }
.kit-surface { padding:var(--s-4); background:var(--c-surface); border:var(--border-width) solid var(--c-line); border-radius:var(--r-card); }
.kit-feedback { display:flex; gap:var(--s-3); align-items:flex-start; padding:var(--s-4); background:var(--c-subtle); border-radius:var(--r-control); }
.kit-feedback > .icon { margin-top:var(--s-1); }
.kit strong { font-weight:var(--weight-strong); }
@media(max-width:719px) { .kit { padding:var(--s-4); } .kit-grid,.kit-content { grid-template-columns:minmax(0,1fr); } }
</style></head><body>${sprite}
<main class="kit">
<header class="kit-header"><div class="brand">${icon('sprout')}Budde <span class="muted">/ 设计系统</span></div><div class="theme-controls" aria-label="主题预览"><button class="button ghost icon-button" data-theme-choice="light" aria-label="浅色主题" aria-pressed="true">${icon('sun')}</button><button class="button ghost icon-button" data-theme-choice="dark" aria-label="深色主题" aria-pressed="false">${icon('moon')}</button></div></header>
<div class="kit-intro"><h1>一套规范，覆盖整页</h1><p>普通控件统一 36px；层级靠文字、表面和留白，不靠一排不同尺寸的按钮。</p><p class="kit-caption">离线静态样张 · 与工作台逐字相同的 token / 组件 CSS · 按钮不执行业务操作</p></div>
<nav class="kit-nav" aria-label="规范章节"><a class="button ghost" href="#controls">控件与状态</a><a class="button ghost" href="#typography">文字与间距</a><a class="button ghost" href="#surfaces">颜色与 token</a><a class="button ghost" href="#content">内容与反馈</a></nav>
<section class="kit-section" id="controls"><h2>01 / 控件与状态</h2><p class="kit-caption">36px 高 · 13 / 20px · 左右 12px · 间距 8px · 圆角 6px · 图标 16px / 1.75 描边</p>
<div class="kit-examples">
<figure><button class="button primary" id="sample-primary">记下来</button><figcaption>主操作 · 最小宽 80px</figcaption></figure>
<figure><button class="button" id="sample-default">${icon('edit')}编辑</button><figcaption>次操作 · 最小宽 64px</figcaption></figure>
<figure><button class="button ghost" id="sample-ghost">${icon('pause')}暂停推进</button><figcaption>轻操作 · 同高同字阶</figcaption></figure>
<figure><button class="button ghost icon-button" aria-label="更多操作">${icon('more')}</button><figcaption>图标操作 · 36 × 36px</figcaption></figure>
<figure><button class="button" style="width:var(--layout-search);justify-content:flex-start" aria-label="搜索事项标题">${icon('search')}搜索事项标题</button><figcaption>搜索入口 · 共用 outline 控件</figcaption></figure>
</div><div class="kit-examples">
<figure><button class="button" id="sample-focus">键盘焦点</button><figcaption>Tab 聚焦 · 2px 焦点环 / 偏移 2px</figcaption></figure>
<figure><button class="button" disabled>不可操作</button><figcaption>disabled · 不以整体透明度降对比</figcaption></figure>
<figure><button class="button" id="sample-loading" disabled aria-busy="true">${icon('clock')}处理中…</button><figcaption>loading · busy + disabled · 不改变高度</figcaption></figure>
<figure><button class="button ghost" aria-pressed="true">${icon('code')}软件<span class="count">5</span></button><figcaption>类型入口 · 计数 + 选中语义</figcaption></figure>
</div><p class="kit-caption">将指针移到普通按钮上查看 hover，按住鼠标查看 pressed；二者只改变表面，不缩放、不位移。支持 reduced-motion。禁用与 busy 不执行操作。</p></section>
<section class="kit-section" id="typography"><h2>02 / 文字与间距</h2><div class="kit-content"><div><p class="type-title">给照片做一个本地整理工具</p><small>标题 20 / 28 · 600</small><p>先验证整理照片的流程，而不是从完整图库开始。</p><small>正文 14 / 24 · 400</small><p class="type-label">阶段路径与当前位置</p><small>标签 / 控件 13 / 20 · 500</small><p class="kit-caption">位置 2 / 4 · 需复查 · 1 条关联笔记</p><small>元信息 12 / 16 · 400 · 计数使用等宽数字</small></div><div><h3>空间、形状、节奏</h3><p>基础间距：4 / 8 / 12 / 16 / 20 / 24 / 32 / 48px。</p><p>控件组 8px，区域与详情内边距 24px，看板列间距 12px。</p><p>圆角：控件 6px / 内容卡片 8px / 标记 4px；边框 1px。</p><p class="kit-caption">字重只用 400 / 500 / 600。窄面板改变布局、允许局部滚动，不缩小按钮。</p></div></div></section>
<section class="kit-section" id="surfaces"><h2>03 / 单色语义与完整 token</h2><p class="kit-caption">分层：基础值 → 语义映射 → 组件 / 布局契约。切换主题后，下面的值实时读取同一组 CSS 变量。</p><div class="kit-grid">${swatches.map(name=>`<div class="swatch"><span class="swatch-color" style="background:var(--c-${name})" aria-hidden="true"></span><span class="swatch-text"><code>--c-${name}</code><small data-value="--c-${name}"></small></span></div>`).join('')}</div><details><summary class="button ghost">全部 token（${names.length} 项）</summary><table><thead><tr><th scope="col">Token</th><th scope="col">当前解析值</th></tr></thead><tbody>${names.map(name=>`<tr><td><code>${name}</code></td><td data-token="${name}"></td></tr>`).join('')}</tbody></table></details></section>
<section class="kit-section" id="content"><h2>04 / 内容按钮与反馈边界</h2><div class="kit-content"><div class="kit-surface"><h3>内容卡片不是 36px 操作按钮</h3><p class="kit-caption">卡片最小 80px / 内边距 12px，关联笔记最小 56px / 双行，自适应长文本。</p><button class="item-card selected"><span class="card-title">给照片做一个本地整理工具</span><span class="review-mark">${icon('clock')}需复查</span><p class="card-note">画出导入后第一次整理的界面</p></button><button class="note-link">${icon('note')}<span class="note-text"><span class="note-name">照片整理工具 · 界面草图</span><span class="note-role">资料 · 关联笔记</span></span>${icon('open','open-icon')}</button></div><div class="kit-surface"><h3>空状态与失败反馈样式示例</h3><p>还没有事项</p><p class="kit-caption">先记下一个标题，之后再决定是否推进。</p><div class="kit-feedback" role="note">${icon('info')}<div><strong>示例：未能保存</strong><p class="kit-caption">更改仍保留在草稿中，请重试。这里只展示反馈样式，没有执行保存。</p></div></div><p class="kit-caption">阶段顺序不表示历史，也不推断完成；状态通过图标、文字和形状表达，而不是颜色。</p></div></div></section>
<footer><p class="kit-caption">此处仅验收设计系统与静态界面；不代表真实思源宿主、保存、同步或异常恢复能力已接入。</p></footer>
</main><script>
(() => {
 const root=document.documentElement;
 const refresh=()=>document.querySelectorAll('[data-token],[data-value]').forEach(node=>node.textContent=getComputedStyle(root).getPropertyValue(node.dataset.token||node.dataset.value).trim());
 const theme=value=>{root.dataset.theme=value;document.querySelectorAll('[data-theme-choice]').forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.themeChoice===value)));refresh();};
 document.querySelectorAll('[data-theme-choice]').forEach(button=>button.addEventListener('click',()=>theme(button.dataset.themeChoice)));
 theme(matchMedia('(prefers-color-scheme:dark)').matches?'dark':'light');
})();
</script></body></html>`;
  return {page,tokens,components};
}
