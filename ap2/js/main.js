// js/main.js —— 程序入口：初始化 GL、驱动渲染循环、接线 UI 与输入
//
// 分层调用关系：
//   main
//    ├─ Hierarchy.build(time, params)   纯数学：算出所有模型矩阵
//    ├─ Camera.update / view / projection  纯数学：观察与投影
//    ├─ Renderer.beginFrame / draw...    纯 GL：上传 uniform 与 drawArrays
//    ├─ UI / Input                       只回调状态，不直接改 GL

(function () {
  'use strict';

  var canvas = document.getElementById('glCanvas');
  var gl = initWebGL(canvas);
  if (!gl) return;

  var cfg = window.Config;
  if (!Renderer.init(gl)) return;

  // ==================== 面板状态 ====================
  var params = {
    orbitSpeed: cfg.DEFAULTS.orbitSpeed,
    spinSpeed: cfg.DEFAULTS.spinSpeed,
    earthTilt: cfg.DEFAULTS.earthTilt,
    moonInclination: cfg.DEFAULTS.moonInclination,
    showOrbits: cfg.DEFAULTS.showOrbits,
    showBelt: cfg.DEFAULTS.showBelt
  };

  // ==================== 自适应画布（含 HiDPI） ====================
  var viewSize = { w: 1, h: 1 };

  function resize() {
    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    var w = Math.max(1, Math.round(canvas.clientWidth * dpr));
    var h = Math.max(1, Math.round(canvas.clientHeight * dpr));
    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w;
      canvas.height = h;
    }
    viewSize.w = w;
    viewSize.h = h;
  }

  // ==================== 渲染循环 ====================
  var lastTime = null;
  var simTime = 0;

  function render(now) {
    if (lastTime === null) lastTime = now;
    var dt = Math.min((now - lastTime) / 1000, 0.1);  // 切后台回来时避免时间跳变
    lastTime = now;
    simTime += dt;

    // 1) 场景矩阵 + 相机姿态
    var scene = Hierarchy.build(simTime, params);
    Camera.update(dt, scene.earthPos);

    // 2) 视图 / 投影
    resize();
    var viewData = Camera.view();
    var projMat = Camera.projection(viewSize.w / viewSize.h);

    // 3) 清屏
    gl.viewport(0, 0, viewSize.w, viewSize.h);
    gl.clearColor(0.006, 0.007, 0.014, 1.0);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    gl.enable(gl.DEPTH_TEST);

    Renderer.beginFrame(viewData, projMat);

    // 4) 星空背景：全屏方片，逐像素反查等距柱状星图（透视与正交一致，只铺底不写深度）
    gl.depthMask(false);
    Renderer.drawSky(
      Camera.basis(),
      viewSize.w / viewSize.h,
      Math.tan(radians(Camera.state.fov) / 2),
      cfg.SKY.exposure
    );
    gl.depthMask(true);

    // 5) 太阳与行星、月球
    Renderer.drawBody(scene.sun.model, 'sun', { unlit: true, fallbackColor: cfg.SUN.fallbackColor });

    scene.planets.forEach(function (body) {
      Renderer.drawBody(body.model, body.cfg.key, { fallbackColor: body.cfg.fallbackColor });
    });

    Renderer.drawBody(scene.moon.model, 'moon', { fallbackColor: scene.moon.cfg.fallbackColor });

    // 6) 土星环：半透明、双面受光；关闭深度写入避免环边缘互相遮挡
    var saturn = null;
    scene.planets.forEach(function (body) {
      if (body.ringModel) saturn = body;
    });
    if (saturn) {
      gl.enable(gl.BLEND);
      gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
      gl.depthMask(false);
      Renderer.drawBody(saturn.ringModel, 'ring', {
        ring: true, twoSided: true, unlit: true, fallbackColor: [0.78, 0.72, 0.58]
      });
      gl.depthMask(true);
    }

    // 7) 轨道线：半透明线段
    if (params.showOrbits) {
      gl.enable(gl.BLEND);
      gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
      gl.depthMask(false);

      scene.planets.forEach(function (body) {
        var color = (body.cfg.key === 'earth')
          ? [0.45, 0.68, 1.0, 0.55]
          : [0.36, 0.50, 0.82, 0.34];
        Renderer.drawOrbit(body.orbitLineModel, color);
      });

      // 月球轨道线经过手写倾角矩阵，能直观看到轨道面被抬起
      Renderer.drawOrbit(scene.moonOrbitLineModel, [0.92, 0.78, 0.46, 0.6]);
      gl.depthMask(true);
    }

    // 8) 小行星带
    if (params.showBelt) {
      gl.enable(gl.BLEND);
      Renderer.drawBelt(scene.beltModel, [0.70, 0.64, 0.56, 0.62], cfg.BELT.pointSize);
    }

    gl.disable(gl.BLEND);
    requestAnimationFrame(render);
  }

  // ==================== 相机控制入口 ====================
  function syncTourButton() {
    UI.syncTour(Camera.isTouring(), Camera.isTourPaused());
  }

  function onTourButton() {
    if (!Camera.isTouring()) {
      Camera.startTour();
    } else {
      Camera.togglePause();
    }
    syncTourButton();
  }

  function onProjectionToggle() {
    UI.syncProjection(Camera.toggleProjection());
  }

  Input.init(canvas, {
    onDrag: function (x0, y0, x1, y1) {
      Camera.trackballDrag(x0, y0, x1, y1);  // 拖拽即接管漫游
      syncTourButton();
    },
    onZoom: function (factor) {
      Camera.zoom(factor);
      syncTourButton();
    },
    onKey: function (key) {
      var k = key.toLowerCase();
      if (k === 'o') {
        onProjectionToggle();
      } else if (key === ' ') {
        onTourButton();          // 空格：暂停 / 继续（被接管后则重新开启漫游）
      } else if (k === 't') {
        Camera.startTour();      // T：从头重播漫游路径
        syncTourButton();
      }
    }
  });

  // ==================== 面板接线 ====================
  UI.init({
    onOrbitSpeed: function (v) { params.orbitSpeed = v; },
    onSpinSpeed: function (v) { params.spinSpeed = v; },
    onEarthTilt: function (v) { params.earthTilt = v; },
    onMoonInclination: function (v) { params.moonInclination = v; },
    onShowOrbits: function (v) { params.showOrbits = v; },
    onShowBelt: function (v) { params.showBelt = v; },
    onTourButton: onTourButton,
    onProjectionButton: onProjectionToggle
  });

  UI.syncProjection(Camera.state.projMode);
  syncTourButton();

  resize();
  requestAnimationFrame(render);
})();
