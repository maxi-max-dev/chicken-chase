# 更新日志

> 《老鹰抓小鸡》像素风 Web 版。为什么改比改了什么更重要——每条记清动机。

## 第 4 轮 · 2026-07-04 · 上作品集前的门面轮（动态镜头 / 触屏 / 场地质感）

> 本轮**只动 render/ui，sim 一行不改**（决定论地基不碰）。三件事都是纯观感/操作层。
> 所有渲染参数进 `config.ts` 的独立块并明确标注「不进 sim」，与 `SimConfig` 逻辑隔离。

### 🎥 动态镜头（`GameScene.updateCamera`）
- **动机**：旧版全场固定视角，场地大角色小、画面空旷，作品集第一眼不抓人。
- **做法**：每帧算「所有活动角色（母鸡+链+老鹰+脱链小鸡）」的包围盒，加边距后让它填满视口 → 目标 zoom = 视口/包围盒；zoom 和 scroll 都用 `lerp` 向目标平滑插值（防抖）；scroll 钳制在场地边界内，不露黑边；场地比视口小则居中。开局菜单/结算不受影响（只在对局 update 里跑）。
- **渲染参数**（`config.ts` 的 `CAMERA` 块，标注不进 sim）：`margin=46`、`minZoom=1.0`、`maxZoom=2.1`、`lerp=0.08`。
- **实测**（真浏览器 dist，母鸡模式）：角色分散时 zoom 拉远、聚拢时明显拉近（截图对比角色占屏比例，聚拢那张角色像素明显变大、网格格子变大），scroll 钳制生效（画面边缘可见场地墙不越界）。

### 📱 触屏操作（`ui/touch.ts` + `render/input.ts`）
- **动机**：手机上旧版完全没法玩（要键盘），`pageMobile` 只写着"请在电脑上打开"。
- **做法**：屏幕左半虚拟摇杆（按下处生成、拖动给方向、松手归零）+ 右下动作按钮（按角色显示「扑/翅/蹲」）。**输出接进现有 `InputController` 的触屏通道**（`setTouchMove`/`pressTouchAction`），和键盘取并集汇入同一个 `InputFrame`，不绕过 InputController 直喂 sim。开局门 `moveHeld()` 同时认摇杆按住。仅触屏设备（`pointer:coarse` + touch point 探测）创建这些 DOM 元素，桌面完全不出现。
- **文案**（`strings.ts`）：触屏设备显示触屏版说明（`skill*Touch`/`tutorialMoveTouch`/`tutorialStartTouch`），`pageMobile` 改成"左半屏摇杆移动，右下按钮出技能"。
- **实测**（真浏览器 iPhone 12 视口 + `hasTouch`，小鸡模式）：dispatch 触控事件模拟摇杆右上拖动 → 小鸡从 `(0,33)` 移到 `(18.9,-7.8)` 且 `phase=playing`（证明摇杆走通了开局门）；动作按钮按下 → `crouchLeft=0.75`（蹲下触发）；截图确认摇杆在左下、按钮在右下、都不挡顶部 HUD。

### 🌿 场地质感 + 抓捕反馈（`GameScene.drawTerrain` / `spawnFeathers`）
- **动机**：纯浅绿草地太空；抓捕瞬间也没反馈。
- **做法**：程序生成草丛（短竖线）/碎花（小十字）/色斑（淡椭圆），密度低对比弱不抢角色；**用 render 侧自己的 mulberry32（种子固定 `TERRAIN.seed`），绝不碰 sim 的 `rngState`** → 图案每局一致、决定论不受影响。抓捕瞬间：消费 sim 的 `catch` 事件，在被抓位置撒一小撮羽毛粒子 + `camera.shake(120ms, 0.004)` 极轻微震屏（纯渲染，事件本就由 sim 产出、渲染层消费）。
- **渲染参数**（`config.ts` 的 `TERRAIN` 块）：`seed`、`density=0.010`、`colors`（5 色，融进草地）。
- **实测**：截图确认草丛/碎花均匀铺满且弱对比不抢角色；抓捕后截图见羽毛/震屏路径已跑（HUD 已抓 0→1）。

