// js/textures.js —— 位图纹理加载 / 上传
//
// 关键点（README 有同名小节）：
//   · 图像文件的行序是"第 0 行在最上方"，而纹理坐标 v=0 在图像最下方。
//     如果直接把 Image 上传，贴到球面后南北会颠倒（地球的南极跑到北极）。
//     因此上传前 gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true)，
//     让 v=0 对齐图像最底下一行，与 Geometry.sphere 的 UV 约定一致。
//   · WebGL 2.0 对非 2 次幂纹理（本项目的 1000×500、915×64）同样支持
//     REPEAT 与 mipmap，因此这里统一生成 mipmap，远处行星不会闪烁。
//   · 加载完成前先绑定 1×1 占位色，避免物体在纹理就绪前变成黑块。

window.Textures = (function () {
  'use strict';

  var anisotropyExt = null;

  function placeholder(gl, value) {
    var tex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, tex);
    var px = new Uint8Array([value, value, value, 255]);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, px);
    return tex;
  }

  // load(gl, url, onReady) —— onReady(ok, tex)
  // 失败时仍然返回占位纹理（ok=false），调用方可切换成纯色兜底。
  function load(gl, url, onReady) {
    if (!anisotropyExt) {
      anisotropyExt = gl.getExtension('EXT_texture_filter_anisotropic');
    }

    var tex = placeholder(gl, 200);
    var img = new Image();

    img.onload = function () {
      gl.bindTexture(gl.TEXTURE_2D, tex);

      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, img);
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);

      gl.generateMipmap(gl.TEXTURE_2D);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

      if (anisotropyExt) {
        var maxAniso = gl.getParameter(anisotropyExt.MAX_TEXTURE_MAX_ANISOTROPY_EXT);
        gl.texParameterf(gl.TEXTURE_2D, anisotropyExt.TEXTURE_MAX_ANISOTROPY_EXT,
          Math.min(4, maxAniso));
      }

      onReady(true, tex);
    };

    img.onerror = function () {
      console.error('纹理加载失败:', url);
      onReady(false, tex);
    };

    img.src = url;
    return tex;
  }

  return { load: load };
})();
