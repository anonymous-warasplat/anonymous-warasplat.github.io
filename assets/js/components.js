/* =============================================================================
 * components.js —— 原生 Web Component（零依赖，ES6 原生写法）
 *
 *   1. <img-comparison-slider>  图片滑杆：优先用 assets/vendor 里的官方组件，
 *                               官方文件缺失时自动启用内置兜底实现（API 兼容）
 *   2. <video-compare>          双路视频滑杆对比（Input ⟷ Ours），无任何播放控件
 *   3. <multi-compare>          多路视频滑杆对比（N 路视频 + N-1 根细滑杆）
 *   4. <auto-video>             单路自动播放视频（Part 0 的天气场景），无任何控件
 *   5. <media-lightbox>         点击放大查看（图片 / 视频）
 * ========================================================================== */
(function () {
  'use strict';

  const VIDEO_RE = /\.(mp4|webm|mov|m4v)(\?|#|$)/i;
  const isVideoSrc = (src) => VIDEO_RE.test(String(src || ''));
  const fmtTime = (t) => {
    if (!isFinite(t) || t < 0) t = 0;
    const m = Math.floor(t / 60);
    const s = Math.floor(t % 60);
    return m + ':' + String(s).padStart(2, '0');
  };
  const clamp = (v, min, max) => Math.min(max, Math.max(min, v));

  /**
   * 把一路视频拉回基准时间：小幅偏差只用播放速率微调（不打断解码，画面更顺），
   * 只有偏差很大（比如对端刚循环回到起点）才做一次跳转。
   */
  function syncVideo(v, masterTime, duration) {
    const diff = v.currentTime - masterTime;
    const ad = Math.abs(diff);
    if (ad > 0.25 || (duration && ad > duration * 0.5)) {
      try { v.currentTime = masterTime; } catch (err) { /* 忽略 */ }
      if (v.playbackRate !== 1) v.playbackRate = 1;
      return;
    }
    if (ad > 0.04) {
      const rate = 1 - clamp(diff * 0.5, -0.12, 0.12);
      if (v.playbackRate !== rate) {
        try { v.playbackRate = rate; } catch (err) { /* 忽略 */ }
      }
    } else if (v.playbackRate !== 1) {
      v.playbackRate = 1;
    }
  }

  /* ==========================================================================
   * 1) 图片滑杆兜底实现
   *    仅当 assets/vendor/img-comparison-slider.js 没有注册该元素时才生效；
   *    API 与官方组件保持一致：属性 value / direction，插槽 first / second / handle
   * ======================================================================= */
  if (!customElements.get('img-comparison-slider')) {
    const IMG_CSS = `
      :host{display:block;position:relative;overflow:hidden;width:100%;cursor:ew-resize;touch-action:none;
        --divider-width:2px;--divider-color:#fff;--divider-shadow:0 0 0 1px rgba(0,0,0,.16);
        --default-handle-width:40px;--default-handle-color:#fff;}
      .stage{position:relative;width:100%;aspect-ratio:var(--aspect-ratio,1);background:#0b0d10;overflow:hidden}
      .layer{position:absolute;inset:0}
      ::slotted(img){display:block;width:100%;height:100%;object-fit:cover}
      .first{clip-path:inset(0 calc(100% - var(--exposure,50%)) 0 0)}
      .divider{position:absolute;top:0;bottom:0;left:var(--exposure,50%);width:var(--divider-width);
        background:var(--divider-color);box-shadow:var(--divider-shadow);transform:translateX(-50%)}
      .divider:focus-visible{outline:2px solid #2563eb;outline-offset:2px}
      .handle{position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);
        width:var(--default-handle-width);height:var(--default-handle-width);border-radius:50%;
        background:var(--default-handle-color);color:#10151c;display:grid;place-items:center;
        box-shadow:0 2px 10px rgba(0,0,0,.35);font:700 11px/1 system-ui,sans-serif;pointer-events:none}
    `;
    class ImgComparisonSliderFallback extends HTMLElement {
      static get observedAttributes() {
        return ['value', 'direction'];
      }
      constructor() {
        super();
        this._value = 50;
        const root = this.attachShadow({ mode: 'open' });
        root.innerHTML =
          '<style>' + IMG_CSS + '</style>' +
          '<div class="stage">' +
          '  <div class="layer second"><slot name="second"></slot></div>' +
          '  <div class="layer first"><slot name="first"></slot></div>' +
          '  <div class="divider" tabindex="0" role="slider" aria-label="拖动对比" aria-valuemin="0" aria-valuemax="100">' +
          '    <slot name="handle"><span class="handle">◀ ▶</span></slot>' +
          '  </div>' +
          '</div>';
        this._root = root;
        this._divider = root.querySelector('.divider');
      }
      connectedCallback() {
        if (this._bound) return;
        this._bound = true;
        const onMove = (e) => this._dragTo(e.clientX);
        this._onPointerMove = onMove;
        this._divider.addEventListener('pointerdown', (e) => {
          this._dragTo(e.clientX);
          const move = (ev) => onMove(ev);
          const up = () => {
            window.removeEventListener('pointermove', move);
            window.removeEventListener('pointerup', up);
          };
          window.addEventListener('pointermove', move);
          window.addEventListener('pointerup', up);
          e.preventDefault();
        });
        this._divider.addEventListener('keydown', (e) => {
          const step = e.shiftKey ? 10 : 1;
          if (e.key === 'ArrowLeft') this.value = this._value - step;
          else if (e.key === 'ArrowRight') this.value = this._value + step;
          else return;
          e.preventDefault();
        });
        this._apply();
      }
      attributeChangedCallback(name, _old, val) {
        if (name === 'value') this._value = clamp(parseFloat(val) || 0, 0, 100);
        this._apply();
      }
      get value() {
        return this._value;
      }
      set value(v) {
        this._value = clamp(parseFloat(v) || 0, 0, 100);
        this._apply();
      }
      _dragTo(clientX) {
        const rect = this.getBoundingClientRect();
        if (!rect.width) return;
        this.value = clamp(((clientX - rect.left) / rect.width) * 100, 0, 100);
      }
      _apply() {
        if (!this._root) return;
        const pct = this._value + '%';
        this._root.host.style.setProperty('--exposure', pct);
        if (this._divider) this._divider.setAttribute('aria-valuenow', String(Math.round(this._value)));
      }
    }
    customElements.define('img-comparison-slider', ImgComparisonSliderFallback);
  }

  /* ==========================================================================
   * 2) <video-compare> 视频滑杆对比 + 播放同步
   *
   *    属性：
   *      src-first / src-second      左（Input）与右（Ours）的视频地址
   *      label-first / label-second  角标文字，设为空字符串则不显示
   *      poster-first / poster-second 封面图
   *      native-width                原始像素宽（默认 256，页面绝不放大超过它）
   *      scale                       显示比例（1 / 2，整数倍）
   *      value                       滑杆初始位置（0-100）
   *      start                       起始播放时间（秒）
   *      loop                        循环播放
   *      autoplay                    允许"进入视口自动播放"（仍受全局开关控制）
   *      aspect                      画面宽高比，默认 1（正方形 256×256）
   *
   *    方法：play() / pause() / restart() / seek(sec)
   *    静态：VideoCompare.autoplayGlobal —— 全局自动播放开关
   * ======================================================================= */
  const VC_CSS = `
    :host{display:block;width:100%}
    .frame{width:calc(var(--vc-native,256px) * var(--vc-scale,1));max-width:100%;margin:0 auto}
    .stage{position:relative;width:100%;aspect-ratio:var(--vc-aspect,1);background:#0b0d10;
      border-radius:8px;overflow:hidden}
    video{position:absolute;inset:0;width:100%;height:100%;object-fit:contain;display:block;background:#0b0d10;
      image-rendering:var(--media-rendering,auto)}
    video[data-missing]{display:none}
    video.first{clip-path:inset(0 calc(100% - var(--vc-pos,50%)) 0 0)}
    .tag{position:absolute;top:5px;z-index:3;padding:1px 7px;border-radius:999px;
      font:600 10.5px/1.7 var(--vc-font,system-ui,sans-serif);letter-spacing:.01em;
      background:rgba(12,15,20,.55);color:#fff;pointer-events:none}
    .tag[hidden]{display:none}
    .tag-first{left:5px}
    .tag-second{right:5px}
    .divider{position:absolute;top:0;bottom:0;z-index:4;left:var(--vc-pos,50%);width:11px;margin-left:-5.5px;
      cursor:ew-resize;touch-action:none;background:transparent;display:grid;place-items:center}
    .divider::before{content:'';position:absolute;top:0;bottom:0;left:50%;width:1.5px;margin-left:-.75px;
      background:rgba(255,255,255,.92);box-shadow:0 0 0 .5px rgba(0,0,0,.22)}
    .divider:focus-visible{outline:none}
    .divider:focus-visible::before{background:#2563eb}
    .knob{position:relative;width:14px;height:14px;border-radius:50%;background:rgba(255,255,255,.94);
      color:#10151c;display:grid;place-items:center;box-shadow:0 1px 4px rgba(0,0,0,.35);
      font:700 9px/1 var(--vc-font,system-ui,sans-serif);letter-spacing:-.06em;padding-right:1px}
    .missing{position:absolute;inset:0;z-index:5;display:none;place-content:center;gap:8px;
      padding:14px;text-align:center;color:#fff;
      background:repeating-linear-gradient(45deg,#171b21,#171b21 10px,#1e232b 10px,#1e232b 20px)}
    .missing[data-visible]{display:grid}
    .missing[data-partial]{inset:auto 0 0 0;place-content:center;padding:8px 10px;background:rgba(12,15,20,.74)}
    .missing b{font:700 12px/1.5 var(--vc-font,system-ui,sans-serif);color:#ffd48a}
    .missing code{font:500 11px/1.5 var(--vc-mono,ui-monospace,monospace);word-break:break-all;
      white-space:pre-wrap;color:#c9d1dc}
  `;

  class VideoCompare extends HTMLElement {
    static get observedAttributes() {
      return ['src-first', 'src-second', 'label-first', 'label-second', 'poster-first', 'poster-second',
        'native-width', 'scale', 'value', 'start', 'loop', 'autoplay', 'aspect'];
    }
    static autoplayGlobal = true;

    constructor() {
      super();
      this._value = 50;
      this._scale = 1;
      this._playing = false;
      this._lock = false; // 拖动滑杆时暂停自动纠偏
      const root = this.attachShadow({ mode: 'open' });
      root.innerHTML =
        '<style>' + VC_CSS + '</style>' +
        '<div class="frame">' +
        '  <div class="stage">' +
        '    <video class="second" muted playsinline preload="metadata" disablepictureinpicture></video>' +
        '    <video class="first" muted playsinline preload="metadata" disablepictureinpicture></video>' +
        '    <span class="tag tag-first"></span>' +
        '    <span class="tag tag-second"></span>' +
        '    <div class="missing"><b>缺少资源</b><code></code></div>' +
        '    <div class="divider" tabindex="0" role="slider" aria-label="拖动对比" aria-valuemin="0" aria-valuemax="100" aria-valuenow="50">' +
        '      <span class="knob">‹›</span>' +
        '    </div>' +
        '  </div>' +
        '</div>';
      this._root = root;
      this._frame = root.querySelector('.frame');
      this._stage = root.querySelector('.stage');
      this._vFirst = root.querySelector('video.first');
      this._vSecond = root.querySelector('video.second');
      this._tagFirst = root.querySelector('.tag-first');
      this._tagSecond = root.querySelector('.tag-second');
      this._divider = root.querySelector('.divider');
      this._missing = root.querySelector('.missing');
      this._missingCode = root.querySelector('.missing code');
      this._missingSrcs = [];
    }

    /* ---------- 生命周期 ---------- */
    connectedCallback() {
      if (!this._bound) {
        this._bound = true;
        this._bind();
      }
      this._sync();
      this._observe();
    }
    disconnectedCallback() {
      this._stopLoop();
      if (this._io) this._io.disconnect();
    }
    attributeChangedCallback() {
      if (this._bound) this._sync();
    }

    /* ---------- 公开 API ---------- */
    get value() {
      return this._value;
    }
    set value(v) {
      this._value = clamp(parseFloat(v) || 0, 0, 100);
      this._applyPosition();
    }
    get scale() {
      return this._scale;
    }
    set scale(v) {
      const n = parseFloat(v);
      this._scale = isFinite(n) && n > 0 ? n : 1;
      this._frame.style.setProperty('--vc-scale', String(this._scale));
    }
    get playing() {
      return this._playing;
    }
    play() {
      if (this._allMissing()) return;
      this._lock = true;
      this._vFirst.playbackRate = 1;
      this._vSecond.playbackRate = 1;
      const p1 = this._vFirst.play();
      const p2 = this._vSecond.play();
      [p1, p2].forEach((p) => p && typeof p.catch === 'function' && p.catch(() => {}));
      this._lock = false;
      this._playing = true;
      this._startLoop();
    }
    pause() {
      this._playing = false;
      this._vFirst.pause();
      this._vSecond.pause();
      this._vFirst.playbackRate = 1;
      this._vSecond.playbackRate = 1;
      this._stopLoop();
    }
    restart() {
      const t = this._startTime();
      this._lock = true;
      this._vFirst.currentTime = t;
      this._vSecond.currentTime = t;
      this._lock = false;
    }
    seek(sec) {
      const d = this._duration();
      const t = clamp(sec, 0, d || sec);
      this._lock = true;
      this._vFirst.currentTime = t;
      this._vSecond.currentTime = t;
      this._lock = false;
    }

    /* ---------- 内部 ---------- */
    _startTime() {
      const s = parseFloat(this.getAttribute('start'));
      return isFinite(s) && s > 0 ? s : 0;
    }
    _duration() {
      const d = this._vSecond.duration;
      if (isFinite(d) && d > 0) return d;
      const d1 = this._vFirst.duration;
      return isFinite(d1) && d1 > 0 ? d1 : 0;
    }
    _allMissing() {
      return this._vFirst.hasAttribute('data-missing') && this._vSecond.hasAttribute('data-missing');
    }

    _bind() {
      // 滑杆拖动
      this._divider.addEventListener('pointerdown', (e) => {
        this._dragTo(e.clientX);
        const move = (ev) => this._dragTo(ev.clientX);
        const up = () => {
          window.removeEventListener('pointermove', move);
          window.removeEventListener('pointerup', up);
        };
        window.addEventListener('pointermove', move);
        window.addEventListener('pointerup', up);
        e.preventDefault();
      });
      this._divider.addEventListener('keydown', (e) => {
        const step = e.shiftKey ? 10 : 2;
        if (e.key === 'ArrowLeft') this.value = this._value - step;
        else if (e.key === 'ArrowRight') this.value = this._value + step;
        else if (e.key === 'Home') this.value = 0;
        else if (e.key === 'End') this.value = 100;
        else return;
        e.preventDefault();
      });

      // 双路同步
      const onPlay = (src, dst) => () => {
        if (this._lock) return;
        this._playing = true;
        if (dst.paused) {
          const p = dst.play();
          if (p && p.catch) p.catch(() => {});
        }
        this._startLoop();
      };
      this._vFirst.addEventListener('play', onPlay(this._vFirst, this._vSecond));
      this._vSecond.addEventListener('play', onPlay(this._vSecond, this._vFirst));
      const onPause = () => {
        if (this._lock) return;
        if (!this._vFirst.paused) this._vFirst.pause();
        if (!this._vSecond.paused) this._vSecond.pause();
        this._playing = false;
        this._stopLoop();
      };
      this._vFirst.addEventListener('pause', onPause);
      this._vSecond.addEventListener('pause', onPause);
      const onSeeked = (src, dst) => () => {
        if (this._lock) return;
        if (Math.abs(dst.currentTime - src.currentTime) > 0.05) dst.currentTime = src.currentTime;
      };
      this._vFirst.addEventListener('seeked', onSeeked(this._vFirst, this._vSecond));
      this._vSecond.addEventListener('seeked', onSeeked(this._vSecond, this._vFirst));

      // 首帧就绪后设置起始时间
      const onMeta = () => this.restart();
      this._vSecond.addEventListener('loadedmetadata', onMeta);
      this._vFirst.addEventListener('loadedmetadata', onMeta);
      this._vSecond.addEventListener('ended', () => {
        this.pause();
        this.restart();
      });

      // 资源缺失兜底
      this._vFirst.addEventListener('error', () => this._markMissing('first'));
      this._vSecond.addEventListener('error', () => this._markMissing('second'));
    }

    _dragTo(clientX) {
      const rect = this._stage.getBoundingClientRect();
      if (!rect.width) return;
      this.value = clamp(((clientX - rect.left) / rect.width) * 100, 0, 100);
    }

    _applyPosition() {
      const pct = this._value + '%';
      this._stage.style.setProperty('--vc-pos', pct);
      this._divider.setAttribute('aria-valuenow', String(Math.round(this._value)));
    }

    _sync() {
      // 尺寸与比例
      const native = parseFloat(this.getAttribute('native-width'));
      this._frame.style.setProperty('--vc-native', (isFinite(native) && native > 0 ? native : 256) + 'px');
      const aspect = parseFloat(this.getAttribute('aspect'));
      this._stage.style.setProperty('--vc-aspect', String(isFinite(aspect) && aspect > 0 ? aspect : 1));
      const s = parseFloat(this.getAttribute('scale'));
      if (isFinite(s) && s > 0 && s !== this._scale) this.scale = s;

      // 角标
      const lf = this.getAttribute('label-first');
      const ls = this.getAttribute('label-second');
      if (lf === null) this._tagFirst.hidden = true;
      else {
        this._tagFirst.hidden = lf === '';
        this._tagFirst.textContent = lf || 'Input';
      }
      if (ls === null) this._tagSecond.hidden = true;
      else {
        this._tagSecond.hidden = ls === '';
        this._tagSecond.textContent = ls || 'Ours';
      }

      // 循环
      const loop = this.hasAttribute('loop');
      this._vFirst.loop = loop;
      this._vSecond.loop = loop;

      // 滑杆位置
      const v = this.getAttribute('value');
      if (v !== null && this._explicitValue !== v) {
        this._explicitValue = v;
        this.value = parseFloat(v) || 0;
      }

      // 视频源
      this._setSrc(this._vFirst, this.getAttribute('src-first'), this.getAttribute('poster-first'), 'first');
      this._setSrc(this._vSecond, this.getAttribute('src-second'), this.getAttribute('poster-second'), 'second');
    }

    _setSrc(video, src, poster, which) {
      if (poster) video.poster = poster;
      if (!src) {
        this._markMissing(which, '（data.js 中该字段为空）');
        return;
      }
      // 加 #t=0.1：即使还没开始播放，也能显示一帧画面（避免一片黑）
      const full = src.indexOf('#') === -1 ? src + '#t=0.1' : src;
      if (video.dataset.src === full) return;
      video.dataset.src = full;
      video.removeAttribute('data-missing');
      video.src = full;
      this._missingSrcs = this._missingSrcs.filter((s) => s !== src);
      this._refreshMissing();
    }

    _markMissing(which, reason) {
      const video = which === 'first' ? this._vFirst : this._vSecond;
      const src = reason || video.dataset.src || '';
      video.setAttribute('data-missing', '1');
      if (!this._missingSrcs.includes(src)) this._missingSrcs.push(src);
      this._refreshMissing();
    }

    /** 只要还有缺失项就显示占位说明，两个都缺失时禁用控制条 */
    _refreshMissing() {
      const list = this._missingSrcs.filter(Boolean);
      this._missingCode.textContent = list.join('\n');
      const dead = this._allMissing();
      if (list.length) {
        this._missing.setAttribute('data-visible', '');
        if (dead) this._missing.removeAttribute('data-partial');
        else this._missing.setAttribute('data-partial', '');
      } else {
        this._missing.removeAttribute('data-visible');
        this._missing.removeAttribute('data-partial');
      }
      if (dead) this._stopLoop();
    }

    _observe() {
      if (this._io || !('IntersectionObserver' in window)) return;
      this._io = new IntersectionObserver(
        (entries) => {
          entries.forEach((entry) => {
            if (entry.isIntersecting && entry.intersectionRatio >= 0.3) {
              if (VideoCompare.autoplayGlobal && this.hasAttribute('autoplay')) this.play();
            } else if (this._playing) {
              this.pause();
            }
          });
        },
        { threshold: [0, 0.3] }
      );
      this._io.observe(this);
    }

    _startLoop() {
      if (this._raf) return;
      const tick = () => {
        this._raf = requestAnimationFrame(tick);
        this._correct();
      };
      this._raf = requestAnimationFrame(tick);
    }
    _stopLoop() {
      if (this._raf) cancelAnimationFrame(this._raf);
      this._raf = null;
    }
    _correct() {
      if (this._lock || this._allMissing()) return;
      const a = this._vFirst;
      const b = this._vSecond;
      if (a.paused || b.paused) return;
      syncVideo(b, a.currentTime, this._duration() || 0);
    }
  }
  customElements.define('video-compare', VideoCompare);
  // 暴露类本身，供 main.js 设置全局自动播放开关（VideoCompare.autoplayGlobal）
  window.VideoCompare = VideoCompare;

  /* ==========================================================================
   * 3) <multi-compare> 多路视频滑杆对比（Part 2 用）
   *
   *    一次性把 N 路视频排进同一个舞台：N 个画面重叠，N-1 根可拖动的细线滑杆，
   *    每根滑杆调整左右两块画面的宽度；方法名横向标在每块画面的左上角（画面内），
   *    跟着各画面的宽度一起移动，画面变窄时自动缩字号、再窄就省略号。
   *
   *    属性：
   *      native-width  原始像素宽（默认 256，页面绝不放大超过它）
   *      scale         显示比例（默认 1）
   *      aspect        画面宽高比（默认 1，正方形 256×256）
   *      value         初始边界，逗号分隔的 N+1 个数（如 0,14.3,28.6,...,100）
   *      min-gap       相邻两块画面之间允许的最小宽度（百分比，默认 2）
   *      start / loop / autoplay  起始时间 / 循环 / 进入视口自动播放
   *
   *    API：setItems([{src,label,type,poster}])、play()、pause()、restart()、seek(sec)
   *    事件：mc-open —— 点击某一块画面时抛出 { detail:{ index } }，由页面决定是否放大
   * ======================================================================= */
  const MC_CSS = `
   :host{display:block;width:100%}
   .frame{width:calc(var(--mc-native,256px) * var(--mc-scale,1));max-width:100%;margin:0 auto}
    .stage{position:relative;width:100%;aspect-ratio:var(--mc-aspect,1);overflow:hidden;border-radius:8px;
      background-color:#0b0d10;touch-action:pan-y}
    .lab{position:absolute;top:4px;z-index:3;transform:translateX(-50%);padding:1px 4px;border-radius:999px;
      overflow:hidden;white-space:nowrap;text-overflow:ellipsis;pointer-events:none;
      background:rgba(10,13,18,.62);color:#fff;text-shadow:0 1px 1px rgba(0,0,0,.35);
      font:600 8px/1.5 var(--mc-font,system-ui,sans-serif);letter-spacing:.02em}
    .lab[data-empty="1"]{text-decoration:line-through;opacity:.75}
    .lab[data-role="ours"]{background:rgba(15,157,88,.86)}
    .lab[data-role="gt"]{background:rgba(180,83,9,.86)}
    .layer{position:absolute;inset:0;z-index:1}
    .layer>video,.layer>img{position:absolute;inset:0;width:100%;height:100%;object-fit:contain;display:block;
      background:#0b0d10;image-rendering:var(--media-rendering,auto)}
    .layer[data-empty]>video,.layer[data-empty]>img{display:none}
    .layer[data-empty]::after{content:'无数据';position:absolute;inset:0;display:grid;place-items:center;
      padding:6px 2px;color:#aeb8c6;font:600 9.5px/1.3 var(--mc-font,system-ui,sans-serif);
      writing-mode:vertical-rl;text-orientation:mixed;
      background:repeating-linear-gradient(45deg,#141922,#141922 8px,#191f28 8px,#191f28 16px)}
    .divider{position:absolute;top:0;bottom:0;z-index:5;width:17px;margin-left:-8.5px;cursor:col-resize;
      touch-action:none;background:transparent}
    .divider::before{content:'';position:absolute;top:0;bottom:0;left:50%;width:1.5px;margin-left:-.75px;
      background:rgba(255,255,255,.92);box-shadow:0 0 0 .5px rgba(0,0,0,.25);
      transition:background .12s linear,width .12s linear,margin-left .12s linear}
    .divider:hover::before,.divider:focus-visible::before,.divider[data-active="1"]::before{
      background:#2563eb;width:3px;margin-left:-1.5px}
  `;

  class MultiCompare extends HTMLElement {
    static get observedAttributes() {
      return ['native-width', 'scale', 'aspect', 'value', 'start', 'loop', 'autoplay', 'min-gap'];
    }

    constructor() {
      super();
      this._items = [];
      this._edges = [];
      this._scale = 1;
      this._minGap = 2;
      this._playing = false;
      this._lock = false;
      this._drag = -1;
      this._dragMoved = false;
      this._stageW = 0;
      this._rectLeft = 0;
      this._pendingX = 0;
      this._ready = false;
      const root = this.attachShadow({ mode: 'open' });
      root.innerHTML =
        '<style>' + MC_CSS + '</style>' +
        '<div class="frame"><div class="stage"></div></div>';
      this._root = root;
      this._frame = root.querySelector('.frame');
      this._stage = root.querySelector('.stage');
      this._stage.addEventListener('click', (e) => this._onStageClick(e));
      this._layers = [];
      this._labels = [];
      this._medias = [];
      this._dividers = [];
    }

    /* ---------- 公开 API ---------- */
    setItems(items) {
      this._items = (items || []).filter(Boolean);
      if (this.isConnected) this._render();
      return this;
    }
    get items() {
      return this._items;
    }
    get positions() {
      return this._edges.slice();
    }

    play() {
      const vids = this._videos();
      if (!vids.length) return;
      this._playing = true;
      const t = this._startTime();
      vids.forEach((v) => {
        v.playbackRate = 1;
        if (Math.abs(v.currentTime - t) > 0.3) {
          try { v.currentTime = t; } catch (err) { /* 元数据未就绪时忽略 */ }
        }
        const p = v.play();
        if (p && p.catch) p.catch(() => {});
      });
      this._lastMaster = undefined;
      this._startLoop();
    }
    pause() {
      this._playing = false;
      this._medias.forEach((m) => {
        if (m.tagName !== 'VIDEO') return;
        m.pause();
        m.playbackRate = 1;
      });
      this._stopLoop();
    }
    restart() {
      const t = this._startTime();
      this._medias.forEach((m) => {
        if (m.tagName !== 'VIDEO') return;
        try { m.currentTime = t; } catch (err) { /* 忽略 */ }
      });
      this._lastMaster = undefined;
    }
    seek(sec) {
      const d = this._duration();
      const t = clamp(sec, 0, d || sec);
      this._medias.forEach((m) => {
        if (m.tagName !== 'VIDEO') return;
        try { m.currentTime = t; } catch (err) { /* 忽略 */ }
      });
    }
    /** 所有滑杆回到等宽位置 */
    resetPositions() {
      const n = this._items.length;
      this._edges = [];
      for (let i = 0; i <= n; i += 1) this._edges.push((i / n) * 100);
      this._applyAll();
    }
    get playing() {
      return this._playing;
    }

    /* ---------- 生命周期 ---------- */
    connectedCallback() {
      if (!this._ready) this._render();
      this._observe();
    }
    disconnectedCallback() {
      this._stopLoop();
      if (this._io) {
        this._io.disconnect();
        this._io = null;
      }
    }
    attributeChangedCallback() {
      if (this._ready) this._sync();
    }

    /* ---------- 渲染 ---------- */
    _render() {
      const n = this._items.length;
      this._stage.textContent = '';
      this._layers = [];
      this._labels = [];
      this._medias = [];
      this._dividers = [];
      this._playing = false;
      if (!n) return false;

      this._items.forEach((it, i) => {
        const layer = document.createElement('div');
        layer.className = 'layer';

        let media;
        if (it.type === 'image') {
          media = document.createElement('img');
          media.alt = it.label || '';
          media.loading = 'lazy';
          media.decoding = 'async';
          if (it.src) media.src = it.src;
        } else {
          media = document.createElement('video');
          media.muted = true;
          media.loop = this.hasAttribute('loop');
          media.playsInline = true;
          media.preload = 'metadata';
          media.setAttribute('playsinline', '');
          media.setAttribute('disablepictureinpicture', '');
          if (it.poster) media.poster = it.poster;
          // 加 #t=0.1：即使还没开始播放，也能显示一帧画面（避免一片黑）
          if (it.src) media.src = it.src.indexOf('#') === -1 ? it.src + '#t=0.1' : it.src;
        }
        layer.append(media);

        // 方法名：横向小胶囊，压在每块画面的左上角（画面内），位置跟着画面宽度走
        const lab = document.createElement('span');
        lab.className = 'lab';
        lab.textContent = it.label || '';
        lab.title = it.label || '';
        if (it.role) lab.setAttribute('data-role', it.role);

        this._layers.push(layer);
        this._labels.push(lab);
        this._medias.push(media);
        this._stage.append(layer, lab);

        media.addEventListener('error', () => this._markEmpty(i));
        if (!it.src) this._markEmpty(i);
      });

      for (let i = 1; i < n; i += 1) {
        const d = document.createElement('div');
        d.className = 'divider';
        d.tabIndex = 0;
        d.setAttribute('role', 'slider');
        d.setAttribute('aria-orientation', 'vertical');
        d.setAttribute('aria-valuemin', '0');
        d.setAttribute('aria-valuemax', '100');
        d.setAttribute('aria-label', '调整「' + ((this._items[i - 1] || {}).label || '') + '」与「' + ((this._items[i] || {}).label || '') + '」的宽度');
        d.addEventListener('pointerdown', (e) => this._onDown(e, i));
        d.addEventListener('keydown', (e) => this._onKey(e, i));
        d.addEventListener('click', (e) => e.stopPropagation());
        d.addEventListener('dblclick', (e) => {
          e.preventDefault();
          e.stopPropagation();
          this.resetPositions();
        });
        this._stage.append(d);
        this._dividers.push(d);
      }

      this._edges = [];
      for (let i = 0; i <= n; i += 1) this._edges.push((i / n) * 100);
      this._ready = true;
      this._sync();
      this._fitLabels();
      return true;
    }

    _sync() {
      const native = parseFloat(this.getAttribute('native-width'));
      this._frame.style.setProperty('--mc-native', (isFinite(native) && native > 0 ? native : 256) + 'px');
      const aspect = parseFloat(this.getAttribute('aspect'));
      this._stage.style.setProperty('--mc-aspect', String(isFinite(aspect) && aspect > 0 ? aspect : 1));
      const s = parseFloat(this.getAttribute('scale'));
      if (isFinite(s) && s > 0) this._scale = s;
      this._frame.style.setProperty('--mc-scale', String(this._scale));
      const g = parseFloat(this.getAttribute('min-gap'));
      if (isFinite(g) && g > 0) this._minGap = Math.min(g, 25);
      const loop = this.hasAttribute('loop');
      this._medias.forEach((m) => {
        if (m.tagName === 'VIDEO') m.loop = loop;
      });
      const v = this.getAttribute('value');
      if (v && this._items.length) {
        const arr = String(v).split(',').map(Number).filter((num) => isFinite(num));
        if (arr.length === this._items.length + 1) this._edges = arr;
      }
      this._stageW = this._stage.getBoundingClientRect().width;
      this._applyAll();
      this._fitLabels();
    }

    /** 标注横向排：按初始宽度量一次自然宽度，太长的自动缩字号（最小 6.5px） */
    _fitLabels() {
      const n = this._items.length || 1;
      const avail = Math.max(0, (this._stageW || 256) / n - 10);
      this._labels.forEach((lab) => {
        lab.style.maxWidth = 'none';
        lab.style.fontSize = '';
        const natural = lab.scrollWidth || 0;
        const size = natural > avail && avail > 0 ? Math.max(6.5, 8 * (avail / natural)) : 8;
        lab.style.fontSize = size.toFixed(2) + 'px';
      });
      this._layoutLabels();
    }

    _applyAll() {
      const n = this._items.length;
      if (!n || this._edges.length !== n + 1) return;
      for (let i = 0; i < n; i += 1) this._applyLayer(i);
      for (let j = 1; j < n; j += 1) this._applyDivider(j);
      this._layoutLabels();
    }

    _applyLayer(i) {
      const layer = this._layers[i];
      if (!layer) return;
      const l = this._edges[i];
      const r = this._edges[i + 1];
      layer.style.clipPath = 'inset(0 ' + (100 - r).toFixed(4) + '% 0 ' + l.toFixed(4) + '%)';
    }

    _applyDivider(j) {
      const d = this._dividers[j - 1];
      if (!d) return;
      const p = this._edges[j];
      d.style.left = p + '%';
      d.setAttribute('aria-valuenow', String(Math.round(p)));
    }

    /** 每个方法名居中在自己那一块画面的顶部内侧；块太窄就自动收起 */
    _layoutLabels() {
      if (!this._edges.length) return;
      const w = this._stageW;
      this._labels.forEach((lab, i) => {
        const l = this._edges[i];
        const r = this._edges[i + 1];
        lab.style.left = ((l + r) / 2).toFixed(3) + '%';
        const avail = (w ? ((r - l) / 100) * w : 0) - 10;
        if (!w || avail < 8) {
          lab.style.display = 'none';
          return;
        }
        lab.style.display = '';
        lab.style.maxWidth = avail + 'px';
      });
    }

    _markEmpty(index) {
      const layer = this._layers[index];
      if (!layer || layer.hasAttribute('data-empty')) return;
      layer.setAttribute('data-empty', '');
      const lab = this._labels[index];
      if (lab) {
        lab.setAttribute('data-empty', '1');
        lab.title = ((this._items[index] || {}).label || '') + ' · 无数据';
      }
      const media = this._medias[index];
      if (media && media.tagName === 'VIDEO' && !media.paused) media.pause();
    }

    /* ---------- 拖拽 ---------- */
    _onDown(e, index) {
      if (typeof e.button === 'number' && e.button !== 0) return;
      e.preventDefault();
      e.stopPropagation();
      this._drag = index;
      this._dragMoved = false;
      const rect = this._stage.getBoundingClientRect();
      this._stageW = rect.width;
      this._rectLeft = rect.left;
      const divider = this._dividers[index - 1];
      if (divider) divider.setAttribute('data-active', '1');
      const move = (ev) => {
        this._dragMoved = true;
        this._pendingX = ev.clientX;
        this._dragTo(this._pendingX, index);
      };
      const up = () => {
        window.removeEventListener('pointermove', move);
        window.removeEventListener('pointerup', up);
        window.removeEventListener('pointercancel', up);
        // 松手前把最后一次位置补上，避免"跟不上鼠标"
        if (this._drag === index) this._dragTo(this._pendingX, index);
        if (divider) divider.removeAttribute('data-active');
        this._drag = -1;
      };
      window.addEventListener('pointermove', move);
      window.addEventListener('pointerup', up);
      window.addEventListener('pointercancel', up);
      this._pendingX = e.clientX;
      this._dragTo(e.clientX, index);
    }

    _dragTo(clientX, index) {
      if (!this._stageW) return;
      const pct = clamp(((clientX - this._rectLeft) / this._stageW) * 100, 0, 100);
      const lo = this._edges[index - 1] + this._minGap;
      const hi = this._edges[index + 1] - this._minGap;
      const next = lo <= hi ? clamp(pct, lo, hi) : (lo + hi) / 2;
      if (Math.abs(next - this._edges[index]) < 0.002) return;
      this._edges[index] = next;
      // 只更新受影响的 2 块画面 + 这 1 根滑杆，其它画面完全不动
      this._applyLayer(index - 1);
      this._applyLayer(index);
      this._applyDivider(index);
      this._layoutLabels();
    }

    _onKey(e, index) {
      const step = e.shiftKey ? 5 : 1;
      const lo = this._edges[index - 1] + this._minGap;
      const hi = this._edges[index + 1] - this._minGap;
      if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
        this._edges[index] = clamp(this._edges[index] + (e.key === 'ArrowLeft' ? -step : step), lo, hi);
      } else if (e.key === 'Home') {
        this._edges[index] = lo;
      } else if (e.key === 'End') {
        this._edges[index] = hi;
      } else {
        return;
      }
      e.preventDefault();
      this._applyAll();
    }

    _onStageClick(e) {
      if (this._drag >= 0 || !this._items.length) return;
      if (this._dragMoved) {
        // 刚刚拖过滑杆：这次 click 不算"点击画面"
        this._dragMoved = false;
        return;
      }
      const rect = this._stage.getBoundingClientRect();
      if (!rect.width) return;
      const pct = ((e.clientX - rect.left) / rect.width) * 100;
      let index = 0;
      this._items.forEach((it, i) => {
        if (pct >= this._edges[i]) index = i;
      });
      // 该块没有数据（比如 WeatherGS 还没跑出来）时不打开放大查看
      const layer = this._layers[index];
      if (layer && layer.hasAttribute('data-empty')) return;
      this.dispatchEvent(new CustomEvent('mc-open', { detail: { index: index }, bubbles: true, composed: true }));
    }

    /* ---------- 播放同步 ---------- */
    _videos() {
      return this._medias.filter((m, i) => m.tagName === 'VIDEO' && this._layers[i] && !this._layers[i].hasAttribute('data-empty'));
    }
    _startTime() {
      const s = parseFloat(this.getAttribute('start'));
      return isFinite(s) && s > 0 ? s : 0;
    }
    _duration() {
      const v = this._videos()[0];
      if (v && isFinite(v.duration) && v.duration > 0) return v.duration;
      return 0;
    }
    _observe() {
      if (this._io) return;
      if (!('IntersectionObserver' in window)) {
        this._playIfAllowed();
        return;
      }
      this._io = new IntersectionObserver(
        (entries) => {
          entries.forEach((entry) => {
            if (entry.isIntersecting && entry.intersectionRatio >= 0.3) this._playIfAllowed();
            else if (this._playing) this.pause();
          });
        },
        { threshold: [0, 0.3] }
      );
      this._io.observe(this);
    }
    _playIfAllowed() {
      if (VideoCompare.autoplayGlobal === false) return;
      if (!this.hasAttribute('autoplay')) return;
      this.play();
    }
    _startLoop() {
      if (this._raf) return;
      const tick = () => {
        this._raf = requestAnimationFrame(tick);
        this._correct();
      };
      this._raf = requestAnimationFrame(tick);
    }
    _stopLoop() {
      if (this._raf) cancelAnimationFrame(this._raf);
      this._raf = null;
    }
    /** 以第一路视频为基准，把其余几路拉回同一时间轴（含循环回到起点的对齐） */
    _correct() {
      if (this._lock || !this._playing) return;
      const vids = this._videos().filter((v) => !v.paused);
      if (vids.length < 2) return;
      const master = vids[0];
      const mt = master.currentTime;
      const d = this._duration() || 0;
      const wrapped = this._lastMaster !== undefined && mt < this._lastMaster - 0.4;
      this._lastMaster = mt;
      vids.slice(1).forEach((v) => {
        if (wrapped) {
          try { v.currentTime = mt; } catch (err) { /* 忽略 */ }
          if (v.playbackRate !== 1) v.playbackRate = 1;
        } else {
          syncVideo(v, mt, d);
        }
      });
    }
  }
  customElements.define('multi-compare', MultiCompare);
  window.MultiCompare = MultiCompare;

  /* ==========================================================================
   * 4) <row-compare> 多路视频横向并排对比（Part 2 用）
   *
   *    一行里并排摆 N 路视频（每路一个格子），格子之间是细线滑杆；
   *    拖动滑杆调整左右两块画面的宽度。每块画面 = 自己的视频（正方形，
   *    宽度 = 所在格子的宽度，最大不超过 native-width，绝不放大）。
   *
   *    属性：native-width / aspect / value / start / loop / autoplay / min-gap
   *    API：setItems([{src,label,type,poster,role,groupStart}])、play()/pause()/restart()/seek()
   *    事件：rc-open —— 点击某一格时抛出 { detail:{ index } }
   * ======================================================================= */
  const RC_CSS = `
    :host{display:block;width:100%}
    *,*::before,*::after{box-sizing:border-box}
    .row{position:relative;display:flex;align-items:flex-start;width:100%}
    .cell{position:relative;flex:0 0 auto;min-width:0;padding:0 4px}
    .cell[data-group="start"]{padding-left:12px}
    .shot{position:relative;width:100%;max-width:var(--rc-native,256px);margin:0 auto;
      aspect-ratio:var(--rc-aspect,1);background:#0b0d10;border-radius:6px;overflow:hidden}
    .shot>video,.shot>img{position:absolute;inset:0;width:100%;height:100%;object-fit:contain;display:block;
      background:#0b0d10;image-rendering:var(--media-rendering,auto)}
    .cell[data-empty] .shot>video,.cell[data-empty] .shot>img{display:none}
    .cell[data-empty] .shot::after{content:'无数据';position:absolute;inset:0;display:grid;place-items:center;
      color:#aeb8c6;font:600 9.5px/1.3 var(--rc-font,system-ui,sans-serif);
      background:repeating-linear-gradient(45deg,#141922,#141922 8px,#191f28 8px,#191f28 16px)}
    .lab{position:absolute;top:4px;left:50%;transform:translateX(-50%);z-index:3;max-width:calc(100% - 8px);
      padding:1px 4px;border-radius:999px;overflow:hidden;white-space:nowrap;text-overflow:ellipsis;
      background:rgba(10,13,18,.62);color:#fff;text-shadow:0 1px 1px rgba(0,0,0,.35);pointer-events:none;
      font:600 8px/1.5 var(--rc-font,system-ui,sans-serif);letter-spacing:.02em}
    .lab[data-empty="1"]{text-decoration:line-through;opacity:.75}
    .lab[data-role="ours"]{background:rgba(15,157,88,.86)}
    .lab[data-role="gt"]{background:rgba(180,83,9,.86)}
    .divider{position:absolute;top:0;bottom:0;z-index:5;width:17px;margin-left:-8.5px;cursor:col-resize;
      touch-action:none;background:transparent}
    .divider::before{content:'';position:absolute;top:0;bottom:0;left:50%;width:1.5px;margin-left:-.75px;
      background:rgba(37,99,235,.35);transition:background .12s linear,width .12s linear,margin-left .12s linear}
    .divider:hover::before,.divider:focus-visible::before,.divider[data-active="1"]::before{
      background:#2563eb;width:3px;margin-left:-1.5px}
  `;

  class RowCompare extends HTMLElement {
    static get observedAttributes() {
      return ['native-width', 'aspect', 'value', 'start', 'loop', 'autoplay', 'min-gap'];
    }
    constructor() {
      super();
      this._items = [];
      this._edges = [];
      this._minGap = 2;
      this._playing = false;
      this._lock = false;
      this._drag = -1;
      this._dragMoved = false;
      this._rowW = 0;
      this._rectLeft = 0;
      this._pendingX = 0;
      this._ready = false;
      const root = this.attachShadow({ mode: 'open' });
      root.innerHTML = '<style>' + RC_CSS + '</style><div class="row"></div>';
      this._root = root;
      this._row = root.querySelector('.row');
      this._row.addEventListener('click', (e) => this._onClick(e));
      this._cells = [];
      this._shots = [];
      this._labels = [];
      this._medias = [];
      this._dividers = [];
    }

    /* ---------- 公开 API ---------- */
    setItems(items) {
      this._items = (items || []).filter(Boolean);
      if (this.isConnected) this._render();
      return this;
    }
    get items() {
      return this._items;
    }
    get positions() {
      return this._edges.slice();
    }
    get playing() {
      return this._playing;
    }
    play() {
      const vids = this._videos();
      if (!vids.length) return;
      this._playing = true;
      const t = this._startTime();
      vids.forEach((v) => {
        v.playbackRate = 1;
        if (Math.abs(v.currentTime - t) > 0.3) {
          try { v.currentTime = t; } catch (err) { /* 忽略 */ }
        }
        const p = v.play();
        if (p && p.catch) p.catch(() => {});
      });
      this._lastMaster = undefined;
      this._startLoop();
    }
    pause() {
      this._playing = false;
      this._medias.forEach((m) => {
        if (m.tagName !== 'VIDEO') return;
        m.pause();
        m.playbackRate = 1;
      });
      this._stopLoop();
    }
    restart() {
      const t = this._startTime();
      this._medias.forEach((m) => {
        if (m.tagName !== 'VIDEO') return;
        try { m.currentTime = t; } catch (err) { /* 忽略 */ }
      });
      this._lastMaster = undefined;
    }
    seek(sec) {
      const d = this._duration();
      const t = clamp(sec, 0, d || sec);
      this._medias.forEach((m) => {
        if (m.tagName !== 'VIDEO') return;
        try { m.currentTime = t; } catch (err) { /* 忽略 */ }
      });
    }
    /** 所有滑杆回到等宽位置 */
    resetPositions() {
      const n = this._items.length;
      this._edges = [];
      for (let i = 0; i <= n; i += 1) this._edges.push((i / n) * 100);
      this._applyAll();
    }

    /* ---------- 生命周期 ---------- */
    connectedCallback() {
      if (!this._ready) this._render();
      this._observe();
    }
    disconnectedCallback() {
      this._stopLoop();
      if (this._io) {
        this._io.disconnect();
        this._io = null;
      }
    }
    attributeChangedCallback() {
      if (this._ready) this._sync();
    }

    /* ---------- 渲染 ---------- */
    _render() {
      const n = this._items.length;
      this._row.textContent = '';
      this._cells = [];
      this._shots = [];
      this._labels = [];
      this._medias = [];
      this._dividers = [];
      this._playing = false;
      if (!n) return false;

      this._items.forEach((it, i) => {
        const cell = document.createElement('div');
        cell.className = 'cell';
        if (it.groupStart) cell.setAttribute('data-group', 'start');

        const shot = document.createElement('div');
        shot.className = 'shot';

        let media;
        if (it.type === 'image') {
          media = document.createElement('img');
          media.alt = it.label || '';
          media.loading = 'lazy';
          media.decoding = 'async';
          if (it.src) media.src = it.src;
        } else {
          media = document.createElement('video');
          media.muted = true;
          media.loop = this.hasAttribute('loop');
          media.playsInline = true;
          media.preload = 'metadata';
          media.setAttribute('playsinline', '');
          media.setAttribute('disablepictureinpicture', '');
          if (it.poster) media.poster = it.poster;
          // 加 #t=0.1：即使还没开始播放，也能显示一帧画面
          if (it.src) media.src = it.src.indexOf('#') === -1 ? it.src + '#t=0.1' : it.src;
        }
        const lab = document.createElement('span');
        lab.className = 'lab';
        lab.textContent = it.label || '';
        lab.title = it.label || '';
        if (it.role) lab.setAttribute('data-role', it.role);

        shot.append(media, lab);
        cell.append(shot);
        this._cells.push(cell);
        this._shots.push(shot);
        this._labels.push(lab);
        this._medias.push(media);
        this._row.append(cell);

        media.addEventListener('error', () => this._markEmpty(i));
        if (!it.src) this._markEmpty(i);
      });

      for (let i = 1; i < n; i += 1) {
        const d = document.createElement('div');
        d.className = 'divider';
        d.tabIndex = 0;
        d.setAttribute('role', 'slider');
        d.setAttribute('aria-orientation', 'vertical');
        d.setAttribute('aria-valuemin', '0');
        d.setAttribute('aria-valuemax', '100');
        d.setAttribute('aria-label', '调整「' + ((this._items[i - 1] || {}).label || '') + '」与「' + ((this._items[i] || {}).label || '') + '」的宽度');
        d.addEventListener('pointerdown', (e) => this._onDown(e, i));
        d.addEventListener('keydown', (e) => this._onKey(e, i));
        d.addEventListener('click', (e) => e.stopPropagation());
        d.addEventListener('dblclick', (e) => {
          e.preventDefault();
          e.stopPropagation();
          this.resetPositions();
        });
        this._row.append(d);
        this._dividers.push(d);
      }

      this._edges = [];
      for (let i = 0; i <= n; i += 1) this._edges.push((i / n) * 100);
      this._ready = true;
      this._sync();
      return true;
    }

    _sync() {
      const native = parseFloat(this.getAttribute('native-width'));
      this._row.style.setProperty('--rc-native', (isFinite(native) && native > 0 ? native : 256) + 'px');
      const aspect = parseFloat(this.getAttribute('aspect'));
      this._row.style.setProperty('--rc-aspect', String(isFinite(aspect) && aspect > 0 ? aspect : 1));
      const g = parseFloat(this.getAttribute('min-gap'));
      if (isFinite(g) && g > 0) this._minGap = Math.min(g, 25);
      const loop = this.hasAttribute('loop');
      this._medias.forEach((m) => {
        if (m.tagName === 'VIDEO') m.loop = loop;
      });
      const v = this.getAttribute('value');
      if (v && this._items.length) {
        const arr = String(v).split(',').map(Number).filter((num) => isFinite(num));
        if (arr.length === this._items.length + 1) this._edges = arr;
      }
      this._rowW = this._row.getBoundingClientRect().width;
      this._applyAll();
    }

    _applyAll() {
      const n = this._items.length;
      if (!n || this._edges.length !== n + 1) return;
      for (let i = 0; i < n; i += 1) this._applyCell(i);
      for (let j = 1; j < n; j += 1) this._applyDivider(j);
    }
    _applyCell(i) {
      const cell = this._cells[i];
      if (!cell) return;
      cell.style.width = (this._edges[i + 1] - this._edges[i]).toFixed(4) + '%';
    }
    _applyDivider(j) {
      const d = this._dividers[j - 1];
      if (!d) return;
      const p = this._edges[j];
      d.style.left = p + '%';
      d.setAttribute('aria-valuenow', String(Math.round(p)));
    }

    _markEmpty(index) {
      const cell = this._cells[index];
      if (!cell || cell.hasAttribute('data-empty')) return;
      cell.setAttribute('data-empty', '');
      const lab = this._labels[index];
      if (lab) {
        lab.setAttribute('data-empty', '1');
        lab.title = ((this._items[index] || {}).label || '') + ' · 无数据';
      }
      const media = this._medias[index];
      if (media && media.tagName === 'VIDEO' && !media.paused) media.pause();
    }

    /* ---------- 拖拽 ---------- */
    _onDown(e, index) {
      if (typeof e.button === 'number' && e.button !== 0) return;
      e.preventDefault();
      e.stopPropagation();
      this._drag = index;
      this._dragMoved = false;
      const rect = this._row.getBoundingClientRect();
      this._rowW = rect.width;
      this._rectLeft = rect.left;
      const divider = this._dividers[index - 1];
      if (divider) divider.setAttribute('data-active', '1');
      const move = (ev) => {
        this._dragMoved = true;
        this._pendingX = ev.clientX;
        this._dragTo(this._pendingX, index);
      };
      const up = () => {
        window.removeEventListener('pointermove', move);
        window.removeEventListener('pointerup', up);
        window.removeEventListener('pointercancel', up);
        if (this._drag === index) this._dragTo(this._pendingX, index);
        if (divider) divider.removeAttribute('data-active');
        this._drag = -1;
      };
      window.addEventListener('pointermove', move);
      window.addEventListener('pointerup', up);
      window.addEventListener('pointercancel', up);
      this._pendingX = e.clientX;
      this._dragTo(e.clientX, index);
    }

    _dragTo(clientX, index) {
      if (!this._rowW) return;
      const pct = clamp(((clientX - this._rectLeft) / this._rowW) * 100, 0, 100);
      const lo = this._edges[index - 1] + this._minGap;
      const hi = this._edges[index + 1] - this._minGap;
      const next = lo <= hi ? clamp(pct, lo, hi) : (lo + hi) / 2;
      if (Math.abs(next - this._edges[index]) < 0.002) return;
      this._edges[index] = next;
      // 只更新受影响的 2 格 + 这 1 根滑杆
      this._applyCell(index - 1);
      this._applyCell(index);
      this._applyDivider(index);
    }

    _onKey(e, index) {
      const step = e.shiftKey ? 5 : 1;
      const lo = this._edges[index - 1] + this._minGap;
      const hi = this._edges[index + 1] - this._minGap;
      if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
        this._edges[index] = clamp(this._edges[index] + (e.key === 'ArrowLeft' ? -step : step), lo, hi);
      } else if (e.key === 'Home') {
        this._edges[index] = lo;
      } else if (e.key === 'End') {
        this._edges[index] = hi;
      } else {
        return;
      }
      e.preventDefault();
      this._applyAll();
    }

    _onClick(e) {
      if (this._drag >= 0 || !this._items.length) return;
      if (this._dragMoved) {
        this._dragMoved = false;
        return;
      }
      const rect = this._row.getBoundingClientRect();
      if (!rect.width) return;
      const pct = ((e.clientX - rect.left) / rect.width) * 100;
      let index = 0;
      this._items.forEach((it, i) => {
        if (pct >= this._edges[i]) index = i;
      });
      const cell = this._cells[index];
      if (cell && cell.hasAttribute('data-empty')) return;
      this.dispatchEvent(new CustomEvent('rc-open', { detail: { index: index }, bubbles: true, composed: true }));
    }

    /* ---------- 播放同步 ---------- */
    _videos() {
      return this._medias.filter((m, i) => m.tagName === 'VIDEO' && this._cells[i] && !this._cells[i].hasAttribute('data-empty'));
    }
    _startTime() {
      const s = parseFloat(this.getAttribute('start'));
      return isFinite(s) && s > 0 ? s : 0;
    }
    _duration() {
      const v = this._videos()[0];
      if (v && isFinite(v.duration) && v.duration > 0) return v.duration;
      return 0;
    }
    _observe() {
      if (this._io) return;
      if (!('IntersectionObserver' in window)) {
        this._playIfAllowed();
        return;
      }
      this._io = new IntersectionObserver(
        (entries) => {
          entries.forEach((entry) => {
            if (entry.isIntersecting && entry.intersectionRatio >= 0.3) this._playIfAllowed();
            else if (this._playing) this.pause();
          });
        },
        { threshold: [0, 0.3] }
      );
      this._io.observe(this);
    }
    _playIfAllowed() {
      if (VideoCompare.autoplayGlobal === false) return;
      if (!this.hasAttribute('autoplay')) return;
      this.play();
    }
    _startLoop() {
      if (this._raf) return;
      const tick = () => {
        this._raf = requestAnimationFrame(tick);
        this._correct();
      };
      this._raf = requestAnimationFrame(tick);
    }
    _stopLoop() {
      if (this._raf) cancelAnimationFrame(this._raf);
      this._raf = null;
    }
    _correct() {
      if (this._lock || !this._playing) return;
      const vids = this._videos().filter((v) => !v.paused);
      if (vids.length < 2) return;
      const master = vids[0];
      const mt = master.currentTime;
      const d = this._duration() || 0;
      const wrapped = this._lastMaster !== undefined && mt < this._lastMaster - 0.4;
      this._lastMaster = mt;
      vids.slice(1).forEach((v) => {
        if (wrapped) {
          try { v.currentTime = mt; } catch (err) { /* 忽略 */ }
          if (v.playbackRate !== 1) v.playbackRate = 1;
        } else {
          syncVideo(v, mt, d);
        }
      });
    }
  }
  customElements.define('row-compare', RowCompare);
  window.RowCompare = RowCompare;

  /* ==========================================================================
   * 5) <auto-video> 单路自动播放视频（Part 0 用）
   *
   *    静音、循环、进入视口自动播放；没有任何播放控件；
   *    显示宽度 = min(容器宽度, native-width)，只缩不放。
   *
   *    属性：src / poster / native-width（默认 256）/ aspect / start / loop / autoplay
   *    方法：play() / pause()
   * ======================================================================= */
  const AV_CSS = `
    :host{display:block;width:100%}
    .frame{width:min(100%,var(--av-native,256px));margin:0 auto}
    video{display:block;width:100%;height:auto;aspect-ratio:var(--av-aspect,1);object-fit:contain;
      border-radius:8px;background:#0b0d10;image-rendering:var(--media-rendering,auto)}
    video[data-missing]{display:none}
    .missing{position:absolute;inset:0;display:none;place-content:center;gap:6px;padding:12px;text-align:center;
      color:#fff;border-radius:8px;background:repeating-linear-gradient(45deg,#171b21,#171b21 10px,#1e232b 10px,#1e232b 20px)}
    .missing[data-visible]{display:grid}
    .missing b{font:700 12px/1.5 var(--av-font,system-ui,sans-serif);color:#ffd48a}
    .missing code{font:500 10.5px/1.5 var(--av-mono,ui-monospace,monospace);word-break:break-all;color:#c9d1dc}
    .box{position:relative}
  `;

  class AutoVideo extends HTMLElement {
    static get observedAttributes() {
      return ['src', 'poster', 'native-width', 'aspect', 'start', 'loop', 'autoplay'];
    }
    constructor() {
      super();
      const root = this.attachShadow({ mode: 'open' });
      root.innerHTML =
        '<style>' + AV_CSS + '</style>' +
        '<div class="frame"><div class="box">' +
        '  <video muted playsinline preload="metadata" disablepictureinpicture></video>' +
        '  <div class="missing"><b>缺少资源</b><code></code></div>' +
        '</div></div>';
      this._root = root;
      this._frame = root.querySelector('.frame');
      this._video = root.querySelector('video');
      this._missing = root.querySelector('.missing');
      this._missingCode = root.querySelector('.missing code');
      this._playing = false;
    }

    play() {
      if (this._video.hasAttribute('data-missing')) return;
      const p = this._video.play();
      if (p && p.catch) p.catch(() => {});
      this._playing = true;
    }
    pause() {
      this._video.pause();
      this._playing = false;
    }
    get playing() {
      return this._playing;
    }

    connectedCallback() {
      this._sync();
      this._observe();
    }
    disconnectedCallback() {
      if (this._io) {
        this._io.disconnect();
        this._io = null;
      }
      this.pause();
    }
    attributeChangedCallback() {
      if (this.isConnected) this._sync();
    }

    _sync() {
      const native = parseFloat(this.getAttribute('native-width'));
      this._frame.style.setProperty('--av-native', (isFinite(native) && native > 0 ? native : 256) + 'px');
      const aspect = parseFloat(this.getAttribute('aspect'));
      this._video.style.setProperty('--av-aspect', String(isFinite(aspect) && aspect > 0 ? aspect : 1));

      const loop = this.hasAttribute('loop');
      this._video.loop = loop;
      this._video.muted = true;

      const start = parseFloat(this.getAttribute('start'));
      this._startTime = isFinite(start) && start > 0 ? start : 0;

      const src = this.getAttribute('src');
      if (!src) {
        this._markMissing('（data.js 中该字段为空）');
        return;
      }
      if (this._video.dataset.src === src) return;
      this._video.dataset.src = src;
      this._video.removeAttribute('data-missing');
      this._missing.removeAttribute('data-visible');
      // 加 #t=0.1：还没开始播放时也能显示一帧画面
      this._video.src = src.indexOf('#') === -1 ? src + '#t=0.1' : src;
    }

    _markMissing(reason) {
      this._video.setAttribute('data-missing', '1');
      this._missingCode.textContent = reason || this.getAttribute('src') || '';
      this._missing.setAttribute('data-visible', '');
      this.pause();
    }

    _observe() {
      if (this._io) return;
      if (!('IntersectionObserver' in window)) {
        this._playIfAllowed();
        return;
      }
      this._io = new IntersectionObserver(
        (entries) => {
          entries.forEach((entry) => {
            if (entry.isIntersecting && entry.intersectionRatio >= 0.3) this._playIfAllowed();
            else if (this._playing) this.pause();
          });
        },
        { threshold: [0, 0.3] }
      );
      this._io.observe(this);
    }
    _playIfAllowed() {
      if (VideoCompare.autoplayGlobal === false) return;
      if (!this.hasAttribute('autoplay')) return;
      this.play();
    }
  }
  customElements.define('auto-video', AutoVideo);
  window.AutoVideo = AutoVideo;

  /* ==========================================================================
   * 6) <media-lightbox> 点击放大查看
   *    用法：el.open(items, index)
   *      items = [{ src, type:'image'|'video', label, native }]
   * ======================================================================= */
  const LB_CSS = `
    :host{position:fixed;inset:0;z-index:1200;display:none;font:500 13px/1.5 var(--font-sans,system-ui,sans-serif)}
    :host([open]){display:block}
    .backdrop{position:absolute;inset:0;background:rgba(8,10,14,.86);backdrop-filter:blur(6px)}
    .panel{position:absolute;inset:0;display:flex;flex-direction:column;color:#e9edf3}
    .bar{display:flex;align-items:center;gap:10px;padding:10px 14px;
      background:linear-gradient(180deg,rgba(8,10,14,.75),rgba(8,10,14,0))}
    .title{font-weight:700;color:#fff}
    .path{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;
      font:500 11px/1.6 var(--font-mono,ui-monospace,monospace);color:#98a2b3}
    .bar button,.bar a{font:inherit;color:#e9edf3;background:rgba(255,255,255,.10);border:1px solid rgba(255,255,255,.18);
      border-radius:8px;padding:5px 10px;cursor:pointer;text-decoration:none}
    .bar button:hover,.bar a:hover{background:rgba(255,255,255,.20);color:#fff}
    .view{flex:1;overflow:auto;display:grid;place-items:center;padding:12px 14px}
    .view[data-scale-mode="fit"] img,.view[data-scale-mode="fit"] video{max-width:min(94vw,1400px);max-height:76vh;width:auto;height:auto}
    .view[data-scale-mode="native"] img{max-width:none;max-height:none}
    .view[data-scale-mode="native"] video{max-width:none;max-height:none;
      width:calc(var(--lb-native,256px) * var(--lb-scale,1));height:auto}
    img,video{display:block;background:#0b0d10;border-radius:8px;box-shadow:0 20px 60px rgba(0,0,0,.5);
      image-rendering:var(--media-rendering,auto)}
    .foot{display:flex;align-items:center;justify-content:center;gap:14px;padding:8px 14px 18px}
    .foot button{font:inherit;color:#e9edf3;background:rgba(255,255,255,.10);border:1px solid rgba(255,255,255,.18);
      border-radius:999px;padding:6px 14px;cursor:pointer}
    .foot button:disabled{opacity:.35;cursor:not-allowed}
    .foot .counter{color:#98a2b3;font-variant-numeric:tabular-nums}
    .hint{position:absolute;right:16px;bottom:12px;color:#8b95a5;font-size:11px}
  `;

  class MediaLightbox extends HTMLElement {
    constructor() {
      super();
      const root = this.attachShadow({ mode: 'open' });
      root.innerHTML =
        '<style>' + LB_CSS + '</style>' +
        '<div class="backdrop" data-act="close"></div>' +
        '<div class="panel" role="dialog" aria-modal="true" aria-label="查看大图">' +
        '  <div class="bar">' +
        '    <span class="title"></span>' +
        '    <span class="path"></span>' +
        '    <a class="ext" target="_blank" rel="noopener">新窗口打开</a>' +
        '    <button type="button" data-act="fit">适应窗口</button>' +
        '    <button type="button" data-act="scale" hidden>2x</button>' +
        '    <button type="button" data-act="close">关闭 ✕</button>' +
        '  </div>' +
        '  <div class="view" data-scale-mode="fit"></div>' +
        '  <div class="foot">' +
        '    <button type="button" data-act="prev">‹ 上一个</button>' +
        '    <span class="counter"></span>' +
        '    <button type="button" data-act="next">下一个 ›</button>' +
        '  </div>' +
        '  <span class="hint">← → 切换 · Esc 关闭 · 视频为 256 原始分辨率</span>' +
        '</div>';
      this._root = root;
      this._view = root.querySelector('.view');
      this._title = root.querySelector('.title');
      this._path = root.querySelector('.path');
      this._ext = root.querySelector('.ext');
      this._counter = root.querySelector('.counter');
      this._btnPrev = root.querySelector('[data-act="prev"]');
      this._btnNext = root.querySelector('[data-act="next"]');
      this._btnFit = root.querySelector('[data-act="fit"]');
      this._btnScale = root.querySelector('[data-act="scale"]');
      this._items = [];
      this._index = 0;
      this._nativeMode = false;
      this._scale = 1;
    }
    connectedCallback() {
      if (this._bound) return;
      this._bound = true;
      this._root.addEventListener('click', (e) => {
        const act = e.target.closest('[data-act]');
        if (!act) return;
        const a = act.getAttribute('data-act');
        if (a === 'close') this.close();
        else if (a === 'prev') this.show(this._index - 1);
        else if (a === 'next') this.show(this._index + 1);
        else if (a === 'fit') this._toggleFit();
        else if (a === 'scale') this._toggleScale();
      });
      this._onKey = (e) => {
        if (!this.hasAttribute('open')) return;
        if (e.key === 'Escape') this.close();
        else if (e.key === 'ArrowLeft') this.show(this._index - 1);
        else if (e.key === 'ArrowRight') this.show(this._index + 1);
      };
      document.addEventListener('keydown', this._onKey);
    }
    disconnectedCallback() {
      document.removeEventListener('keydown', this._onKey);
    }

    open(items, index) {
      this._items = items || [];
      this._lastFocus = document.activeElement;
      this.setAttribute('open', '');
      document.body.style.overflow = 'hidden';
      this.show(index || 0);
      const focusable = this._root.querySelector('[data-act="close"]');
      if (focusable) focusable.focus();
    }
    close() {
      this.removeAttribute('open');
      document.body.style.overflow = '';
      this._view.innerHTML = '';
      if (this._lastFocus && this._lastFocus.focus) this._lastFocus.focus();
    }
    show(i) {
      const items = this._items;
      if (!items.length) return;
      this._index = (i + items.length) % items.length;
      const it = items[this._index];
      this._title.textContent = it.label || '';
      this._path.textContent = it.src || '';
      this._ext.href = it.src || '#';
      this._counter.textContent = items.length > 1 ? this._index + 1 + ' / ' + items.length : '';
      this._btnPrev.disabled = items.length < 2;
      this._btnNext.disabled = items.length < 2;
      this._nativeMode = false;
      this._scale = 1;
      this._view.dataset.scaleMode = 'fit';
      this._btnFit.textContent = '原始像素';
      this._btnScale.hidden = !(it.type === 'video');
      this._btnScale.textContent = '2x';
      this._view.innerHTML = '';
      let el;
      if (it.type === 'video') {
        el = document.createElement('video');
        el.src = it.src;
        el.muted = true;
        el.loop = true;
        el.autoplay = true;
        el.playsInline = true;
        el.controls = true;
        el.setAttribute('playsinline', '');
      } else {
        el = document.createElement('img');
        el.src = it.src;
        el.alt = it.label || '';
      }
      el.style.setProperty('--lb-native', (it.native || 256) + 'px');
      el.style.setProperty('--lb-scale', '1');
      el.addEventListener('error', () => {
        this._view.innerHTML = '<p style="font:600 14px/1.6 system-ui;color:#ffd48a">资源缺失：<br>' +
          '<span style="font:500 12px/1.6 ui-monospace,monospace;word-break:break-all;color:#c9d1dc">' +
          String(it.src || '').replace(/[<>&]/g, '') + '</span></p>';
      });
      this._el = el;
      this._view.appendChild(el);
    }
    _toggleFit() {
      this._nativeMode = !this._nativeMode;
      this._view.dataset.scaleMode = this._nativeMode ? 'native' : 'fit';
      this._btnFit.textContent = this._nativeMode ? '适应窗口' : '原始像素';
    }
    _toggleScale() {
      this._scale = this._scale === 1 ? 2 : 1;
      this._btnScale.textContent = this._scale === 2 ? '1x' : '2x';
      this._view.dataset.scaleMode = this._scale === 2 ? 'native' : 'fit';
      if (this._el) this._el.style.setProperty('--lb-scale', String(this._scale));
    }
  }
  customElements.define('media-lightbox', MediaLightbox);

  /* 页面级工具：供 main.js 使用 */
  window.MediaHelpers = { isVideoSrc: isVideoSrc, fmtTime: fmtTime };
})();
