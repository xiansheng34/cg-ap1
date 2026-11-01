// js/camera.js —— 观察与投影：轨迹球、双投影、关键帧漫游
//
// 相机姿态用"目标系 → 世界系"的旋转矩阵 rot 表示，相机始终绕注视点 target 环绕：
//   eye = target + rot·(0, 0, dist)
//   up  = rot·(0, 1, 0)
// 这样轨迹球、漫游、缩放都只改 rot / dist / target 三个量，互不干扰。
//
// 漫游与轨迹球的"接管"规则：
//   · 漫游开启时，每帧用关键帧插值覆盖 rot / dist / target；
//   · 鼠标一拖拽，漫游立即让位（enabled=false），视角完全交给轨迹球；
//   · 按 T（或点面板按钮）重新开启漫游，从路径起点播放。

window.Camera = (function () {
  'use strict';

  var DEG = 180 / Math.PI;

  var state = {
    target: [0, 0, 0],
    dist: 108,
    rot: mult(rotateY(20), rotateX(-26)),
    projMode: 'persp',   // 'persp' 透视 | 'ortho' 正交
    fov: 45,             // 竖直视场角（度）
    near: 0.1,
    far: 3000
  };

  var tour = {
    clock: 0,
    paused: false,
    enabled: true
  };

  function smoothstep(t) { return t * t * (3 - 2 * t); }

  // 关键帧采样：az / el / dist 线性插值（带平滑），target 按类型插值
  function sampleTour(time, earthPos) {
    var keys = window.Config.TOUR.keys;
    var duration = keys[keys.length - 1].t;
    var t = time % duration;

    var i = 0;
    while (i < keys.length - 2 && keys[i + 1].t <= t) i++;

    var k0 = keys[i];
    var k1 = keys[i + 1];
    var u = smoothstep((t - k0.t) / (k1.t - k0.t));

    var p0 = (k0.target === 'earth') ? earthPos : [0, 0, 0];
    var p1 = (k1.target === 'earth') ? earthPos : [0, 0, 0];

    return {
      rot: mult(rotateY(k0.az + (k1.az - k0.az) * u), rotateX(-(k0.el + (k1.el - k0.el) * u))),
      dist: lerp(k0.dist, k1.dist, u),
      target: lerp(p0, p1, u)
    };
  }

  // 每帧调用；暂停或已被拖拽接管时保持当前姿态不动
  function update(dt, earthPos) {
    if (!tour.enabled || tour.paused) return;
    tour.clock += dt;
    var k = sampleTour(tour.clock, earthPos);
    state.rot = k.rot;
    state.dist = k.dist;
    state.target = k.target;
  }

  // ---------- 虚拟轨迹球 ----------
  // 屏幕坐标 (x,y) ∈ [-1,1]² 映射到单位半球：z = √(1 - x² - y²)，
  // 越出单位圆则投影到赤道边缘（教材 Virtual Trackball 的做法）。
  function ballPoint(x, y) {
    var d = x * x + y * y;
    if (d >= 1) {
      var len = Math.sqrt(d);
      return [x / len, y / len, 0];
    }
    return [x, y, Math.sqrt(1 - d)];
  }

  // 由鼠标位移构造"相机空间"旋转增量 R_delta，再右乘到 rot。
  // 注意这里是右乘：rot 的坐标轴本身被旋转，符合"拖动画面"的直觉。
  function trackballDrag(nx0, ny0, nx1, ny1) {
    tour.enabled = false;   // 拖拽即接管漫游

    var p0 = ballPoint(nx0, ny0);
    var p1 = ballPoint(nx1, ny1);
    var axis = cross(p0, p1);
    var sinA = Math.sqrt(dot(axis, axis));
    var cosA = dot(p0, p1);

    if (sinA < 1e-6) return;
    var angle = Math.atan2(sinA, cosA) * DEG;
    state.rot = mult(state.rot, rotate(angle * 1.6, axis));  // 1.6 为手感增益
  }

  function zoom(factor) {
    tour.enabled = false;
    state.dist = Math.min(400, Math.max(6, state.dist * factor));
  }

  // ---------- 投影 ----------
  function projection(aspect) {
    if (state.projMode === 'persp') {
      return perspective(state.fov, aspect, state.near, state.far);
    }
    // 正交：取"注视点所在平面"的视野高度 = dist·tan(fov/2)，
    // 使两种投影在 target 处具有相同取景范围，便于并排对比近大远小。
    var h = state.dist * Math.tan(radians(state.fov) / 2);
    return ortho(-h * aspect, h * aspect, -h, h, state.near, state.far);
  }

  function view() {
    var eye = add(state.target, [
      state.rot[8] * state.dist,
      state.rot[9] * state.dist,
      state.rot[10] * state.dist
    ]);
    var up = [state.rot[4], state.rot[5], state.rot[6]];
    return { eye: eye, matrix: lookAt(eye, state.target, up) };
  }

  // 相机三轴（世界系）：rot 的三列依次是右、上、后。
  // 星空背景用它把屏幕方向还原成世界方向，从而随相机转动而移动。
  function basis() {
    return {
      right: [state.rot[0], state.rot[1], state.rot[2]],
      up: [state.rot[4], state.rot[5], state.rot[6]],
      back: [state.rot[8], state.rot[9], state.rot[10]]
    };
  }

  function toggleProjection() {
    state.projMode = (state.projMode === 'persp') ? 'ortho' : 'persp';
    return state.projMode;
  }

  // ---------- 漫游控制 ----------
  function startTour() {
    tour.enabled = true;
    tour.paused = false;
    tour.clock = 0;
  }

  function togglePause() {
    if (!tour.enabled) return false;
    tour.paused = !tour.paused;
    return tour.paused;
  }

  return {
    state: state,
    update: update,
    view: view,
    basis: basis,
    projection: projection,
    trackballDrag: trackballDrag,
    zoom: zoom,
    toggleProjection: toggleProjection,
    startTour: startTour,
    togglePause: togglePause,
    isTouring: function () { return tour.enabled; },
    isTourPaused: function () { return tour.paused; }
  };
})();
