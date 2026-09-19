/* =============================================================================
 * data.js —— 全站内容的唯一数据源
 *
 * · 页面结构在 index.html，样式在 assets/css/，渲染与交互在 assets/js/main.js
 * · 你通常只需要改这个文件：媒体根目录、扩展名、场景清单、方法清单、文案
 *
 * 命名规则（与 demo_final 目录一致，可按需改写下面的 path* 函数）：
 *   Part 0（四类天气场景）: {MEDIA_ROOT}/input_videos/weather/input_{天气场景名}{EXT}
 *                          （场景名 = CATEGORIES 的 scene，可不同于天气目录名 folder）
 *   Part 1（基线对比）    : {MEDIA_ROOT}/volsplat/{天气目录}/{文件名}{EXT}
 *                          {MEDIA_ROOT}/ours/{天气目录}/{文件名}{EXT}
 *   Part 2（方法对比）    : {MEDIA_ROOT}/compare/{方法名}/{天气目录}/{文件名}{EXT}
 *                          {MEDIA_ROOT}/ours/{天气目录}/{文件名}{EXT}
 *                          {MEDIA_ROOT}/gt/{天气目录}/{文件名}{EXT}
 *   文件名                : {天气目录}_{场景}_{强度}_{视角}
 *                          例：Rain_GrassFlower_heavy_view_high
 * ========================================================================== */