### ✅ 验收
- `npm test`：23 passed（原 23 一个没挂——sim 未改，决定论测试全绿）。
- `npm run build`：通过（>500kB 警告仍是 Phaser 包体，非本轮引入）。
- 桌面/触屏均真浏览器（headless Chromium / Playwright）验证，无 pageerror。
- `npx vite build --outDir docs --emptyOutDir` 重新出 docs；**未 git commit / 未部署**（等 Max 验收后自行发版）。
- 新增触屏文案，但项目至今走系统 `Courier New`/无像素中文子集工具链（第 1 轮遗留），故本轮不涉及字体子集重跑。
- ⚠️ **验证口径说明**：`__game` 调试钩子由 `import.meta.env.DEV` 门控，仅 `vite` dev server 注入、`vite build` 产物没有。故需读 sim 内部坐标作证的触屏/镜头 zoom 数值验证跑在 dev server 上；纯视觉截图（角色占屏比例、控件位置）跑在生产 dist 上。两者页面代码同源。

## 第 3 轮 · 2026-07-04 · 真浏览器复现修开局门（老鹰"冻结"真凶）

> 本轮所有结论都来自**真浏览器**（headless Chromium，Playwright 驱动 dist），不靠单元测试下结论。
> 用临时探针（main.ts 里把 `__game` 钩子改成无条件挂，验完已还原）逐秒采样 sim 内部坐标作证据。

### 🐛 Bug A（主凶）小鸡模式老鹰"全程冻结" → 真凶=开局门，与 Bug B 同源
- **打回现象**：选小鸡开局，两张相隔 7 秒截图里老鹰像素坐标完全不变（HUD 计时 86→79 在走、AI 母鸡带链在动）。
- **真浏览器复现结论（关键）**：**当前 `src` 里，只要游戏真正进入 `playing`，老鹰在小鸡模式下一定会动**，无法复现"冻结"。逐秒采样证据（小鸡模式，精确点击角色按钮后按方向键开局）：
  - 修前探针（游戏进了局）：`ex,ey` 每秒都在变——`(0,-33.7)→(5.5,-18.7)→(9.9,-3.8)→(2.4,-9.6)→…`，`targetId` 在 4/5 间切换，`dashLeft` 周期性 >0（在扑击）。6 个不同种子跑"开局后玩家站定 4 秒"，老鹰位移 60~128 单位，**0 次冻结**。
  - 也就是说上一轮（第 2 轮）那条 `pickTarget` 全脱链兜底 + sim 回归测试**确实生效了**，Bug A 的"sim 内老鹰发呆"已经不存在。
- **真凶**：老鹰"看起来冻结"其实是**开局门没触发**——游戏卡在 `waiting`，此时 `simTick` 直接 early-return，**老鹰和计时一起冻着**。旧门 `GameScene.update()` 用 `InputController.moved`（keydown 边沿累积标志）判断是否开局：`moved` 只在每渲染帧的 `sample()` 里置真，若一次"按下→松开"整段落在两帧之间（真机键盘/OS 键repeat 时序完全可能），`sample()` 那一刻 `isDown` 已回落，`moved` 永远不为真 → 永远不 `startPlay`。探针实证：`page.keyboard.press`（瞬时按放）后 sim 长期停在 `phase=waiting`、`eagle` 冻在出生点 `(0,-106.5)`、计时不走。这正是 Bug B 描述的机制，两个 bug 同一个根。
  - （打回截图里"计时在走"很可能来自第 2 轮修 sim **之前**的旧构建，与本轮 src 无关；本轮已无法再造出"计时走+老鹰冻"这个组合。）

### 🐛 Bug B（必修）「按移动键开始」的启动门吃按键 → 已修
- **现象**：点"开始游戏"后立刻按住 d 600ms 松开，游戏永远停在待机页（连倒计时都不走）。
- **修法**：开局门从"监听 keydown 边沿（`moved` 标志）"改成"**轮询当前是否有移动键处于按下状态**"。
  - `input.ts` 新增 `moveHeld()`：直接读 8 个移动键（方向键 + WASD）的 `isDown`，任一为真即返回真。
  - `GameScene.update()` 的开局判断从 `this.controls.moved` 换成 `this.controls.moveHeld()`。只要按住跨过**任意一帧**就能进局，对边沿丢失免疫。
