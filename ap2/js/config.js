// js/config.js —— 天体参数与场景常量集中配置
// 评分点"天体参数集中配置，便于调整"全部收敛在本文件。
//
// ── 尺寸 ────────────────────────────────────────────────────────────────
// 长度单位：场景单位（非真实比例，按视觉可读性压缩）。
// 半径 / 轨道半径 / 月球距离都以"地球半径 = 1"为直觉基准做近似。
//
// ── 时间 ────────────────────────────────────────────────────────────────
// 真实周期之间相差 3 个数量级（水星 0.24 年 vs 海王星 164.8 年），
// 直接按同一时钟播放会让外侧行星几乎静止。因此：
//   1. 保留真实周期 realOrbitYears / realSpinDays 作为数据源；
//   2. 显示周期 = 基准时长 × (真实周期)^periodPower（periodPower < 1 压缩差距）；
//   3. 公转与自转使用两套独立基准时长，只为"看得见"，并非同一物理时钟。
// README 中会明确说明这一点，避免把可视化参数误当成真实天文数据。

window.Config = (function () {
  'use strict';

  // 时间压缩：地球公转 30 s / 地球自转 3 s（速度倍率 = 1）
  var TIME = {
    earthOrbitSeconds: 30.0,
    earthDaySeconds: 3.0,
    periodPower: 0.45
  };

  function orbitSeconds(realYears) {
    return TIME.earthOrbitSeconds * Math.pow(realYears, TIME.periodPower);
  }

  // realDays 为负表示逆行自转（金星、天王星）
  function spinSeconds(realDays) {
    var s = TIME.earthDaySeconds * Math.pow(Math.abs(realDays), TIME.periodPower);
    return realDays < 0 ? -s : s;
  }

  // ==================== 太阳 ====================
  var SUN = {
    key: 'sun',
    name: '太阳',
    radius: 4.5,
    realSpinDays: 25.4,
    spinSeconds: spinSeconds(25.4),
    texture: 'textures/sunmap.jpg',
    fallbackColor: [1.0, 0.86, 0.45]
  };

  // ==================== 行星 ====================
  // phase：初始公转相位（度），避免所有行星开局连成一条直线。
  // tilt：自转轴相对轨道面法线的倾角（度），地球默认可被面板滑条覆盖。
  var PLANETS = [
    {
      key: 'mercury', name: '水星', radius: 0.50, distance: 11.0,
      realOrbitYears: 0.241, realSpinDays: 58.6, tilt: 0.03, phase: 40,
      texture: 'textures/mercurymap.jpg', fallbackColor: [0.62, 0.58, 0.55],
      orbitSeconds: orbitSeconds(0.241), spinSeconds: spinSeconds(58.6)
    },
    {
      key: 'venus', name: '金星', radius: 0.90, distance: 15.5,
      realOrbitYears: 0.615, realSpinDays: -243.0, tilt: 177.4, phase: 130,
      texture: 'textures/venusmap.jpg', fallbackColor: [0.90, 0.78, 0.55],
      orbitSeconds: orbitSeconds(0.615), spinSeconds: spinSeconds(-243.0)
    },
    {
      key: 'earth', name: '地球', radius: 1.00, distance: 21.0,
      realOrbitYears: 1.000, realSpinDays: 1.0, tilt: 23.5, phase: 220,
      texture: 'textures/earthmap1k.jpg', fallbackColor: [0.30, 0.50, 0.85],
      orbitSeconds: orbitSeconds(1.0), spinSeconds: spinSeconds(1.0)
    },
    {
      key: 'mars', name: '火星', radius: 0.60, distance: 27.0,
      realOrbitYears: 1.881, realSpinDays: 1.026, tilt: 25.2, phase: 300,
      texture: 'textures/marsmap1k.jpg', fallbackColor: [0.80, 0.45, 0.30],
      orbitSeconds: orbitSeconds(1.881), spinSeconds: spinSeconds(1.026)
    },
    {
      key: 'jupiter', name: '木星', radius: 2.80, distance: 37.0,
      realOrbitYears: 11.86, realSpinDays: 0.414, tilt: 3.1, phase: 75,
      texture: 'textures/jupitermap.jpg', fallbackColor: [0.80, 0.70, 0.55],
      orbitSeconds: orbitSeconds(11.86), spinSeconds: spinSeconds(0.414)
    },
    {
      key: 'saturn', name: '土星', radius: 2.30, distance: 49.0,
      realOrbitYears: 29.46, realSpinDays: 0.444, tilt: 26.7, phase: 165,
      texture: 'textures/saturnmap.jpg', fallbackColor: [0.85, 0.78, 0.60],
      orbitSeconds: orbitSeconds(29.46), spinSeconds: spinSeconds(0.444),
      // 环半径以"行星半径"为单位；环几何按此单位生成，再随行星缩放
      ring: { inner: 1.28, outer: 2.32, texture: 'textures/saturnring.png' }
    },
    {
      key: 'uranus', name: '天王星', radius: 1.50, distance: 60.0,
      realOrbitYears: 84.01, realSpinDays: -0.718, tilt: 97.8, phase: 250,
      texture: 'textures/uranusmap.jpg', fallbackColor: [0.55, 0.80, 0.85],
      orbitSeconds: orbitSeconds(84.01), spinSeconds: spinSeconds(-0.718)
    },
    {
      key: 'neptune', name: '海王星', radius: 1.45, distance: 70.0,
      realOrbitYears: 164.8, realSpinDays: 0.671, tilt: 28.3, phase: 20,
      texture: 'textures/neptunemap.jpg', fallbackColor: [0.35, 0.45, 0.85],
      orbitSeconds: orbitSeconds(164.8), spinSeconds: spinSeconds(0.671)
    }
  ];

  var EARTH_INDEX = 2;

  // ==================== 月球 ====================
  var MOON = {
    key: 'moon', name: '月球',
    radius: 0.27,
    distance: 3.2,
    realOrbitYears: 0.0748,          // 27.32 天
    orbitSeconds: orbitSeconds(0.0748),
    tidallyLocked: true,             // 潮汐锁定：自转周期 = 公转周期
    texture: 'textures/moonmap1k.jpg',
    fallbackColor: [0.75, 0.75, 0.72]
  };

  // 月球轨道面相对黄道面的倾角（真实值约 5.1°）。
  // 该倾角由"手写矩阵"施加，见 js/hierarchy.js 的 manualRotateX()。
  var MOON_ORBIT_INCLINATION = 5.1;

  // ==================== 小行星带 ====================
  // 位于火星（27）与木星（37）轨道之间；点位确定性随机生成，刷新不变。
  var BELT = {
    count: 2200,
    rMin: 29.5,
    rMax: 34.0,
    ySpread: 1.1,
    realOrbitYears: 4.6,
    orbitSeconds: orbitSeconds(4.6),
    pointSize: 2.0
  };

  // ==================== 背景 ====================
  // 星空用等距柱状星图做全屏背景（见 js/shaders.js 的 sky 程序），
  // 不再依赖"半径多大的球"，透视与正交下星点尺寸一致。
  var SKY = {
    texture: 'textures/starfield.png',
    exposure: 1.2
  };

  // ==================== 相机漫游关键帧 ====================
  // t：时刻（秒），az：绕世界 Y 轴的方位角（度），el：仰角（度），
  // dist：相机到注视点距离，target：'sun'（原点）或 'earth'（跟随地球）。
  // 首尾关键帧方位角相差 720°，保证循环播放时方位连续、无跳变。
  var TOUR = {
    keys: [
      { t: 0,  az: 20,  el: 26, dist: 108, target: 'sun' },
      { t: 10, az: 200, el: 8,  dist: 88,  target: 'sun' },
      { t: 20, az: 330, el: 16, dist: 34,  target: 'earth' },
      { t: 31, az: 430, el: 6,  dist: 18,  target: 'earth' },
      { t: 44, az: 560, el: 40, dist: 92,  target: 'sun' },
      { t: 56, az: 740, el: 26, dist: 108, target: 'sun' }
    ]
  };

  // ==================== 面板默认值 ====================
  var DEFAULTS = {
    orbitSpeed: 1.0,
    spinSpeed: 1.0,
    earthTilt: 23.5,
    moonInclination: MOON_ORBIT_INCLINATION,
    showOrbits: true,
    showBelt: true
  };

  return {
    TIME: TIME,
    SUN: SUN,
    PLANETS: PLANETS,
    EARTH_INDEX: EARTH_INDEX,
    MOON: MOON,
    MOON_ORBIT_INCLINATION: MOON_ORBIT_INCLINATION,
    BELT: BELT,
    SKY: SKY,
    TOUR: TOUR,
    DEFAULTS: DEFAULTS
  };
})();
