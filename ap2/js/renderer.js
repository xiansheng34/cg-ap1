// js/renderer.js —— GL 资源与绘制流程
//
// 职责边界：几何数据在 geometry.js 生成，层级矩阵在 hierarchy.js 计算，
// 本文件只负责把数据传到 GPU 并按正确顺序发起 drawArrays。
//
// 每帧绘制顺序：
//   1. 星空背景（全屏方片，不写深度）
//   2. 太阳（自发光）→ 行星 → 月球（写深度）
//   3. 土星环（半透明 + 双面，关闭深度写入）
//   4. 轨道线（半透明线段）
//   5. 小行星带（点精灵）

window.Renderer = (function () {
  'use strict';

  var gl = null;
  var bodyProg = null;
  var flatProg = null;
  var skyProg = null;

  var bodyU = {};
  var flatU = {};
  var skyU = {};

  var sphereVAO = null;
  var ringVAO = null;
  var circleVAO = null;
  var beltVAO = null;
  var skyVAO = null;

  var counts = { sphere: 0, ring: 0, circle: 0, belt: 0, sky: 0 };
  var textures = {};   // key → { tex, ok }

  var ATTRIB_STRIDE = 8 * 4;       // 8 floats × 4 bytes
  var FLAT_STRIDE = 4 * 4;         // 4 floats × 4 bytes

  var SPHERE_LAT = 40;
  var SPHERE_LON = 64;

  // ---------- 初始化 ----------
  function init(_gl) {
    gl = _gl;
    var cfg = window.Config;

    bodyProg = initShaders(gl, Shaders.bodyVS, Shaders.bodyFS);
    flatProg = initShaders(gl, Shaders.flatVS, Shaders.flatFS);
    skyProg = initShaders(gl, Shaders.skyVS, Shaders.skyFS);
    if (!bodyProg || !flatProg || !skyProg) return false;

    cacheLocations();

    // ---- 几何与缓冲区 ----
    var sphereData = Geometry.sphere(SPHERE_LAT, SPHERE_LON);
    counts.sphere = sphereData.length / 8;
    var sphereBuf = createBuffer(sphereData);

    var saturn = cfg.PLANETS[5];
    var ringData = Geometry.annulus(saturn.ring.inner, saturn.ring.outer, 128);
    counts.ring = ringData.length / 8;
    var ringBuf = createBuffer(ringData);

    var circleData = Geometry.circleLine(160);
    counts.circle = circleData.length / 4;
    var circleBuf = createBuffer(circleData);

    var beltData = Geometry.asteroidBelt(
      cfg.BELT.count, cfg.BELT.rMin, cfg.BELT.rMax, cfg.BELT.ySpread, 2024);
    counts.belt = beltData.length / 4;
    var beltBuf = createBuffer(beltData);

    var quadBuf = createBuffer(Geometry.screenQuad());
    counts.sky = 6;

    // ---- VAO：把属性指针与缓冲区绑定一次性固化，绘制时只 bindVertexArray ----
    sphereVAO = makeVAO(bodyProg, sphereBuf, [
      { name: 'aPosition', size: 3, offset: 0, stride: ATTRIB_STRIDE },
      { name: 'aNormal', size: 3, offset: 12, stride: ATTRIB_STRIDE },
      { name: 'aTexCoord', size: 2, offset: 24, stride: ATTRIB_STRIDE }
    ]);

    ringVAO = makeVAO(bodyProg, ringBuf, [
      { name: 'aPosition', size: 3, offset: 0, stride: ATTRIB_STRIDE },
      { name: 'aNormal', size: 3, offset: 12, stride: ATTRIB_STRIDE },
      { name: 'aTexCoord', size: 2, offset: 24, stride: ATTRIB_STRIDE }
    ]);

    circleVAO = makeVAO(flatProg, circleBuf, [
      { name: 'aPosition', size: 3, offset: 0, stride: FLAT_STRIDE },
      { name: 'aShade', size: 1, offset: 12, stride: FLAT_STRIDE }
    ]);

    beltVAO = makeVAO(flatProg, beltBuf, [
      { name: 'aPosition', size: 3, offset: 0, stride: FLAT_STRIDE },
      { name: 'aShade', size: 1, offset: 12, stride: FLAT_STRIDE }
    ]);

    skyVAO = makeVAO(skyProg, quadBuf, [
      { name: 'aPosition', size: 3, offset: 0, stride: 3 * 4 }
    ]);

    // ---- 纹理 ----
    loadTexture(cfg.SUN.key, cfg.SUN.texture);
    cfg.PLANETS.forEach(function (p) { loadTexture(p.key, p.texture); });
    loadTexture(cfg.MOON.key, cfg.MOON.texture);
    loadTexture('ring', cfg.PLANETS[5].ring.texture);
    loadTexture('stars', cfg.SKY.texture);

    return true;
  }

  function cacheLocations() {
    var bu = ['uModel', 'uView', 'uProj', 'uNormalMatrix', 'uTexture', 'uTint',
      'uEyePos', 'uLightPos', 'uAmbient', 'uDiffuse', 'uSpecular',
      'uUnlit', 'uTwoSided', 'uAlpha'];
    bu.forEach(function (n) { bodyU[n] = gl.getUniformLocation(bodyProg, n); });

    var fu = ['uModel', 'uView', 'uProj', 'uColor', 'uPointSize', 'uIsPoint'];
    fu.forEach(function (n) { flatU[n] = gl.getUniformLocation(flatProg, n); });

    var su = ['uTexture', 'uRight', 'uUp', 'uBack', 'uTanHalf', 'uAspect', 'uExposure'];
    su.forEach(function (n) { skyU[n] = gl.getUniformLocation(skyProg, n); });
  }

  function createBuffer(data) {
    var buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, data, gl.STATIC_DRAW);
    return buf;
  }

  function makeVAO(prog, buffer, attrs) {
    var vao = gl.createVertexArray();
    gl.bindVertexArray(vao);
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    attrs.forEach(function (a) {
      var loc = gl.getAttribLocation(prog, a.name);
      if (loc < 0) return;
      gl.enableVertexAttribArray(loc);
      gl.vertexAttribPointer(loc, a.size, gl.FLOAT, false, a.stride, a.offset);
    });
    gl.bindVertexArray(null);
    return vao;
  }

  function loadTexture(key, url) {
    textures[key] = { tex: null, ok: false };
    textures[key].tex = Textures.load(gl, url, function (ok) {
      textures[key].ok = ok;
    });
  }

  function textureEntry(key) {
    return textures[key] || { tex: null, ok: false };
  }

  // ---------- 每帧公共 uniform ----------
  function beginFrame(viewData, projMat) {
    // body 程序：视图 / 投影 / 视点 / 光源（太阳位于世界原点）
    gl.useProgram(bodyProg);
    gl.uniformMatrix4fv(bodyU.uView, false, flatten(viewData.matrix));
    gl.uniformMatrix4fv(bodyU.uProj, false, flatten(projMat));
    gl.uniform3fv(bodyU.uEyePos, viewData.eye);
    gl.uniform3fv(bodyU.uLightPos, [0, 0, 0]);
    gl.uniform1i(bodyU.uTexture, 0);
    gl.uniform1f(bodyU.uAmbient, 0.22);
    gl.uniform1f(bodyU.uDiffuse, 0.85);
    gl.uniform1f(bodyU.uSpecular, 0.12);

    // flat 程序：视图 / 投影
    gl.useProgram(flatProg);
    gl.uniformMatrix4fv(flatU.uView, false, flatten(viewData.matrix));
    gl.uniformMatrix4fv(flatU.uProj, false, flatten(projMat));
  }

  // ---------- 贴图球体 / 环 ----------
  function drawBody(model, texKey, opts) {
    opts = opts || {};
    var entry = textureEntry(texKey);
    var isRing = !!opts.ring;

    gl.useProgram(bodyProg);
    gl.bindVertexArray(isRing ? ringVAO : sphereVAO);

    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, entry.tex);

    gl.uniformMatrix4fv(bodyU.uModel, false, flatten(model));
    gl.uniformMatrix3fv(bodyU.uNormalMatrix, false, normalMatrix(model));

    var tint = entry.ok ? [1, 1, 1] : (opts.fallbackColor || [0.65, 0.65, 0.65]);
    gl.uniform3fv(bodyU.uTint, tint);
    gl.uniform1f(bodyU.uUnlit, opts.unlit ? 1 : 0);
    gl.uniform1f(bodyU.uTwoSided, opts.twoSided ? 1 : 0);
    gl.uniform1f(bodyU.uAlpha, opts.alpha === undefined ? 1 : opts.alpha);

    gl.drawArrays(gl.TRIANGLES, 0, isRing ? counts.ring : counts.sphere);
  }

  // ---------- 星空背景 ----------
  // basis：相机三轴 { right, up, back }；tanHalf = tan(fov/2)，两种投影共用。
  function drawSky(basis, aspect, tanHalf, exposure) {
    var entry = textureEntry('stars');
    gl.useProgram(skyProg);
    gl.bindVertexArray(skyVAO);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, entry.tex);
    gl.uniform1i(skyU.uTexture, 0);
    gl.uniform3fv(skyU.uRight, basis.right);
    gl.uniform3fv(skyU.uUp, basis.up);
    gl.uniform3fv(skyU.uBack, basis.back);
    gl.uniform1f(skyU.uAspect, aspect);
    gl.uniform1f(skyU.uTanHalf, tanHalf);
    gl.uniform1f(skyU.uExposure, exposure);
    gl.drawArrays(gl.TRIANGLES, 0, counts.sky);
  }

  // ---------- 轨道线 ----------
  function drawOrbit(model, color) {
    gl.useProgram(flatProg);
    gl.bindVertexArray(circleVAO);
    gl.uniformMatrix4fv(flatU.uModel, false, flatten(model));
    gl.uniform4fv(flatU.uColor, color);
    gl.uniform1f(flatU.uPointSize, 1);
    gl.uniform1f(flatU.uIsPoint, 0);
    gl.drawArrays(gl.LINES, 0, counts.circle);
  }

  // ---------- 小行星带 ----------
  function drawBelt(model, color, pointSize) {
    gl.useProgram(flatProg);
    gl.bindVertexArray(beltVAO);
    gl.uniformMatrix4fv(flatU.uModel, false, flatten(model));
    gl.uniform4fv(flatU.uColor, color);
    gl.uniform1f(flatU.uPointSize, pointSize);
    gl.uniform1f(flatU.uIsPoint, 1);
    gl.drawArrays(gl.POINTS, 0, counts.belt);
  }

  return {
    init: init,
    beginFrame: beginFrame,
    drawBody: drawBody,
    drawSky: drawSky,
    drawOrbit: drawOrbit,
    drawBelt: drawBelt
  };
})();