- **真浏览器验证**：Max 的原样复现（母鸡模式，点开始后立刻按住 d / ArrowRight 600ms 再松）——修后 `phase=playing`、计时 87/86.9 在走、老鹰在动。生产 dist（8861）同样通过，无 pageerror。
  - 说明：真正瞬时的 `keyboard.press`（按放都在一帧之前完成、完全不与任何帧重叠）物理上无法被任何"轮询/边沿"检测到——但真人 600ms 长按跨 ~36 帧，轮询必然抓到，故此修对真机足够稳。

### ✅ 顺手：母鸡模式 HUD「已抓/存活」联动
- 真浏览器 40 样本连续核对：已抓 `0→1→2` 恒等于 `sim.score`，存活 `6→5→4` 恒等于 `chicks.length`，两数之和恒为 6，**0 个不一致样本**。联动正确（沿用第 2 轮结论，未改逻辑）。

### ✅ 验收
- `npm test`：23 passed（未减）。Bug A 的 sim 侧回归（player=chick 老鹰位移>0 / 全脱链仍追）本就在 `tests/sim.test.ts` 且绿。
  - 说明：Bug B 的修复点在 `InputController.moveHeld()`（render 层、依赖 Phaser）。为它写的单测需 `window`（Phaser 依赖 DOM），而本仓库 vitest 跑在 node 环境、未装 jsdom/happy-dom，**按铁律不新增依赖**故未落单测；本轮核心证据本就要求来自真浏览器，已用 Playwright 逐秒采样坐标作证。
- `npm run build`：通过（`__game` 探针钩子已还原为 `import.meta.env.DEV` 守卫，生产 bundle 里确认无 `__game`）。
- 生产 dist 冒烟截图：菜单 + 母鸡局画面正常（成链、蹲下蓝环三重信号、HUD 齐全，无粉屏/空白），无 pageerror。
- 无新增玩家文案，本轮不涉及字体子集。未 git init、未部署、未装新依赖。

---

## 第 2 轮 · 2026-07-03 · 无头实测反馈修复

### 🐛 Bug 1（必修）老鹰在小鸡模式下发呆 → 已修
- **现象**：选「小鸡」角色开局，老鹰像素坐标长时间一动不动（母鸡在动、计时在走，唯独老鹰不动）。
- **根因**：`eagleAI.pickTarget()` 只在**活链**小鸡里挑目标；当整条链全部脱链（`detached=true`）时返回 `null`，老鹰收到零向量输入 → 原地冻结。玩家操小鸡时 `chickSteerWeight=0.65` 会大力甩链，比 AI 自动跟跑更容易把小鸡整批甩脱，于是这个边角被玩家触发。
  - 补充：`sim` 层的角色分派本身没问题（实测 live `playerRole===2` 与场景 role 一致），也不是"AI 控制器没挂上"——纯粹是目标选择在全脱链时无兜底。
- **修法**：`pickTarget` 全脱链时兜底盯**离老鹰最近的小鸡**（`nearestChick`，不管脱没脱链）。脱链小鸡正跑回队尾，老鹰蹲点截胡而不是发呆。决定论安全（纯遍历、无随机）。
- **回归测试**：`tests/sim.test.ts` 新增两条——① player=chick 跑 300 tick 后老鹰位移 > 0；② 每帧强制全脱链时老鹰位移仍 > 0。

### 🐛 Bug 2（必修）HUD「存活」数——排查结论：代码本就正确，未改逻辑，补了回归测试
- **现象报告**：母鸡模式抓走一只（已抓 1/3）后顶栏仍显示「存活 6」。
- **排查**：`rules.ts` 抓到时 `s.chicks.splice(i,1)` + `score++` 是同一代码块原子发生；HUD `updateHUD` 直接读 `s.chicks.length`。
  - 单元测试证明 catch → `chicks.length` 精确 6→5；
  - 且在**当前 dist 的 live 游戏**里驱动真实 `update()` 抓捕，HUD 实时刷新为「已抓 1/3・存活 5」→「2/3・存活 4」，**存活数确实随抓捕递减**。
  - 结论：现有代码没有"状态没减/HUD 读错字段"的问题，未做逻辑改动（对正确代码硬改反而有破坏风险）。观察到的「存活 6」最可能是无头截图的刷新时机/跨图误读；若线上仍可稳定复现，请给出可复现的操作序列，再定位渲染侧。
