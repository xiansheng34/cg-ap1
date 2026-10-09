// initShaders.js —— 等价于教材 Common/initShaders.js 的最小实现
// 编译并链接着色器，返回 program；失败时打印日志并返回 null。

function createShader(gl, type, source) {
  var shader = gl.createShader(type);
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    console.error('Shader 编译失败:', gl.getShaderInfoLog(shader));
    gl.deleteShader(shader);
    return null;
  }
  return shader;
}

function initShaders(gl, vShaderSrc, fShaderSrc) {
  var vShader = createShader(gl, gl.VERTEX_SHADER, vShaderSrc);
  var fShader = createShader(gl, gl.FRAGMENT_SHADER, fShaderSrc);
  if (!vShader || !fShader) return null;

  var program = gl.createProgram();
  gl.attachShader(program, vShader);
  gl.attachShader(program, fShader);
  gl.linkProgram(program);

  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    console.error('Program 链接失败:', gl.getProgramInfoLog(program));
    gl.deleteProgram(program);
    return null;
  }
  gl.useProgram(program);
  return program;
}