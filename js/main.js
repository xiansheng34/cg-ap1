// main.js —— 主程序
// 初始化 WebGL、着色器、VBO，组织渲染循环与状态，串联 UI 与交互。

(function () {
  'use strict';

  // ===== 状态 =====
  var state = {
    mode: 'points',         // points / lines / triangles
    pointCount: 5000,       // 混沌游戏目标点数
    currentCount: 0,        // 逐点生长动画当前点数
    depth: 4,               // 递归细分深度
    pointSize: 2.0,
    colorScheme: 0,
    scale: 0.82,
    offsetX: 0.0,
    offsetY: 0.0,
    paused: false
  };

  // 至少 3 套配色方案
  var COLOR_SCHEMES = [
    { name: '冰蓝',   color: [0.20, 0.62, 0.95, 1.0] },
    { name: '暖橙',   color: [0.98, 0.55, 0.20, 1.0] },
    { name: '紫罗兰', color: [0.70, 0.34, 0.96, 1.0] }
  ];

  // ===== WebGL 初始化 =====
  var canvas = document.getElementById('glCanvas');
  var gl = initWebGL(canvas);
  if (!gl) return;

  // 使用 GLSL ES 1.00 风格着色器（WebGL2 向后兼容）
  var VS = [
    'attribute vec2 aPosition;',
    'uniform mat4 uModel;',
    'uniform float uPointSize;',
    'void main() {',
    '  gl_Position = uModel * vec4(aPosition, 0.0, 1.0);',
    '  gl_PointSize = uPointSize;',
    '}'
  ].join('\n');

  var FS = [
    'precision mediump float;',
    'uniform vec4 uColor;',
    'void main() { gl_FragColor = uColor; }'
  ].join('\n');

  var program = initShaders(gl, VS, FS);
  if (!program) return;

  var aPosition = gl.getAttribLocation(program, 'aPosition');
  var uModel = gl.getUniformLocation(program, 'uModel');
  var uColor = gl.getUniformLocation(program, 'uColor');
  var uPointSize = gl.getUniformLocation(program, 'uPointSize');

  var vbo = gl.createBuffer();
  var vboMode = '';   // 当前 VBO 中的数据类型，避免每帧重复上传

  gl.clearColor(0.05, 0.05, 0.09, 1.0);

  // ===== 几何数据构建 =====
  var pointsData = null;
  var lineData = null;
  var triData = null;

  function rebuildPoints() {
    pointsData = Geometry.chaosGame(state.pointCount);
    state.currentCount = 0; // 重置，重新逐点生长
  }

  function rebuildShapes() {
    var tris = Geometry.subdivide(state.depth);
    lineData = Geometry.trianglesToEdges(tris);
    triData = Geometry.trianglesToVertexArray(tris);
  }

  // ===== 状态变更 =====
  function setMode(m) {
    state.mode = m;
    document.querySelectorAll('input[name="renderMode"]').forEach(function (r) {
      r.checked = (r.value === m);
    });
    UI.syncMode(m);
    if (m === 'points' && !pointsData) rebuildPoints();
    if ((m === 'lines' || m === 'triangles') && !lineData) rebuildShapes();
    vboMode = ''; // 让下一帧重新上传对应数据
  }

  // ===== 渲染循环 =====
  function ensureBuffer(mode) {
    if (vboMode === mode) return;
    gl.bindBuffer(gl.ARRAY_BUFFER, vbo);
    if (mode === 'points') gl.bufferData(gl.ARRAY_BUFFER, pointsData, gl.STATIC_DRAW);
    else if (mode === 'lines') gl.bufferData(gl.ARRAY_BUFFER, lineData, gl.STATIC_DRAW);
    else gl.bufferData(gl.ARRAY_BUFFER, triData, gl.STATIC_DRAW);
    vboMode = mode;
  }

  function render() {
    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.useProgram(program);

    var primitive, count;
    if (state.mode === 'points') {
      // 逐点生长：每帧增加一批点，直到目标点数
      if (!state.paused && state.currentCount < state.pointCount) {
        var step = Math.max(1, Math.ceil(state.pointCount / 60));
        state.currentCount = Math.min(state.pointCount, state.currentCount + step);
      }
      primitive = gl.POINTS;
      count = state.currentCount;
    } else if (state.mode === 'lines') {
      primitive = gl.LINES;
      count = lineData.length / 2;
    } else {
      primitive = gl.TRIANGLES;
      count = triData.length / 2;
    }

    ensureBuffer(state.mode);
    gl.vertexAttribPointer(aPosition, 2, gl.FLOAT, false, 0, 0);
    gl.enableVertexAttribArray(aPosition);

    // 手工构造 model = translate * scale（MV.js 基本变换组合）
    var model = mult(translate(state.offsetX, state.offsetY, 0), scale(state.scale, state.scale, 1));
    gl.uniformMatrix4fv(uModel, false, flatten(model));
    gl.uniform4fv(uColor, COLOR_SCHEMES[state.colorScheme].color);
    gl.uniform1f(uPointSize, state.pointSize);

    gl.drawArrays(primitive, 0, count);
    requestAnimationFrame(render);
  }

  // ===== 交互接线 =====
  Interaction.init(canvas, {
    onPan: function (dx, dy) { state.offsetX += dx; state.offsetY += dy; },
    onZoom: function (f) { state.scale = Math.min(20, Math.max(0.05, state.scale * f)); },
    onKey: function (key) {
      if (key === '1') setMode('points');
      else if (key === '2') setMode('lines');
      else if (key === '3') setMode('triangles');
      else if (key === ' ') {
        // 生长已结束时按空格直接从头重播，保证按键立即有可见效果
        if (state.mode === 'points' && state.currentCount >= state.pointCount) {
          state.currentCount = 0;
          state.paused = false;
        } else {
          state.paused = !state.paused;
        }
      }
    }
  });

  UI.init({
    onMode: setMode,
    onPointCount: function (n) {
      state.pointCount = n;
      if (state.mode === 'points') { rebuildPoints(); vboMode = ''; }
    },
    onDepth: function (d) {
      state.depth = d;
      rebuildShapes();
      if (state.mode === 'lines' || state.mode === 'triangles') vboMode = '';
    },
    onPointSize: function (s) { state.pointSize = s; },
    onColorScheme: function (c) { state.colorScheme = c; }
  });

  // ===== 启动 =====
  function resize() {
    var w = canvas.clientWidth;
    var h = canvas.clientHeight;
    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w;
      canvas.height = h;
    }
  }
  window.addEventListener('resize', resize);
  resize();

  rebuildShapes();   // 预构建线框/实体几何
  setMode('points'); // 初始为点云模式并构建点数据

  requestAnimationFrame(render);
})();