- **回归测试**：`tests/rules.test.ts` 新增——连抓两只，`chicks.length` 每次精确减一且与 `score` 同步（守住 HUD 数据源）。

### ✨ 观察项（顺手）小鸡静止分离——已加
- **现象**：母鸡静止时 6 只小鸡叠成一坨（只拉不压的约束下静止聚堆是必然的；运动中的鞭甩弧线是对的、保留）。
- **修法**：`chickAI.ts` 新增 `separationStep`——给**低速（≈静止）**的活链小鸡一个极小互推力，温和撑到 `chickSeparationRadius`。**只在低速生效**（速度 > `chickSeparationMaxSpeed` 完全不触发）→ 运动中的链跑/鞭甩一律不碰。成对对称推、先算后写，不依赖遍历顺序，决定论安全。
- **新增 config**（进 `config.ts`）：`chickSeparationRadius=4`、`chickSeparationForce=26`、`chickSeparationMaxSpeed=10`。
- **测试**：`tests/chickAI.test.ts`——① 堆一坨的低速小鸡被撑开（最近对间距变大）；② 高速小鸡位置不被分离改动（鞭甩不受干扰）。
- **实测**：母鸡站定 200 tick 后 6 只小鸡分散排开（最小对间距 ≈2.9，非零聚堆），截图确认成链有间距。

### ✅ 验收
- `npm test`：23 passed（原 18 + 新 5）。
- `npm run build`：通过（>500kB 警告是 Phaser 包体，非本轮引入）。
- 决定论测试（同种子逐 tick 复现）仍绿——分离/兜底均未破坏可复现性。
- 无新增玩家文案，本轮不涉及字体子集。

---

## 第 1 轮 · 从零搭出可玩原型（据本轮开工时的仓库状态回述）

> 上一轮收尾报告因连接中断丢失，这里据当前代码/测试反推当时产出，供对照。

- **架构落地**：`src/sim/` 纯数据 60Hz 固定步长模拟（禁 Phaser/DOM/Math.random，内置种子 RNG，决定论——多人联机地基）；`src/render/` Phaser 只读画面；`src/ui/` DOM 蒙层。
- **鸡链**（`chain.ts`）：行为层（各自跟跑、队尾提速造鞭甩）+ 位置投影硬约束（只拉不压、slack 留弧线余量、relax 半松弛保鞭梢）+ 渐进过载脱链/自动重连。
- **三方 AI**：老鹰（盯队尾、僵局机动破局）、母鸡（远遛弯近卡位、翅膀开合）、小鸡自保（躲避推力 + 极近自动蹲下）。
- **规则**（`rules.ts`）：抓捕四道门（扑击中/冷却/贴住/蹲下免抓/妈妈庇护）、计时、胜负。
- **三角色可玩**：老鹰/母鸡/小鸡（队尾）皆可玩；菜单 → 开局说明（冻结）→ 移动键开局 → HUD → 结算。
- **测试**：18 条（决定论、生命周期、鞭甩 smoke、链约束只拉不压、脱手判据、抓捕四门、庇护、胜负）。

### ⚠️ 已知遗留（第 1 轮留下、本轮未处理）
- **字体子集未做**：CLAUDE.md/提示词沿用 Unity 版「新增文案后重跑字体子集」铁律，但 Web 版**没有 `Tools/gen_font.py`、没有像素字体资产**，CSS 走系统 `Courier New`/monospace。目前中文渲染正常（截图确认），但铁律 #5 的工具链尚未搭建——若日后换像素中文字体，需先建子集工具。
- **部署未做**：`Tools/deploy.sh`、GitHub Pages（`maxi-max-dev/chicken-chase`）尚未接入；本轮按要求不 git init / 不部署。云端正式链接实测（铁律 #3）待部署后补。
- **build 包体大**：Phaser 全量打进单 chunk（~1.5MB / gzip ~346KB），未做 code-split。原型阶段可接受。
- **移动端**：需键盘，`strings.pageMobile` 已有提示文案但未做触屏操作方案。
