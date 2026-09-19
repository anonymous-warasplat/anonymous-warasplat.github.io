/* =============================================================================
 * main.js —— 渲染与交互（原生 ES6，无构建工具）
 *
 *   · 页面上所有内容都从 window.SITE（assets/js/data.js）渲染
 *   · Part 1 · Our Method：一屏最多 3 个案例（宽屏 12 个案例 = 4 排）
 *                          每个案例 = 一个 Input ⟷ Ours 视频滑杆（严格 256×256）
 *   · Part 2 · Comparison：四类天气 Tab，每类 3 个场景
 *                          每个场景一次性排布 7 种对比方法 = 7 个画面 + 6 根细滑杆
 *   · 所有视频静音、循环、进入视口自动播放且同屏自动同步；页面上没有任何播放按钮
 * ========================================================================== */
(function () {
  'use strict';

  const SITE = window.SITE || {};
  const OPT1 = (SITE.options && SITE.options.part1) || {};
  const OPT2 = (SITE.options && SITE.options.part2) || {};
  const CATEGORIES = (SITE.part2 && SITE.part2.categories) || [];
  const t = (v, fallback) => (v === undefined || v === null ? fallback : v);

  const state = {
    autoplay: OPT1.autoplay !== false && OPT2.autoplay !== false,
    divider: t(OPT1.divider, 50),
    tab: 0,
  };

  /* ------------------------------------------------------------------ 工具 */
  const $ = (sel, root) => (root || document).querySelector(sel);

  function el(tag, props, ...kids) {
    const node = document.createElement(tag);
    if (props) {
      Object.keys(props).forEach((k) => {
        const v = props[k];
        if (v === null || v === undefined || v === false) return;
        if (k === 'class') node.className = v;
        else if (k === 'text') node.textContent = v;
        else if (k === 'html') node.innerHTML = v;
        else if (k === 'dataset') Object.assign(node.dataset, v);
        else if (k === 'style') {
          Object.keys(v).forEach((p) => (p.indexOf('--') === 0 ? node.style.setProperty(p, v[p]) : (node.style[p] = v[p])));
        } else if (k.indexOf('on') === 0 && typeof v === 'function') node.addEventListener(k.slice(2).toLowerCase(), v);
        else node.setAttribute(k, v === true ? '' : String(v));
      });
    }
    kids.flat().forEach((kid) => {
      if (kid === null || kid === undefined || kid === false) return;
      node.append(kid.nodeType ? kid : document.createTextNode(String(kid)));
    });
    return node;
  }

  const lightbox = () => $('#lightbox');

  /* ------------------------------------------------------- 1. 标题 / 导航 */
  function renderMeta() {
    const m = SITE.meta || {};
    const title = m.title || 'WaraSplat';
    const h1 = $('#siteTitle');
    if (h1) h1.textContent = title;
    const p0Name = $('#part0Name');
    if (p0Name) p0Name.textContent = (SITE.part0 && SITE.part0.title) || '';
    const p1Title = $('#part1Title');
    if (p1Title) p1Title.innerHTML = '<span class="pin">Part 1</span> ' + ((SITE.part1 && SITE.part1.title) || 'Our Method');
    const p2Title = $('#part2Title');
    if (p2Title) p2Title.innerHTML = '<span class="pin">Part 2</span> ' + ((SITE.part2 && SITE.part2.title) || 'Comparison');
    document.title = title;
  }

  /* --------------------------------------------------------- 2. 公共组件 */
  /** 图片滑杆（img-comparison-slider；只有把 data.js 的 EXT 换成 .png/.jpg 时才会用到） */
  function buildImageSlider(first, second, opts) {
    const o = opts || {};
    const wrap = el('div', { class: 'img-slider', style: { '--img-native': (first.native || 256) + 'px' } });
    const slider = el('img-comparison-slider', {
      class: 'img-slider__el',
      value: o.value === undefined ? state.divider : o.value,
      style: { '--aspect-ratio': String(o.aspect || 1) },
    });
    const imgA = el('img', { slot: 'first', src: first.src, alt: first.label, loading: 'lazy', decoding: 'async' });
    const imgB = el('img', { slot: 'second', src: second.src, alt: second.label, loading: 'lazy', decoding: 'async' });
    slider.append(imgA, imgB);
    imgA.addEventListener('load', () => {
      if (imgA.naturalWidth) wrap.style.setProperty('--img-native', imgA.naturalWidth + 'px');
    });
    const missing = (src) => {
      wrap.append(el('div', { class: 'media-missing media-missing--overlay' }, el('b', { text: '缺少资源' }), el('code', { text: src })));
    };
    imgA.addEventListener('error', () => missing(first.src));
    imgB.addEventListener('error', () => missing(second.src));
    return wrap;
  }

  /** 视频滑杆对比（<video-compare>）：无控件的 Input ⟷ Ours */
  function buildVideoCompare(first, second, opts) {
    const o = opts || {};
    return el('video-compare', {
      'src-first': first.src,
      'src-second': second.src,
      'poster-first': first.poster || null,
      'poster-second': second.poster || null,
      'label-first': o.labelFirst === undefined ? first.label : o.labelFirst,
      'label-second': o.labelSecond === undefined ? second.label : o.labelSecond,
      'native-width': first.native || 256,
      aspect: o.aspect || 1,
      scale: t(OPT1.scale, 1),
      value: o.value === undefined ? state.divider : o.value,
      start: 0,
      loop: true,
      autoplay: state.autoplay ? true : null,
    });
  }

  /* ------------------------------------------------------- 3. Part 0 · 场景 */
  /** 一行展示四类天气的场景视频（每段都是原始 256×256，只缩不放） */
  function renderPart0() {
    const list = $('#part0List');
    if (!list) return;
    const items = (SITE.part0 && SITE.part0.items) || [];
    list.innerHTML = '';
    if (!items.length) {
      list.append(el('p', { class: 'empty-hint', text: '暂无 Part 0 内容：请在 assets/js/data.js 的 part0.items 中配置场景。' }));
      return;
    }
    items.forEach((item) => {
      list.append(
        el('article', { class: 'weather-card', id: 'p0-' + item.id },
          el('p', { class: 'weather-card__title', text: item.label }),
          el('div', { class: 'weather-card__viewer' },
            el('auto-video', {
              src: item.media.src,
              poster: item.media.poster || null,
              'native-width': item.media.native || 256,
              aspect: 1,
              start: 0,
              loop: true,
              autoplay: state.autoplay ? true : null,
            })
          )
        )
      );
    });
  }

  /* --------------------------------------------- 4. Part 1 · Our Method */
  function renderPart1() {
    const list = $('#part1List');
    if (!list) return;
    const items = (SITE.part1 && SITE.part1.items) || [];
    list.className = 'compare-rows';
    list.innerHTML = '';
    if (!items.length) {
      list.append(el('p', { class: 'empty-hint', text: '暂无 Part 1 内容：请在 assets/js/data.js 的 part1.items 中配置案例。' }));
      return;
    }
    // 按天气分组：同一类天气的场景横向排成一行（Rain 5 个就一行 5 个）
    const groups = [];
    items.forEach((item) => {
      let g = groups.find((x) => x.name === item.group);
      if (!g) {
        g = { name: item.group, items: [] };
        groups.push(g);
      }
      g.items.push(item);
    });
    groups.forEach((g) => {
      const row = el('div', { class: 'compare-row', style: { '--cols': String(g.items.length) } });
      g.items.forEach((item) => {
        const isVideo = item.first.type === 'video' && item.second.type === 'video';
        const viewer = isVideo ? buildVideoCompare(item.first, item.second) : buildImageSlider(item.first, item.second);
        row.append(
          el('article', { class: 'compare-card', id: 'p1-' + item.id },
            OPT1.showTitles === false ? null : el('p', { class: 'compare-card__title', text: item.title }),
            el('div', { class: 'compare-card__viewer' }, viewer)
          )
        );
      });
      list.append(row);
    });
  }

  /* ---------------------------------------------- 4. Part 2 · Comparison */
  function renderPart2Tabs() {
    const box = $('#part2Tabs');
    box.innerHTML = '';
    CATEGORIES.forEach((cat, i) => {
      box.append(
        el('button', {
          type: 'button',
          class: 'tab',
          id: 'tab-' + cat.id,
          role: 'tab',
          text: cat.label,
          dataset: { index: i },
          'aria-selected': String(i === state.tab),
          'aria-controls': 'part2-' + cat.id,
          onclick: () => activateTab(i),
        })
      );
    });
  }

  const mediaByKey = (c, key) => (c.media || []).find((m) => m.key === key);

  /**
   * 一个场景分三排：每排 = 2 种对比方法 + Ours + GT（同一舞台内用滑杆区分，GT 在最右）
   * 分组写在 data.js 的 options.part2.rows，每排末尾固定接 options.part2.tail
   */
  function caseRows(c) {
    const tail = t(OPT2.tail, ['Ours', 'GT'])
      .map((key) => mediaByKey(c, key))
      .filter(Boolean);
    const groups = OPT2.rows;
    let rows;
    if (groups && groups.length) {
      rows = groups.map((group) => group.map((key) => mediaByKey(c, key)).filter(Boolean));
    } else {
      // 没配 rows 就自动按每排 2 个分组
      const methods = (c.media || []).filter((m) => m.role === 'method');
      rows = [];
      for (let i = 0; i < methods.length; i += 2) rows.push(methods.slice(i, i + 2));
    }
    return rows.map((row) => row.concat(tail)).filter((row) => row.length);
  }

  function buildCaseCard(c) {
    const card = el('article', { class: 'case-card', id: 'case-' + c.id },
      el('p', { class: 'case-card__title', text: c.title })
    );
    caseRows(c).forEach((items) => {
      const viewer = el('multi-compare', {
        'native-width': (SITE.config && SITE.config.NATIVE_WIDTH) || 256,
        aspect: 1,
        scale: 1,
        'min-gap': t(OPT2.minGap, 2),
        start: 0,
        loop: OPT2.loop !== false ? true : null,
        autoplay: state.autoplay ? true : null,
      });
      viewer.setItems(
        items.map((m) => ({ src: m.src, label: m.label, type: m.type, poster: m.poster, role: m.role }))
      );
      viewer.addEventListener('mc-open', (e) => {
        lightbox().open(
          items.map((m) => ({ src: m.src, type: m.type, label: c.title + ' · ' + m.label, native: m.native })),
          e.detail.index
        );
      });
      card.append(el('div', { class: 'case-card__row' }, viewer));
    });
    return card;
  }

  function renderPanel(index) {
    const cat = CATEGORIES[index];
    if (!cat) return;
    const panel = document.getElementById('part2-' + cat.id);
    if (!panel || panel.dataset.rendered === '1') return;
    panel.dataset.rendered = '1';
    panel.innerHTML = '';
    const cases = cat.cases || [];
    // 一行放几个场景 = 这类天气有几个场景（Rain 5 个就 5 列，屏幕窄了自动折行）
    panel.style.setProperty('--cols', String(Math.max(1, cases.length)));
    cases.forEach((c) => panel.append(buildCaseCard(c)));
    if (!(cat.cases || []).length) {
      panel.append(el('p', { class: 'empty-hint', text: '该类别下暂无案例。' }));
    }
  }

  function activateTab(index) {
    if (!CATEGORIES.length) return;
    state.tab = (index + CATEGORIES.length) % CATEGORIES.length;
    document.querySelectorAll('#part2Tabs .tab').forEach((b) => {
      const on = Number(b.dataset.index) === state.tab;
      b.setAttribute('aria-selected', String(on));
      b.tabIndex = on ? 0 : -1;
    });
    document.querySelectorAll('.tab-panel').forEach((p, i) => {
      p.hidden = i !== state.tab;
    });
    renderPanel(state.tab);
  }

  /* ------------------------------------------------------- 5. 资源自检 */
  /** 控制台里执行 checkAssets() 即可列出所有媒体路径的正常 / 缺失情况 */
  function collectAssets() {
    const list = [];
    const push = (item, where) => list.push({ src: item.src, type: item.type, where: where });
    ((SITE.part1 && SITE.part1.items) || []).forEach((it) => {
      push(it.first, 'Part 1 · ' + it.title + ' · ' + it.first.label);
      push(it.second, 'Part 1 · ' + it.title + ' · ' + it.second.label);
    });
    CATEGORIES.forEach((cat) => (cat.cases || []).forEach((c) => (c.media || []).forEach((m) => push(m, 'Part 2 · ' + cat.label + ' · ' + c.title + ' · ' + m.label))));
    return list;
  }

  function probe(asset) {
    return new Promise((resolve) => {
      if (!asset.src || !String(asset.src).trim()) return resolve('missing');
      let done = false;
      const timer = setTimeout(() => finish('timeout'), 10000);
      function finish(result) {
        if (done) return;
        done = true;
        clearTimeout(timer);
        resolve(result);
      }
      if (asset.type === 'video') {
        const v = document.createElement('video');
        v.preload = 'metadata';
        v.muted = true;
        v.addEventListener('loadedmetadata', () => finish('ok'), { once: true });
        v.addEventListener('error', () => finish('missing'), { once: true });
        v.src = asset.src;
      } else {
        const img = new Image();
        img.addEventListener('load', () => finish('ok'), { once: true });
        img.addEventListener('error', () => finish('missing'), { once: true });
        img.src = asset.src;
      }
    });
  }

  async function runAssetCheck() {
    const assets = collectAssets();
    const panel = el('aside', { class: 'asset-report' });
    const close = () => panel.remove();
    const head = el('div', { class: 'report-head' },
      el('b', { text: '资源自检' }),
      el('button', { type: 'button', class: 'btn', text: '关闭', onclick: close })
    );
    const sum = el('p', { class: 'report-sum', text: '检查中… 0 / ' + assets.length });
    const listBox = el('ul', { class: 'report-list' });
    panel.append(head, sum, listBox);
    document.body.append(panel);

    const missing = [];
    const unknown = [];
    let done = 0;
    const queue = assets.slice();
    const addRow = (asset, kind) => {
      const suffix = kind === 'unknown' ? '（未确认：可能只是加载慢）' : '';
      listBox.append(
        el('li', { class: 'report-item report-item--' + kind },
          el('span', { class: 'report-where', text: asset.where + suffix }),
          el('code', { text: asset.src })
        )
      );
    };
    const worker = async () => {
      while (queue.length) {
        const a = queue.shift();
        // eslint-disable-next-line no-await-in-loop
        const result = await probe(a);
        done += 1;
        if (result === 'missing') {
          missing.push(a);
          addRow(a, 'missing');
        } else if (result === 'timeout') {
          unknown.push(a);
          addRow(a, 'unknown');
        }
        sum.textContent =
          '检查中… ' + done + ' / ' + assets.length + '（缺失 ' + missing.length + '，未确认 ' + unknown.length + '）';
      }
    };
    await Promise.all([worker(), worker(), worker(), worker()]);
    sum.textContent =
      '共 ' + assets.length + ' 项：正常 ' + (assets.length - missing.length - unknown.length) +
      '，缺失 ' + missing.length + '，未确认 ' + unknown.length;
    sum.classList.toggle('report-sum--warn', missing.length > 0);
    if (!missing.length && !unknown.length) listBox.append(el('li', { class: 'report-item', text: '全部资源均可访问 ✅' }));
  }

  /* ----------------------------------------------------------- 6. 启动 */
  /** 支持深链接：index.html#part2-fog 直接落到对应天气 */
  function handleInitialHash() {
    const hash = decodeURIComponent(location.hash.replace('#', ''));
    if (!hash) return;
    const target = document.getElementById(hash);
    if (!target) return;
    const catIndex = CATEGORIES.findIndex((c) => 'part2-' + c.id === hash);
    if (catIndex >= 0) activateTab(catIndex);
    const jump = () => target.scrollIntoView({ block: 'start', behavior: 'auto' });
    requestAnimationFrame(jump);
    setTimeout(jump, 300);
  }

  function boot() {
    if (window.VideoCompare) window.VideoCompare.autoplayGlobal = state.autoplay;
    renderMeta();
    renderPart0();
    renderPart1();
    renderPart2Tabs();
    CATEGORIES.forEach((cat) => {
      const panel = el('section', {
        class: 'tab-panel',
        id: 'part2-' + cat.id,
        role: 'tabpanel',
        'aria-labelledby': 'tab-' + cat.id,
      });
      panel.hidden = true;
      $('#part2Panels').append(panel);
    });
    activateTab(0);
    handleInitialHash();
    // Tab 键盘操作：← → 切换，Home / End 到首尾
    $('#part2Tabs').addEventListener('keydown', (e) => {
      const step = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0;
      if (step) activateTab(state.tab + step);
      else if (e.key === 'Home') activateTab(0);
      else if (e.key === 'End') activateTab(CATEGORIES.length - 1);
      else return;
      e.preventDefault();
      const btn = document.querySelector('#part2Tabs .tab[aria-selected="true"]');
      if (btn) btn.focus();
    });
  }

  // 控制台调试用：checkAssets() 列出所有媒体路径的检查结果
  window.checkAssets = runAssetCheck;

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
