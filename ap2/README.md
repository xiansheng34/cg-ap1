# AP2 · 三维层级场景：太阳系

原生 **WebGL 2.0 + GLSL ES 3.00** 实现，沿用教材风格工具库（`Common/webgl-utils.js` / `Common/MV.js` / `Common/initShaders.js`），无构建步骤，任意静态服务器即可运行。

太阳 – 地球 – 月球三级变换嵌套；8 颗行星 + 土星环 + 小行星带；`O` 键切换透视 / 正交；预设关键帧漫游与虚拟轨迹球可互相接管。

---

## 运行方式

**在线体验（推荐）**

打开 [https://xiansheng34.github.io/cg-ap1/ap2/](https://xiansheng34.github.io/cg-ap1/ap2/)

**本地运行**

```bash
# 在仓库根目录启动任意静态服务器（ap2 使用相对路径，无需额外配置）
python -m http.server 8000
# 浏览器打开 http://localhost:8000/ap2/
```

> 必须经由 HTTP 服务访问：纹理通过 `new Image()` 加载，直接双击 `index.html`（`file://`）会被同源策略拦下。
> 浏览器需支持 WebGL 2.0（Chrome / Edge / Firefox / Safari 15+）。

## 操作速查

| 操作 | 效果 |
|---|---|
| `O` / 「切换投影」按钮 | 透视 ↔ 正交（面板「当前投影」同步显示） |
| `空格` / 「暂停漫游」按钮 | 暂停 / 继续漫游；被鼠标接管后按空格会重新开启漫游 |
| `T` | 从路径起点重播漫游 |
| 左键拖动 | 虚拟轨迹球旋转视角（自动接管漫游，按钮变为「开启漫游」） |
| 滚轮 | 缩放（相机到注视点距离 6–400） |

---

## 评分点对照

| 要求 | 实现位置 |
|---|---|
| 太阳–地球–月球三级嵌套；倾角「先转后挂」 | `js/hierarchy.js` 的 `build()` |
| 手造矩阵（`mat4` 基本变换 + `mult` 手工组合） | `js/hierarchy.js` 的 `manualRotateX()`（月球轨道面 5.1°） |
| 太阳 / 地球 / 月球位图纹理 | `js/textures.js` + `js/shaders.js` 的 `body` 程序 |
| `UNPACK_FLIP_Y_WEBGL` 与 UV | `js/textures.js`、`js/geometry.js` |
| `O` 键双投影 | `js/camera.js` 的 `projection()` + `js/input.js` |
| 关键帧漫游 + 空格暂停 + 与拖拽互相接管 | `js/camera.js`、`js/main.js` |
| 公转 / 自转 / 轴倾角 / 轨道线面板 | `index.html` + `js/ui.js` |
| 天体参数集中配置 | `js/config.js` |
| E1 完整太阳系（8 行星 + 土星环 + 小行星带） | `js/config.js`、`js/geometry.js`、`js/main.js` |
| E3 虚拟轨迹球 | `js/camera.js` 的 `ballPoint()` / `trackballDrag()` |

---

## 1. 层级与变换：变换嵌套树

世界原点 = 太阳中心，`y` 轴 = 黄道面法线。模型矩阵从根到叶逐层右乘（列主序，`M_world = M_parent · M_local`）：

```
World
│
├── 太阳        M = R_y(spin_sun) · S(r_sun)
│
├── 行星轨道节点  M_orbit = T(d·cosθ, 0, -d·sinθ)            θ = 公转角
│   │
│   ├── 行星本体  M = M_orbit · [ R_x(tilt) · R_y(spin) · S(r) ]      ← tilt 在自身矩阵里
│   │
│   └── 月球轨道面 M_plane = M_orbit · R_x(5.1°)          ★ 手写矩阵
│       │
│       └── 月球   M = M_plane · T(d_moon·cosθ_m, 0, -d_moon·sinθ_m)
│                        · R_y(spin_m) · S(r_moon)
│
└── 小行星带     M = R_y(θ_belt)（整带缓慢公转）
```

要点：**父节点的矩阵只负责"摆位置/定姿态"，子节点的一切运动都写在它自己的局部矩阵里**，因此改公转速度不会影响自转相位，改轴倾角也不会破坏月球轨道。

### 地球倾角为什么必须「先转后挂」

错误写法（先把地球挂到轨道上，再整体绕世界 X 轴倾斜）：

```
M = R_x(23.5°) · T_orbit · R_y(spin) · S
```

`R_x` 作用在已经公转过的位置上，**地轴方向会随公转不断改变**，北极在一年里会转着圈指——四季消失，倾角退化成一个"整体晃动"。

正确写法（倾角先写进地球自身局部矩阵，再用公转平移把它挂上去）：

```
M_earth = T_orbit · ( R_x(23.5°) · R_y(spin) · S(r_earth) )
```

`js/hierarchy.js` 实现：

```js
var orbitFrame = orbitTranslate(pl.distance, orbitAngle);          // T_orbit
var local = mult(rotateX(tilt),                                    // 先转：倾角
              mult(rotateY(spinAngle), scale(pl.radius, pl.radius, pl.radius)));
var model = mult(orbitFrame, local);                               // 后挂：公转
```

因为 `T_orbit` 只含平移、不含旋转，地轴在世界坐标系中始终指向同一方向（北极星方向），地球绕日一周后季节自然循环。面板上的「地球自转轴倾角」滑条直接改这个 `R_x` 的角度。

同理，月球轨道面是从 **公转轨道系** `orbitFrame` 分出去的，而不是从倾斜后的地球赤道系分出——真实月球轨道相对**黄道面**倾斜约 5.1°，不是相对赤道面。

## 2. 手造矩阵：`manualRotateX`

月球轨道面倾角**没有**调用 `MV.js` 的 `rotateX`，而是按教材 Ch4 的齐次坐标推导直接写出各分量，再用 `mult` 组合：

```
        | 1    0      0    0 |
   R =  | 0   cosθ  -sinθ  0 |
        | 0   sinθ   cosθ  0 |
        | 0    0      0    1 |

   x' = x
   y' =  cosθ·y - sinθ·z
   z' =  sinθ·y + cosθ·z
```

WebGL 的 `mat4` 按**列主序**存放，因此第 1 列是 `(0, cosθ, sinθ, 0)`、第 2 列是 `(0, -sinθ, cosθ, 0)`：

```js
function manualRotateX(deg) {
  var r = deg * Math.PI / 180, c = Math.cos(r), s = Math.sin(r);
  return [
    1, 0, 0, 0,      // 第 0 列
    0, c, s, 0,      // 第 1 列
    0, -s, c, 0,     // 第 2 列
    0, 0, 0, 1       // 第 3 列（无平移）
  ];
}
```

组合方式（先抬高轨道面，再在抬高后的平面里绕地球转）：

```js
var moonPlane      = mult(orbitFrame, manualRotateX(params.moonInclination));
var moonOrbitFrame = mult(moonPlane, orbitTranslate(MOON.distance, moonOrbitAngle));
var moonModel      = mult(moonOrbitFrame, mult(rotateY(moonSpinAngle), scale(r, r, r)));
```

月球轨道线用**同一个** `moonPlane` 缩放后绘制，所以拖动「月球轨道面倾角」滑条时，轨道线和月球会一起被抬起，能直观看到倾角确实是绕世界 X 轴施加的。

行星公转 / 自转角度同样由 `MV.js` 的基础变换（`translate` / `rotateX` / `rotateY` / `scale`）组合而成，`mult` 负责逐层相乘。

## 3. 纹理与 UV

- 几何：`Geometry.sphere()` 生成经纬细分球，顶点为 8 float 交错布局 `[px py pz | nx ny nz | u v]`，用 WebGL2 的 **VAO** 固化属性指针。
- UV 约定：`u` 随经度 0→1（接缝在 +X 轴），`v` 随纬度 0→1，**v = 0 是南极**。
- 图像文件的行序是"第 0 行在最上方"，而纹理坐标 `v=0` 在图像最下方。若直接上传，贴到球面上南北会颠倒（南极纹理跑到北极）。因此上传前：

```js
gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);   // 翻转图像行序，让 v=0 对齐图像最底一行
gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, img);
gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);  // 用完立刻复位，避免影响其它纹理
```

- 采样：`generateMipmap` + `LINEAR_MIPMAP_LINEAR`（远处行星不闪烁）、`WRAP_S = REPEAT` / `WRAP_T = CLAMP_TO_EDGE`；WebGL 2.0 对非 2 次幂纹理（本项目的 1000×500、915×64）同样支持 REPEAT 与 mipmap，无需改图。
- 纹理未就绪时先绑 1×1 占位色，避免黑块；加载失败则回退到 `config.js` 里的 `fallbackColor`。
- 土星环单独一张带 alpha 的 PNG，UV 约定为 `u = 径向比例`、`v = 圆周比例`，因此环的放射状条纹沿半径铺开。

数据流：`顶点 UV → 插值到片元 → texture(uTexture, vTexCoord) → Phong 计算 → fragColor`。

## 4. 双投影：透视 vs 正交

`js/camera.js`：

```js
// 透视
perspective(fov=45°, aspect, near=0.1, far=3000)

// 正交：取「注视点所在平面」的视野高度 = dist·tan(fov/2)
var h = state.dist * Math.tan(radians(state.fov) / 2);
ortho(-h * aspect, h * aspect, -h, h, near, far)
```

正交高度按 `dist·tan(fov/2)` 取值，使两种投影在 **target 处取景范围相同**，差别就只剩"近大远小"本身，便于并排比较。

| | 透视投影 | 正交投影 |
|---|---|---|
| 变换类型 | 透视除法（`w` 分量参与） | 仿射，`w ≡ 1` |
| 近大远小 | 有：同样大的天体，远者更小 | 无：屏幕上尺寸与深度无关 |
| 平行线 | 向消失点汇聚 | 保持平行 |
| 轨道圆 | 靠近相机的弧段被放大 | 各段宽度一致 |
| 星空 | —— | 两种投影下星点尺寸一致（见下） |

星空背景没有用"半径 500 的球面"，因为正交投影没有近大远小：球面上的星点会被放大成几十像素的模糊光斑。改为**全屏方片 + 逐像素反查等距柱状星图**（`sky` 程序）：每个像素按相机三轴把屏幕方向还原成世界方向，再换算 `u = atan(z, x)/2π + 0.5`、`v = acos(-y)/π` 采样星空贴图，两种投影共用同一虚拟视场，星点尺寸一致且随相机转动而移动。

**对比截图（占位）**

- `screenshots/20-persp.png` —— 默认漫游视角下的透视全景
- `screenshots/21-ortho.png` —— 同一时刻、同一视角切换为正交（按 `O`）后截图

拍摄说明：先按 `空格` 暂停漫游锁定视角，截一张透视；再按 `O` 切到正交、立即截第二张，两图应只有"近大远小"的差别。README 里请替换为各自的图。

## 5. 相机漫游与轨迹球接管

`js/config.js` 的 `TOUR.keys` 定义 6 个关键帧（`az` 方位角 / `el` 仰角 / `dist` 距离 / `target`）：

| t (s) | az | el | dist | target |
|---|---|---|---|---|
| 0 | 20 | 26 | 108 | 太阳 |
| 10 | 200 | 8 | 88 | 太阳 |
| 20 | 330 | 16 | 34 | 地球 |
| 31 | 430 | 6 | 18 | 地球特写 |
| 44 | 560 | 40 | 92 | 太阳 |
| 56 | 740 | 26 | 108 | 太阳 |

- 帧间用 `smoothstep` 平滑插值，`target` 在地球时会跟随地球实时位置（`Camera.update(dt, earthPos)`）。
- 首尾 `az` 相差 **720°**、`el` / `dist` 完全相同，循环播放时方位连续、无跳变。
- 相机始终绕注视点 `target` 环绕：`eye = target + rot·(0,0,dist)`，`up = rot·(0,1,0)`，因此轨迹球、漫游、缩放只改 `rot / dist / target` 三个量，互不干扰。

**接管规则**：漫游运行时每帧用关键帧覆盖姿态；鼠标一拖动，`trackballDrag()` 立即把 `tour.enabled = false`，视角完全交给轨迹球（按钮文案变「开启漫游」）；点按钮 / 按 `T` / 按空格可重新开启漫游，从路径起点播放。

虚拟轨迹球（E3）：屏幕坐标 `(x, y) ∈ [-1,1]²` 映射到单位半球 `z = √(1 - x² - y²)`，越出单位圆则投影到赤道边缘；两次采样的叉积给出转轴、点积给出转角，构造相机空间旋转增量后**右乘**到 `rot`（符合"拖动画面"的直觉）。

**漫游录屏（占位）**

- `screenshots/ap2-tour.mp4` —— 10 秒漫游录屏

拍摄说明：刷新页面开始自动漫游，用系统录屏（Win+`G` 或 OBS）录 10 秒；期间可按一次 `空格` 展示暂停，再按一次继续。README 里请替换为视频或动图。

## 6. 参数面板

| 控件 | 作用 | 代码 |
|---|---|---|
| 公转速度倍率 0–8 | 乘到所有公转角（行星、月球、小行星带） | `params.orbitSpeed` → `hierarchy.build` |
| 自转速度倍率 0–8 | 乘到所有自转角（含太阳） | `params.spinSpeed` |
| 地球自转轴倾角 0–90° | 改地球自身矩阵里的 `R_x(tilt)` | `params.earthTilt` |
| 月球轨道面倾角 0–30° | 改手写矩阵 `manualRotateX` 的角度 | `params.moonInclination` |
| 显示轨道线 | 行星轨道 + 月球（带倾角）轨道线 | `params.showOrbits` |
| 显示小行星带 | 火星–木星之间的 2200 个点精灵 | `params.showBelt` |

面板只往 `main.js` 回传数值，不直接改 GL 状态；`main.js` 每帧把 `params` 交给 `Hierarchy.build()`，因此所有控件都是"下一帧即生效"。

## 7. 选做扩展

**E1 · 完整太阳系**：水星、金星、地球、火星、木星、土星、天王星、海王星 8 颗行星（`config.js` 里含真实周期数据），土星环（半透明 annulus + `SRC_ALPHA` 混合 + 关闭深度写入 + 双面受光），小行星带（2200 个确定性随机点，`mulberry32` 保证每次刷新形态一致）。

**E3 · 虚拟轨迹球**：见第 5 节，与漫游互斥接管。

## 8. 代码结构

```
ap2/
├── index.html            页面、画布、参数面板、脚本装配
├── Common/
│   ├── webgl-utils.js    创建 WebGL2 上下文（深度测试、关闭背面剔除）
│   ├── MV.js             mat4 / mult / translate / scale / rotate / lookAt / perspective / ortho / normalMatrix
│   └── initShaders.js    着色器编译链接（支持 #version 300 es）
├── js/
│   ├── config.js         天体参数集中配置（半径 / 距离 / 真实周期 / 材质 / 漫游关键帧）
│   ├── geometry.js       球体、圆环、轨道线、小行星带、全屏方片（只产出 Float32Array）
│   ├── textures.js       位图纹理加载、UNPACK_FLIP_Y_WEBGL、mipmap
│   ├── hierarchy.js      ★ 层级建模：每帧算出所有模型矩阵（含手写矩阵）
│   ├── camera.js         轨迹球 / 双投影 / 关键帧漫游 / 接管规则
│   ├── shaders.js        body（Phong + 纹理）、flat（线 / 点）、sky（星空背景）三套程序
│   ├── renderer.js       GL 资源与绘制顺序（VAO、纹理、uniform）
│   ├── ui.js             参数面板（只读控件 / 回写文案 / 抛回调）
│   ├── input.js          Pointer Events 拖拽、滚轮、键盘
│   └── main.js           入口：初始化 + 渲染循环 + 接线
└── textures/             位图纹理（见第 11 节）
```

每帧绘制顺序：星空背景（不写深度）→ 太阳 / 行星 / 月球 → 土星环（半透明，关深度写入）→ 轨道线 → 小行星带。光照为 Phong 三点式，点光源固定在太阳（世界原点），`gl_FrontFacing` 让土星环正反两面都受光。

## 9. 数值说明（重要）

本项目**不追求真实比例**，请勿把可视参数当作天文数据：

- 半径与距离按"地球半径 = 1"做视觉压缩（真实太阳半径约为地球的 109 倍，直接渲染会把行星全部压成不可见的点）。
- 真实公转周期跨 3 个数量级（水星 0.24 年 vs 海王星 164.8 年），若共用同一时钟，外侧行星几乎静止。因此 `config.js` 保留真实周期 `realOrbitYears / realSpinDays` 作为数据源，并按
  `显示周期 = 基准时长 × 真实周期^0.45`
  压缩；地球默认 30 s 公转一周、3 s 自转一周，公转与自转使用两套独立基准，只为"看得见"。
- 金星、天王星的自转周期为负（逆行），配置里用负号表达方向和倍率。
- 月球轨道面倾角 5.1°、地球轴倾角 23.5° 采用真实值。

## 10. 素材来源

`textures/` 下的行星、太阳、月球、土星环与星空贴图取自公开的行星贴图资源（如 Solar System Scope / NASA 相关贴图），仅用于课程作业演示。若需替换，只需改 `js/config.js` 里对应天体的 `texture` 路径，代码无需改动。

## 11. 交付物

- 在线体验：`https://xiansheng34.github.io/cg-ap1/ap2/`
- 源码：本目录（`ap2/`），入口 `index.html`
- 演示素材：`screenshots/` 下的双投影对比截图与 10 秒漫游录屏（见第 4、5 节占位说明）
</content>