window.SITE = (function () {
  'use strict';

  /* ---------------------------------------------------------------------
   * 1) 基础设置：媒体放在哪、用什么扩展名
   * ------------------------------------------------------------------- */
  const CONFIG = {
    // 媒体根目录（相对 index.html，可写成 'media' 或 '../demo_final'）
    MEDIA_ROOT: 'demo_final',

    // 媒体扩展名：'.mp4' = 视频模式（滑杆 + 同步播放）
    //              '.png' / '.jpg' = 图片模式（自动改用 img-comparison-slider）
    EXT: '.mp4',

    // 原始像素宽度：所有视频都是 256，页面绝不放大超过这个值
    NATIVE_WIDTH: 256,

    // 封面图（可留 null）：例如 (src) => src.replace(/\.mp4$/, '.jpg')
    POSTER: null,
  };

  /* ---------------------------------------------------------------------
   * 2) 四类天气（folder = demo_final 里各方法目录下的真实目录名；
   *               scene  = input_videos/weather/ 下输入视频的文件名后缀，两者可能不同）
   * ------------------------------------------------------------------- */
  const CATEGORIES = [
    { id: 'rain',      label: 'Rain',      folder: 'Rain',      scene: 'Rain',      desc: '雨天退化场景' },
    { id: 'snow',      label: 'Snow',      folder: 'Snow',      scene: 'Snow',      desc: '雪天退化场景' },
    { id: 'fog',       label: 'Fog',       folder: 'Foggy',     scene: 'Fog',       desc: '雾天退化场景' },
    { id: 'sandstorm', label: 'Sandstorm', folder: 'SandStorm', scene: 'SandStorm', desc: '沙尘退化场景' },
  ];

  /* ---------------------------------------------------------------------
   * 3) 对比方法 = Part 2 用到的 6 种 baseline
   *    每一排的排布在 options.part2.rows 里配置
   * ------------------------------------------------------------------- */
  const METHODS = [
    { key: 'AdaIR',          label: 'AdaIR' },
    { key: 'DOD',            label: 'DOD' },
    { key: 'MoCE-IR',        label: 'MoCE-IR' },
    { key: 'PromptIR',       label: 'PromptIR' },
    { key: 'ReSplat',        label: 'ReSplat' },
    { key: 'WeatherRemover', label: 'WeatherRemover' },
  ];

  /* ---------------------------------------------------------------------
   * 4) 场景清单：四类天气各 3 个场景 = 12 个案例
   *    每类天气内部按 强度 从强到弱排列（heavy → medium → light），
   *    页面就是"一行三个场景、从左到右 heavy / medium / light"
   *    新增场景：在这里加一行，再按命名规则把文件放进对应目录即可
   * ------------------------------------------------------------------- */
  const CASES = [
    // Rain（3）
    { weather: 'rain', scene: 'RedHouse',     intensity: 'heavy',  view: 'view_high' },
    { weather: 'rain', scene: 'GrassFlower',  intensity: 'medium', view: 'view_low' },
    { weather: 'rain', scene: 'TrainStation', intensity: 'light',  view: 'view_high' },
    // Snow（3）
    { weather: 'snow', scene: 'GrassFlower',  intensity: 'heavy',  view: 'view_high' },
    { weather: 'snow', scene: 'RedHouse',     intensity: 'medium', view: 'view_low' },
    { weather: 'snow', scene: 'TrainStation', intensity: 'light',  view: 'view_high' },
    // Fog（3）
    { weather: 'fog', scene: 'RedHouse',      intensity: 'heavy',  view: 'view_low' },
    { weather: 'fog', scene: 'GrassFlower',   intensity: 'medium', view: 'view_high' },
    { weather: 'fog', scene: 'TrainStation',  intensity: 'light',  view: 'view_high' },
    // Sandstorm（3）
    { weather: 'sandstorm', scene: 'GrassFlower',  intensity: 'heavy',  view: 'view_high' },
    { weather: 'sandstorm', scene: 'TrainStation', intensity: 'medium', view: 'view_middle' },
    { weather: 'sandstorm', scene: 'RedHouse',     intensity: 'light',  view: 'view_low' },
  ];

  /* ---------------------------------------------------------------------
   * 5) 拼路径（想换命名规则，只改这几个函数）
   * ------------------------------------------------------------------- */
  const cat = (id) => CATEGORIES.find((c) => c.id === id);
  const join = (...parts) => parts.filter(Boolean).join('/');
  const fileName = (c, folder) => `${folder}_${c.scene}_${c.intensity}_${c.view}${CONFIG.EXT}`;

  // Part 0：四类天气的场景视频（用 scene 而不是 folder：雾天的文件名是 input_Fog，目录却是 Foggy）
  const pathScene = (w) => join(CONFIG.MEDIA_ROOT, 'input_videos', 'weather', `input_${w.scene}${CONFIG.EXT}`);
  // Part 1：基线 VolSplat 与 本方法 Ours
  const pathVolsplat = (c) => join(CONFIG.MEDIA_ROOT, 'volsplat', cat(c.weather).folder, fileName(c, cat(c.weather).folder));
  const pathOurs     = (c) => join(CONFIG.MEDIA_ROOT, 'ours', cat(c.weather).folder, fileName(c, cat(c.weather).folder));
  // Part 2：GT 与 6 种对比方法
  const pathGT     = (c) => join(CONFIG.MEDIA_ROOT, 'gt', cat(c.weather).folder, fileName(c, cat(c.weather).folder));
  const pathMethod = (m, c) => join(CONFIG.MEDIA_ROOT, 'compare', m.key, cat(c.weather).folder, fileName(c, cat(c.weather).folder));
  const posterOf   = (src) => (typeof CONFIG.POSTER === 'function' ? CONFIG.POSTER(src) : null);

  // 按扩展名自动判断媒体类型：视频走同步播放/滑杆，图片走 img-comparison-slider
  const typeOf = (src) => (/\.(mp4|webm|mov|m4v)(\?|#|$)/i.test(src) ? 'video' : 'image');
  const media = (key, label, src, role) => ({
    key,
    label,
    src,
    role, // ours | gt | method | scene
    type: typeOf(src),
    poster: posterOf(src),
    native: CONFIG.NATIVE_WIDTH,
  });

  /* ---------------------------------------------------------------------
   * 6) Part 2 数据：每个案例含 6 种对比方法 + Ours + GT
   * ------------------------------------------------------------------- */
  const buildCase = (c) => {
    const w = cat(c.weather);
    const items = [];
    METHODS.forEach((m) => items.push(media(m.key, m.label, pathMethod(m, c), 'method')));
    items.push(media('Ours', 'Ours', pathOurs(c), 'ours'));
    items.push(media('GT', 'GT', pathGT(c), 'gt'));
    return {
      id: `${c.weather}-${c.scene}-${c.intensity}-${c.view}`,
      // 标题只到"强度"为止，不显示视角（high / low / middle），与 Part 1 保持一致
      title: `${c.scene} · ${c.intensity}`,
      weather: w.label,
      scene: c.scene,
      intensity: c.intensity,
      view: c.view,
      tags: [w.label, c.scene, c.intensity, c.view],
      volsplat: pathVolsplat(c),
      ours: pathOurs(c),
      gt: pathGT(c),
      media: items,
    };
  };

  const part2Categories = CATEGORIES.map((w) => ({
    id: w.id,
    label: w.label,
    desc: w.desc,
    folder: w.folder,
    cases: CASES.filter((c) => c.weather === w.id).map(buildCase),
  }));

  /* ---------------------------------------------------------------------
   * 7) Part 0 数据：四类天气场景各一段视频（横向一行展示）
   * ------------------------------------------------------------------- */
  const part0Items = CATEGORIES.map((w) => ({
    id: w.id,
    label: w.label,
    media: media(w.id, w.label, pathScene(w), 'scene'),
  }));

  /* ---------------------------------------------------------------------
   * 8) Part 1 数据：本方法的视频滑杆对比（VolSplat ←→ Ours）
   *    include: 只展示哪些案例；留空数组 = 全部展示
   * ------------------------------------------------------------------- */
  const allCases = part2Categories.flatMap((w) => w.cases.map((c) => ({ ...c, weatherLabel: w.label })));
  const PART1_INCLUDE = []; // 例：['rain-RedHouse-heavy-view_high', 'fog-TrainStation-light-view_high']

  const part1Items = allCases
    .filter((c) => PART1_INCLUDE.length === 0 || PART1_INCLUDE.includes(c.id))
    .map((c) => ({
      id: c.id,
      group: c.weatherLabel,
      // 标题只到"强度"为止，不显示视角（high / low / middle）
      title: `${c.weatherLabel} · ${c.scene} · ${c.intensity}`,
      tags: c.tags,
      note: '',
      first: media('VolSplat', 'VolSplat', c.volsplat, 'volsplat'),
      second: media('Ours', 'Ours', c.ours, 'ours'),
    }));

  /* ---------------------------------------------------------------------
   * 9) 导出（页面只读这几个字段）
   * ------------------------------------------------------------------- */
  return {
    config: CONFIG,
    labels: { volsplat: 'VolSplat', ours: 'Ours', gt: 'GT' },
    methods: METHODS,

    meta: {
      title: 'WaraSplat',
    },

    options: {
      part0: {
        columns: 4,      // 一行展示几个场景视频（宽屏 4 个）
      },
      part1: {
        layout: 'triple',      // 'triple' = 一行最多 3 个；'double' = 一行最多 2 个
        scale: 1,              // 显示比例：1 = 原始 256×256（不要改成非整数，会失真）
        autoplay: true,        // 进入视口自动播放（静音，符合浏览器策略）
        loop: true,            // 循环播放
        divider: 50,           // 滑杆初始位置（百分比）
        showTitles: true,      // 是否显示每个案例的标题
      },
      part2: {
        // 6 种对比方法按 2 : 2 : 2 分成三排；每排 = 2 种方法 + Ours + GT
        // 想改分组/顺序，只改这里：数组里写方法 key，每排一行
        rows: [
          ['AdaIR', 'DOD'],
          ['MoCE-IR', 'PromptIR'],
          ['ReSplat', 'WeatherRemover'],
        ],
        // 每一排末尾固定跟着的两路（顺序 = 从左到右）：先 Ours，最后 GT
        tail: ['Ours', 'GT'],
        minGap: 2,             // 相邻两块画面之间允许的最小宽度（百分比，越小越灵活）
        autoplay: true,        // 进入视口自动播放（静音）
        loop: true,            // 循环播放
      },
    },

    part0: {
      title: '3D Scenes under Adverse Weather',
      items: part0Items,
    },

    part1: {
      title: 'Our Feed-Forward GS Results under Four Adverse Weather Conditions',
      items: part1Items,
    },

    part2: {
      title: 'Comparison with State-of-the-Art Methods',
      categories: part2Categories,
    },
  };
})();
