// Common/initShaders.js —— 着色器编译 / 链接
// 与教材同名工具函数等价，额外支持 GLSL ES 3.00（#version 300 es）。

window.initShaders = function (gl, vertexSource, fragmentSource) {
  'use strict';

  function compile(type, source, label) {
    var shader = gl.createShader(type);
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      var log = gl.getShaderInfoLog(shader);
      console.error(label + ' 编译失败:\n' + log + '\n--- 源码 ---\n' + source);
      gl.deleteShader(shader);
      return null;
    }
    return shader;
  }

  var vs = compile(gl.VERTEX_SHADER, vertexSource, 'Vertex Shader');
  var fs = compile(gl.FRAGMENT_SHADER, fragmentSource, 'Fragment Shader');
  if (!vs || !fs) return null;

  var program = gl.createProgram();
  gl.attachShader(program, vs);
  gl.attachShader(program, fs);
  gl.linkProgram(program);
  gl.deleteShader(vs);
  gl.deleteShader(fs);

  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    console.error('着色器链接失败:\n' + gl.getProgramInfoLog(program));
    gl.deleteProgram(program);
    return null;
  }
  return program;
};
