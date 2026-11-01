// js/geometry.js —— 几何数据生成（只产出 Float32Array，不接触 GL）
//
// 顶点布局约定：
//   球体 / 圆环：8 float 交错 —— [px py pz | nx ny nz | u v]
//   轨道线     ：4 float 交错 —— [px py pz | shade]
//   小行星带   ：4 float 交错 —— [px py pz | shade]
// 交错布局让一次 drawArrays 就能同时供给位置、法线、UV，避免多 VBO。

window.Geometry = (function () {
  'use strict';

  var TWO_PI = Math.PI * 2;

  // ---------- 经纬细分球体（单位半径，圆心在原点） ----------
  // 参数：latBands 纬度分段，lonBands 经度分段。
  // 三角形数 = latBands * lonBands * 2，顶点数 = 三角形数 * 3。
  //
  // UV 约定：u 随经度 0→1（接缝在 +X 轴），v 随纬度 0→1（v=0 南极，v=1 北极）。
  // 配合 Textures 里的 UNPACK_FLIP_Y_WEBGL，v=0 对应图像最底下一行，
  // 因此等距柱状投影的星图不会上下颠倒。
  function sphere(latBands, lonBands) {
    var data = [];

    function vertex(theta, phi) {
      var x = Math.cos(theta) * Math.cos(phi);
      var y = Math.sin(theta);
      var z = Math.cos(theta) * Math.sin(phi);
      data.push(
        x, y, z,                       // 位置
        x, y, z,                       // 法线：单位球上法线 = 位置
        phi / TWO_PI,                  // u
        (theta + Math.PI / 2) / Math.PI // v
      );
    }

    for (var lat = 0; lat < latBands; lat++) {
      var t1 = (lat / latBands) * Math.PI - Math.PI / 2;
      var t2 = ((lat + 1) / latBands) * Math.PI - Math.PI / 2;

      for (var lon = 0; lon < lonBands; lon++) {
        var p1 = (lon / lonBands) * TWO_PI;
        var p2 = ((lon + 1) / lonBands) * TWO_PI;

        // 逆时针环绕（从球外看为正面），便于将来开启背面剔除
        vertex(t1, p1); vertex(t2, p2); vertex(t1, p2);
        vertex(t1, p1); vertex(t2, p1); vertex(t2, p2);
      }
    }
    return new Float32Array(data);
  }

  // ---------- 平面圆环（土星环） ----------
  // 位于 xz 平面，法线 +Y；inner / outer 以"行星半径"为单位。
  // UV：u = 径向比例（0 内圈 → 1 外圈），对应贴图的横向条纹；
  //     v = 圆周比例（沿环一周 0→1）。
  function annulus(inner, outer, segments) {
    var data = [];

    function point(radius, angle) {
      var x = radius * Math.cos(angle);
      var z = radius * Math.sin(angle);
      data.push(
        x, 0, z,
        0, 1, 0,
        (radius - inner) / (outer - inner),
        angle / TWO_PI
      );
    }

    for (var i = 0; i < segments; i++) {
      var a1 = (i / segments) * TWO_PI;
      var a2 = ((i + 1) / segments) * TWO_PI;
      point(inner, a1); point(outer, a2); point(outer, a1);
      point(inner, a1); point(inner, a2); point(outer, a2);
    }
    return new Float32Array(data);
  }

  // ---------- 单位圆线段（轨道线） ----------
  // xz 平面上半径 1 的圆，gl.LINES 顶点对；模型矩阵缩放到任意轨道半径。
  // shade 恒为 1，使轨道线与小行星带共用同一套顶点布局。
  function circleLine(segments) {
    var data = [];
    for (var i = 0; i < segments; i++) {
      var a1 = (i / segments) * TWO_PI;
      var a2 = ((i + 1) / segments) * TWO_PI;
      data.push(
        Math.cos(a1), 0, Math.sin(a1), 1,
        Math.cos(a2), 0, Math.sin(a2), 1
      );
    }
    return new Float32Array(data);
  }

  // ---------- 全屏方片（星空背景） ----------
  // 顶点位置直接写在 NDC 上（-1..1，z=0），顶点着色器不再做任何变换。
  // 星空不再用"半径 500 的球"，因为正交投影没有近大远小：
  // 球面上的星点会被当成几十像素大的光斑。改成屏幕方片后，
  // 每个像素按相机朝向反算世界方向、再去查等距柱状星图，
  // 透视与正交下星点尺寸一致，且随相机转动而正确移动。
  function screenQuad() {
    return new Float32Array([
      -1, -1, 0, 1, -1, 0, 1, 1, 0,
      -1, -1, 0, 1, 1, 0, -1, 1, 0
    ]);
  }

  // ---------- 小行星带 ----------
  // 在 rMin..rMax 环带内随机撒点，y 方向加一点厚度。
  // mulberry32：确定性伪随机，保证每次刷新形态一致、便于截图对照。
  function asteroidBelt(count, rMin, rMax, ySpread, seed) {
    var data = new Float32Array(count * 4);
    var s = seed >>> 0;

    function rand() {
      s |= 0; s = (s + 0x6D2B79F5) | 0;
      var t = Math.imul(s ^ (s >>> 15), 1 | s);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    }

    for (var i = 0; i < count; i++) {
      var r = rMin + (rMax - rMin) * rand();
      var a = rand() * TWO_PI;
      data[i * 4] = r * Math.cos(a);
      data[i * 4 + 1] = (rand() * 2 - 1) * ySpread;
      data[i * 4 + 2] = r * Math.sin(a);
      data[i * 4 + 3] = 0.55 + 0.45 * rand();  // 明暗随机
    }
    return data;
  }

  return {
    sphere: sphere,
    annulus: annulus,
    circleLine: circleLine,
    asteroidBelt: asteroidBelt,
    screenQuad: screenQuad,
    FLOATS_PER_VERTEX: 8,
    FLOATS_PER_FLAT_VERTEX: 4
  };
})();
