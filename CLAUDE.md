# chicken-chase 工作规则

《老鹰抓小鸡》像素风 Web 版。**先读 [提示词.md](提示词.md)——它是整个游戏的源头，改游戏先改它再改代码。**

## 技术栈与架构
- TypeScript + Phaser 3 + Vite，vitest 测试。像素风：`pixelArt: true`，逻辑分辨率 480×320 整数放大。
- **`src/sim/` 是纯数据模拟，禁止 import Phaser / DOM / Math.random**——固定步长 60Hz，内置种子 RNG，同种子同输入必须逐 tick 复现（有测试盯着）。这是提示词三条底线的第一条，多人联机的命根。
- `src/render/` Phaser 场景只读 sim 状态画画面；`src/ui/` DOM 蒙层（菜单/HUD/结算/调参面板）。
- 手感参数全在 `src/sim/config.ts`（注释标着 Unity 版米制原值，PPM=6.5 换算）；玩家文案全在 `src/strings.ts`。

## 验收铁律（Unity 版 8 轮血泪沉淀，一条都不许省）
1. `npm test` 全绿才算实现完。
2. 构建后必须亲眼看截图/录屏——日志零报错≠画面正常。
3. 网页发布后必须开**云端正式链接**实测，本地 dev server 不算数。
4. 每轮更新 CHANGELOG.md（中文，写清"为什么"）。
5. 新增玩家文案后重跑字体子集（像素中文字体子集缺字=静默空白）。
6. 报告用 emoji 锚点+短段+表格；没验到的事老实标注。

## 部署
- 构建产物推到 GitHub repo `maxi-max-dev/chicken-chase`（Pages），脚本 `Tools/deploy.sh`。
- Vite 文件名自带哈希=缓存天然失效（Unity 版的 ?v= 手工缓存戳不需要了）。
- GoatCounter 埋点仅 github.io 域注入，页面不可见。

## 上一版资产
Unity 原型 `~/Documents/chicken-chain`（云端 maxi-max-dev.github.io/chicken-chain 保持可玩）；其 8 轮学习成果存档在该仓库 `docs/Unity版总提示词-r8存档.md`。
