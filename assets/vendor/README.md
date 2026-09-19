# vendor 说明

## 1. img-comparison-slider（已包含，离线可用）

- 文件：`img-comparison-slider.js`
- 版本：`img-comparison-slider@8.0.3`（UMD/IIFE 打包，直接 `<script>` 引入即可，不需要构建工具、不需要 `type="module"`）
- 来源：<https://unpkg.com/img-comparison-slider@8.0.3/dist/index.js>
- 引入位置：`index.html` 底部

用法（本项目由 `assets/js/main.js` 自动生成，无需手写）：

```html
<img-comparison-slider value="50">
  <img slot="first"  src="input.png" />
  <img slot="second" src="ours.png" />
</img-comparison-slider>
```

可调样式变量：`--divider-width` `--divider-color` `--default-handle-width` `--default-handle-color` 等。

**兜底机制**：如果这个文件被删除或加载失败，`assets/js/components.js` 会自动注册一个 API 兼容的内置实现（同样支持 `value` / `first` / `second` / `handle` 插槽），页面不会报错白屏。

升级方式（需要联网时执行）：

```powershell
Invoke-WebRequest -Uri https://unpkg.com/img-comparison-slider@8.0.3/dist/index.js -OutFile assets/vendor/img-comparison-slider.js
```

## 2. PhotoSwipe（可选，未包含）

当前「点击放大」由 `assets/js/components.js` 里的 `<media-lightbox>` 实现，零依赖、完全离线，已支持：

同场景内 `←/→` 切换、`Esc` 关闭、原始像素 / 适应窗口切换、视频 1x / 2x、「新窗口打开」。

如果确实要换成 PhotoSwipe（相册式手势缩放、更丰富的 UI）：

1. 下载 `photoswipe.umd.js`、`photoswipe-lightbox.umd.js`、`photoswipe.css` 到本目录（<https://unpkg.com/photoswipe@5/dist/>）。
2. 在 `index.html` 里引入这三份文件，并给 `.cell` 外层加 `data-pswp-src` / `data-pswp-width` / `data-pswp-height`。
3. 把 `main.js` 中 `lightbox().open(gallery, index)` 换成 `new PhotoSwipeLightbox({...}).init()` 打开对应索引。

> 提示：PhotoSwipe 5 的主构建是 ESM，`file://` 下直接用 `<script type="module">` 会被浏览器 CORS 拦截；若坚持用 file:// 打开，请改用 UMD 构建或启动本地服务器（`python -m http.server`）。
