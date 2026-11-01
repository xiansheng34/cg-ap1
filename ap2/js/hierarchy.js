// js/hierarchy.js —— 层级建模：每帧把"时间 + 面板参数"翻译成各天体的模型矩阵
//
// 变换嵌套树（模型矩阵从根到叶逐层相乘，父节点的变换会传递到所有子节点）：
//
//   World（原点 = 太阳中心，y 轴 = 黄道面法线）
//   │
//   ├── 太阳：      R_y(spin) · S(r_sun)
//   │
//   └── 行星轨道节点：T(d·cosθ, 0, -d·sinθ)            θ = 公转角
//       │      └──────────────┬──────────────┐
//       │                     │              │
//       │            地球自身模型            月球轨道面
//       │   R_x(tilt) · R_y(spin) · S(r)     R_x(5.1°) ★手写矩阵
//       │         （"先转"）                    │
//       │                                    └── T(月地距离·cosθm, 0, -…)
//       │                                          └── R_y(spin_m) · S(r_m)
//
// 地球倾角为什么要"先转后挂"：
//   若写成 M = R_x(tilt) · T_orbit · R_y(spin) · S（先挂后转），
//   倾角是绕"世界 X 轴"整体旋转已经公转过的地球，地轴方向会随公转改变，
//   不会产生稳定的四季；正确写法是先把倾角写进地球自身的局部矩阵，
//   再用公转平移把它"挂"上去：M = T_orbit · ( R_x(tilt) · R_y(spin) · S )。
//   这样地轴在世界中始终指向同一方向，与公转位置无关。
//
// 月球为什么挂在"公转轨道系"而不是"倾斜后的地球系"：
//   真实月球轨道相对黄道面倾斜约 5.1°，而不是相对地球赤道面。
//   因此月球轨道面从 orbitFrame 分出，而不是从地球的 tiltFrame 分出。

window.Hierarchy = (function () {
  'use strict';

  var TWO_PI = Math.PI * 2;

  // ★ 手写矩阵：绕 X 轴旋转 θ 的 4×4 齐次矩阵。
  //   不调用 MV.js 的 rotateX，而是按教材 Ch4 的推导直接写出各分量：
  //
  //        | 1    0      0    0 |        x' = x
  //    R = | 0   cosθ  -sinθ  0 |   ⇒    y' =  cosθ·y - sinθ·z
  //        | 0   sinθ   cosθ  0 |        z' =  sinθ·y + cosθ·z
  //        | 0    0      0    1 |
  //
  //   数组按列主序存放：第 1 列 = (0, cosθ, sinθ, 0)，第 2 列 = (0, -sinθ, cosθ, 0)。
  //   它把月球轨道面绕世界 X 轴抬起，与黄道面形成 5.1° 倾角。
  function manualRotateX(deg) {
    var r = deg * Math.PI / 180;
    var c = Math.cos(r);
    var s = Math.sin(r);
    return [
      1, 0, 0, 0,      // 第 0 列
      0, c, s, 0,      // 第 1 列
      0, -s, c, 0,     // 第 2 列
      0, 0, 0, 1       // 第 3 列（平移分量保持 0）
    ];
  }

  // 模型矩阵第 3 列即世界坐标（齐次坐标 (x,y,z,1) 的平移分量）
  function worldPos(m) {
    return [m[12], m[13], m[14]];
  }

  // 单位圆上一点 → 轨道平移
  function orbitTranslate(radius, angleDeg) {
    var a = angleDeg * Math.PI / 180;
    return translate(radius * Math.cos(a), 0, -radius * Math.sin(a));
  }

  // build(time, params) —— time 单位秒；params：{ orbitSpeed, spinSpeed, earthTilt, moonInclination }
  function build(time, params) {
    var cfg = window.Config;
    var orbitSpeed = params.orbitSpeed;
    var spinSpeed = params.spinSpeed;

    var result = {
      sun: null,
      planets: [],
      moon: null,
      moonOrbitLineModel: null,
      beltModel: null,
      earthPos: [0, 0, 0]
    };

    // ---------- 太阳 ----------
    var sunSpin = 360 * (time / cfg.SUN.spinSeconds) * spinSpeed;
    result.sun = {
      cfg: cfg.SUN,
      model: mult(rotateY(sunSpin), scale(cfg.SUN.radius, cfg.SUN.radius, cfg.SUN.radius)),
      worldPos: [0, 0, 0]
    };

    // ---------- 行星（含地球三级结构） ----------
    for (var i = 0; i < cfg.PLANETS.length; i++) {
      var pl = cfg.PLANETS[i];

      var orbitAngle = 360 * (time / pl.orbitSeconds) * orbitSpeed + pl.phase;
      var spinAngle = 360 * (time / pl.spinSeconds) * spinSpeed;

      // ① 公转轨道节点：把行星平移到轨道上的当前位置
      var orbitFrame = orbitTranslate(pl.distance, orbitAngle);

      // ② 行星自身局部矩阵：倾角 ∘ 自转 ∘ 缩放（先转）
      var tilt = (i === cfg.EARTH_INDEX) ? params.earthTilt : pl.tilt;
      var local = mult(
        rotateX(tilt),
        mult(rotateY(spinAngle), scale(pl.radius, pl.radius, pl.radius))
      );

      // ③ 后挂：整体挂到公转轨道节点之下
      var model = mult(orbitFrame, local);

      var body = {
        cfg: pl,
        model: model,
        worldPos: worldPos(model),
        orbitLineModel: scale(pl.distance, pl.distance, pl.distance)
      };

      // 土星环：与行星共享"倾角 + 自转"变换；环几何以行星半径为单位
      if (pl.ring) {
        body.ringModel = mult(orbitFrame, mult(
          rotateX(tilt),
          mult(rotateY(spinAngle), scale(pl.radius, pl.radius, pl.radius))
        ));
      }
      result.planets.push(body);

      // ---------- 地球–月球（第三级） ----------
      if (i === cfg.EARTH_INDEX) {
        result.earthPos = body.worldPos;

        // ★ 手写倾角矩阵：月球轨道面相对黄道面抬起 5.1°
        var moonPlane = mult(orbitFrame, manualRotateX(params.moonInclination));

        var moonOrbitAngle = 360 * (time / cfg.MOON.orbitSeconds) * orbitSpeed;
        var moonOrbitFrame = mult(moonPlane, orbitTranslate(cfg.MOON.distance, moonOrbitAngle));

        // 潮汐锁定：自转角 = 公转角，月球始终以同一面朝向地球
        var moonSpinAngle = cfg.MOON.tidallyLocked ? moonOrbitAngle : 0;

        var moonModel = mult(moonOrbitFrame, mult(
          rotateY(moonSpinAngle),
          scale(cfg.MOON.radius, cfg.MOON.radius, cfg.MOON.radius)
        ));

        result.moon = {
          cfg: cfg.MOON,
          model: moonModel,
          worldPos: worldPos(moonModel)
        };

        // 月球轨道线：单位圆缩放后，经过同一个手写倾角矩阵，直观展示轨道面被抬起
        result.moonOrbitLineModel = mult(moonPlane,
          scale(cfg.MOON.distance, cfg.MOON.distance, cfg.MOON.distance));
      }
    }

    // ---------- 小行星带：整带绕 Y 轴缓慢公转 ----------
    result.beltModel = rotateY(360 * (time / cfg.BELT.orbitSeconds) * orbitSpeed);

    return result;
  }

  return {
    build: build,
    manualRotateX: manualRotateX,
    worldPos: worldPos
  };
})();
