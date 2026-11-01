// Common/webgl-utils.js —— WebGL 2.0 上下文初始化
// 保持教材工具库的入口名 initWebGL，便于直接替换成教材原版文件。

window.initWebGL = function (canvas, options) {
  'use strict';

  var opt = {
    alpha: false,
    antialias: true,
    depth: true,
    stencil: false,
    premultipliedAlpha: false,
    preserveDrawingBuffer: false,
    powerPreference: 'high-performance'
  };
  if (options) {
    for (var k in options) opt[k] = options[k];
  }

  var gl = canvas.getContext('webgl2', opt);
  if (!gl) {
    var msg = document.createElement('div');
    msg.style.cssText = 'position:fixed;inset:0;display:flex;align-items:center;justify-content:center;' +
      'background:#08080f;color:#ffb4b4;font:16px/1.8 "Microsoft YaHei",sans-serif;text-align:center;padding:40px;z-index:99';
    msg.innerHTML = '当前浏览器或显卡不支持 WebGL 2.0。<br>请使用最新版 Chrome / Edge / Firefox，并确认未禁用硬件加速。';
    document.body.appendChild(msg);
    return null;
  }

  gl.enable(gl.DEPTH_TEST);
  gl.depthFunc(gl.LEQUAL);
  gl.depthMask(true);
  gl.disable(gl.CULL_FACE);   // 土星环 / 星空球内壁需要看到背面，统一关闭背面剔除
  return gl;
};
