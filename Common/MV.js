// MV.js —— 等价于教材 Common/MV.js 的最小矩阵实现（列主序，全局函数）
// 仅供 AP1 使用：mat4 / mult / translate / scale / flatten。
// 若拿到教材原版，可直接整体替换本文件。

// 返回 4x4 单位矩阵（列主序，16 元数组）
function mat4() {
  return [
    1, 0, 0, 0,
    0, 1, 0, 0,
    0, 0, 1, 0,
    0, 0, 0, 1
  ];
}

// 列主序矩阵乘法 c = a * b
function mult(a, b) {
  var c = mat4();
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

// 平移矩阵
function translate(x, y, z) {
  var m = mat4();
  m[12] = x;
  m[13] = y;
  m[14] = z;
  return m;
}

// 缩放矩阵
function scale(x, y, z) {
  var m = mat4();
  m[0] = x;
  m[5] = y;
  m[10] = z;
  return m;
}

// 将 JS 数组（或矩阵）压平成 Float32Array，供 gl.uniformMatrix* 使用
function flatten(v) {
  if (v instanceof Float32Array) return v;
  return new Float32Array(v);
}