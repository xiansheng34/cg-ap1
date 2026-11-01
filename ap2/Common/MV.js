// Common/MV.js —— 教材风格矩阵 / 向量工具库（列主序，角度制）
// 与 Angel & Shreiner 教材 Common/MV.js 的函数名保持一致；
// 本文件只实现本项目用到的子集，内部公式按教材 Ch4 的齐次坐标推导书写。
//
// 存储约定：mat4 为长度 16 的数组，按"列"展开（WebGL / GLSL 的约定），
//   数组下标 = col * 4 + row。例如平移分量位于 12、13、14。

(function (global) {
  'use strict';

  function radians(degrees) { return degrees * Math.PI / 180.0; }

  // ==================== mat4 ====================

  function mat4() {
    return [
      1, 0, 0, 0,
      0, 1, 0, 0,
      0, 0, 1, 0,
      0, 0, 0, 1
    ];
  }

  // c = a * b（列主序）
  function mult(a, b) {
    var c = new Array(16);
    for (var col = 0; col < 4; col++) {
      for (var row = 0; row < 4; row++) {
        var sum = 0;
        for (var k = 0; k < 4; k++) {
          sum += a[k * 4 + row] * b[col * 4 + k];
        }
        c[col * 4 + row] = sum;
      }
    }
    return c;
  }

  function translate(x, y, z) {
    var m = mat4();
    m[12] = x;
    m[13] = y;
    m[14] = z;
    return m;
  }

  function scale(x, y, z) {
    var m = mat4();
    m[0] = x;
    m[5] = y;
    m[10] = z;
    return m;
  }

  // 绕 X / Y / Z 轴旋转（角度制）
  function rotateX(deg) {
    var r = radians(deg), c = Math.cos(r), s = Math.sin(r);
    return [
      1, 0, 0, 0,
      0, c, s, 0,
      0, -s, c, 0,
      0, 0, 0, 1
    ];
  }

  function rotateY(deg) {
    var r = radians(deg), c = Math.cos(r), s = Math.sin(r);
    return [
      c, 0, -s, 0,
      0, 1, 0, 0,
      s, 0, c, 0,
      0, 0, 0, 1
    ];
  }

  function rotateZ(deg) {
    var r = radians(deg), c = Math.cos(r), s = Math.sin(r);
    return [
      c, s, 0, 0,
      -s, c, 0, 0,
      0, 0, 1, 0,
      0, 0, 0, 1
    ];
  }

  // 绕任意轴旋转（Rodrigues 公式，角度制）
  function rotate(deg, axis) {
    var v = normalize(axis);
    var r = radians(deg), c = Math.cos(r), s = Math.sin(r), t = 1 - c;
    var x = v[0], y = v[1], z = v[2];
    return [
      t * x * x + c,     t * x * y + s * z, t * x * z - s * y, 0,
      t * x * y - s * z, t * y * y + c,     t * y * z + s * x, 0,
      t * x * z + s * y, t * y * z - s * x, t * z * z + c,     0,
      0, 0, 0, 1
    ];
  }

  function transpose(m) {
    var t = mat4();
    for (var r = 0; r < 4; r++) {
      for (var c = 0; c < 4; c++) {
        t[c * 4 + r] = m[r * 4 + c];
      }
    }
    return t;
  }

  // ==================== 观察 / 投影 ====================

  // 透视投影：fovy 竖直视场角（度）
  function perspective(fovy, aspect, near, far) {
    var f = 1.0 / Math.tan(radians(fovy) / 2);
    var nf = 1.0 / (near - far);
    return [
      f / aspect, 0, 0, 0,
      0, f, 0, 0,
      0, 0, (far + near) * nf, -1,
      0, 0, 2 * far * near * nf, 0
    ];
  }

  // 正交投影
  function ortho(left, right, bottom, top, near, far) {
    var w = 1.0 / (right - left);
    var h = 1.0 / (top - bottom);
    var d = 1.0 / (far - near);
    return [
      2 * w, 0, 0, 0,
      0, 2 * h, 0, 0,
      0, 0, -2 * d, 0,
      -(right + left) * w, -(top + bottom) * h, -(far + near) * d, 1
    ];
  }

  // 观察矩阵：eye 相机位置，at 注视点，up 上方向
  // 矩阵行视角为 [u; v; n; t]，列主序存储时每一列取三个轴的分量：
  //   第 0 列 = (u.x, v.x, n.x, 0)   ← 不能写成 (u.x, u.y, u.z, 0)
  function lookAt(eye, at, up) {
    var n = normalize(subtract(eye, at));  // 相机后方
    var u = normalize(cross(up, n));       // 相机右方
    var v = cross(n, u);                   // 相机上方
    return [
      u[0], v[0], n[0], 0,
      u[1], v[1], n[1], 0,
      u[2], v[2], n[2], 0,
      -dot(u, eye), -dot(v, eye), -dot(n, eye), 1
    ];
  }

  // ==================== vec3 ====================

  function vec3(x, y, z) { return [x, y, z]; }
  function add(a, b) { return [a[0] + b[0], a[1] + b[1], a[2] + b[2]]; }
  function subtract(a, b) { return [a[0] - b[0], a[1] - b[1], a[2] - b[2]]; }

  function cross(a, b) {
    return [
      a[1] * b[2] - a[2] * b[1],
      a[2] * b[0] - a[0] * b[2],
      a[0] * b[1] - a[1] * b[0]
    ];
  }

  function dot(a, b) { return a[0] * b[0] + a[1] * b[1] + a[2] * b[2]; }

  function normalize(v) {
    var len = Math.sqrt(v[0] * v[0] + v[1] * v[1] + v[2] * v[2]);
    if (len === 0) return [0, 0, 0];
    return [v[0] / len, v[1] / len, v[2] / len];
  }

  function lerp(a, b, t) {
    if (typeof a === 'number') return a + (b - a) * t;
    var out = [];
    for (var i = 0; i < a.length; i++) out.push(a[i] + (b[i] - a[i]) * t);
    return out;
  }

  // ==================== 传给 GL 的工具 ====================

  function flatten(v) {
    return v instanceof Float32Array ? v : new Float32Array(v);
  }

  // 法线矩阵 = 模型矩阵左上 3×3 的逆转置（这里直接写等价形式：代数余子式矩阵 / det）。
  // 本场景均为"旋转 + 等比缩放 + 平移"，逆转置与左上 3×3 相同；
  // 仍按通用公式实现，避免以后改成非等比缩放时悄无声息地出错。
  // 返回 9 元列主序 Float32Array，供 uniformMatrix3fv 使用。
  function normalMatrix(m) {
    var a = [
      [m[0], m[4], m[8]],
      [m[1], m[5], m[9]],
      [m[2], m[6], m[10]]
    ];
    var det =
      a[0][0] * (a[1][1] * a[2][2] - a[1][2] * a[2][1]) -
      a[0][1] * (a[1][0] * a[2][2] - a[1][2] * a[2][0]) +
      a[0][2] * (a[1][0] * a[2][1] - a[1][1] * a[2][0]);

    var out = new Float32Array(9);
    if (Math.abs(det) < 1e-12) {
      out[0] = out[4] = out[8] = 1;
      return out;
    }
    for (var r = 0; r < 3; r++) {
      for (var c = 0; c < 3; c++) {
        var r1 = (r + 1) % 3, r2 = (r + 2) % 3;
        var c1 = (c + 1) % 3, c2 = (c + 2) % 3;
        var minor = a[r1][c1] * a[r2][c2] - a[r1][c2] * a[r2][c1];
        var sign = ((r + c) % 2 === 0) ? 1 : -1;
        out[c * 3 + r] = sign * minor / det;   // 列主序：第 c 列第 r 行
      }
    }
    return out;
  }

  // 同时按教材习惯暴露全局函数（mat4 / mult / translate ...），
  // 并额外挂一个 MV 命名空间，供不污染全局的写法使用。
  var api = {
    radians: radians, mat4: mat4, mult: mult,
    translate: translate, scale: scale,
    rotateX: rotateX, rotateY: rotateY, rotateZ: rotateZ, rotate: rotate,
    transpose: transpose, perspective: perspective, ortho: ortho, lookAt: lookAt,
    vec3: vec3, add: add, subtract: subtract, cross: cross, dot: dot,
    normalize: normalize, lerp: lerp, flatten: flatten, normalMatrix: normalMatrix
  };
  global.MV = api;
  for (var name in api) {
    if (!global[name]) global[name] = api[name];
  }

})(window);
