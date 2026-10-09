// webgl-utils.js —— 等价于教材 Common/webgl-utils.js 的最小实现
// 提供 WebGL 2.0 上下文初始化（向后回退 webgl1）。

function initWebGL(canvas) {
  var gl = null;
  try {
    gl = canvas.getContext('webgl2') || canvas.getContext('webgl');
  } catch (e) {
    // 忽略异常，交给下方 null 判断
  }
  if (!gl) {
    alert('当前浏览器不支持 WebGL，请更换支持 WebGL 2.0 的浏览器。');
    return null;
  }
  return gl;
}