// js/shaders.js —— GLSL ES 3.00 着色器源码（WebGL 2.0）
//
// 三套程序：
//   body —— 贴图天体 / 土星环。Phong 三要素中最关键的"点光源位于太阳（原点）"
//           通过 uLightPos 传入，法线经法线矩阵变换到世界系，镜面高光按半程向量计算。
//   flat —— 轨道线（LINES）与小行星带（POINTS）。用一个逐顶点的 aShade 做明暗变化，
//           片元阶段用 gl_PointCoord 把方形点裁成圆形。
//   sky  —— 星空背景（全屏方片）。逐像素把屏幕方向还原成世界方向，
//           再换算成等距柱状星图的 (u, v)。透视 / 正交都用同一套虚拟视场，
//           因此两种投影下星点尺寸一致。

window.Shaders = (function () {
  'use strict';

  var bodyVS = [
    '#version 300 es',
    'in vec3 aPosition;',
    'in vec3 aNormal;',
    'in vec2 aTexCoord;',
    'uniform mat4 uModel;',
    'uniform mat4 uView;',
    'uniform mat4 uProj;',
    'uniform mat3 uNormalMatrix;',
    'out vec3 vNormal;',
    'out vec2 vTexCoord;',
    'out vec3 vWorldPos;',
    'void main() {',
    '  vec4 world = uModel * vec4(aPosition, 1.0);',
    '  vWorldPos = world.xyz;',
    '  vNormal = uNormalMatrix * aNormal;',
    '  vTexCoord = aTexCoord;',
    '  gl_Position = uProj * uView * world;',
    '}'
  ].join('\n');

  var bodyFS = [
    '#version 300 es',
    'precision highp float;',
    'in vec3 vNormal;',
    'in vec2 vTexCoord;',
    'in vec3 vWorldPos;',
    'uniform sampler2D uTexture;',
    'uniform vec3 uTint;',
    'uniform vec3 uEyePos;',
    'uniform vec3 uLightPos;',
    'uniform float uAmbient;',
    'uniform float uDiffuse;',
    'uniform float uSpecular;',
    'uniform float uUnlit;',
    'uniform float uTwoSided;',
    'uniform float uAlpha;',
    'out vec4 fragColor;',
    'void main() {',
    '  vec4 texel = texture(uTexture, vTexCoord) * vec4(uTint, 1.0);',
    '  vec3 N = normalize(vNormal);',
    '  if (uTwoSided > 0.5 && !gl_FrontFacing) N = -N;',
    '  vec3 L = normalize(uLightPos - vWorldPos);',
    '  vec3 V = normalize(uEyePos - vWorldPos);',
    '  vec3 H = normalize(L + V);',
    '  float diff = max(dot(N, L), 0.0);',
    '  float spec = diff > 0.0 ? pow(max(dot(N, H), 0.0), 24.0) : 0.0;',
    '  vec3 lit = texel.rgb * (uAmbient + uDiffuse * diff) + vec3(1.0) * uSpecular * spec;',
    '  vec3 col = mix(lit, texel.rgb * 1.2, uUnlit);',
    '  fragColor = vec4(col, texel.a * uAlpha);',
    '}'
  ].join('\n');

  var flatVS = [
    '#version 300 es',
    'in vec3 aPosition;',
    'in float aShade;',
    'uniform mat4 uModel;',
    'uniform mat4 uView;',
    'uniform mat4 uProj;',
    'uniform vec4 uColor;',
    'uniform float uPointSize;',
    'out vec4 vColor;',
    'void main() {',
    '  vColor = vec4(uColor.rgb * aShade, uColor.a);',
    '  gl_Position = uProj * uView * uModel * vec4(aPosition, 1.0);',
    '  gl_PointSize = uPointSize;',
    '}'
  ].join('\n');

  var flatFS = [
    '#version 300 es',
    'precision mediump float;',
    'in vec4 vColor;',
    'uniform float uIsPoint;',
    'out vec4 fragColor;',
    'void main() {',
    '  if (uIsPoint > 0.5) {',
    '    vec2 d = gl_PointCoord - vec2(0.5);',
    '    if (dot(d, d) > 0.25) discard;',
    '  }',
    '  fragColor = vColor;',
    '}'
  ].join('\n');

  // ---------- 星空背景 ----------
  var skyVS = [
    '#version 300 es',
    'in vec3 aPosition;',          // NDC 坐标，直接当裁剪坐标使用
    'out vec2 vNdc;',
    'void main() {',
    '  vNdc = aPosition.xy;',
    '  gl_Position = vec4(aPosition.xy, 0.0, 1.0);',
    '}'
  ].join('\n');

  var skyFS = [
    '#version 300 es',
    'precision highp float;',
    'in vec2 vNdc;',
    'uniform sampler2D uTexture;',
    'uniform vec3 uRight;',        // 相机右轴（世界系）
    'uniform vec3 uUp;',           // 相机上轴
    'uniform vec3 uBack;',         // 相机后轴（视线反方向）
    'uniform float uTanHalf;',     // tan(fov/2)，两种投影共用同一虚拟视场
    'uniform float uAspect;',
    'uniform float uExposure;',
    'out vec4 fragColor;',
    'void main() {',
    '  // 先按针孔相机反算"相机坐标系方向"，再转到世界系',
    '  vec3 dCam = vec3(vNdc.x * uAspect * uTanHalf, vNdc.y * uTanHalf, -1.0);',
    '  vec3 dir = normalize(uRight * dCam.x + uUp * dCam.y + uBack * dCam.z);',
    '  // 等距柱状投影（equirectangular）反查：u 为经度，v 从南极(0)到北极(1)',
    '  float u = atan(dir.z, dir.x) * 0.159154943 + 0.5;',
    '  float v = acos(clamp(-dir.y, -1.0, 1.0)) * 0.318309886;',
    '  fragColor = vec4(texture(uTexture, vec2(u, v)).rgb * uExposure, 1.0);',
    '}'
  ].join('\n');

  return {
    bodyVS: bodyVS,
    bodyFS: bodyFS,
    flatVS: flatVS,
    flatFS: flatFS,
    skyVS: skyVS,
    skyFS: skyFS
  };
})();
