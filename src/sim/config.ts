// 全部手感参数（提示词底线 #2：集中存放，随时可调）。
// 数值口径：世界单位 = 像素。来源是 Unity 版 8 轮调校的米制原值 × PPM 换算，
// 注释里保留米制原值——改手感时先看老值再动，比例关系是 8 轮真人验证的资产。

/** 米 → 像素换算（Unity 版场地 68m ↔ 本版 442px） */
export const PPM = 6.5

/** 固定模拟步长（秒）。渲染帧率与此无关。 */
export const DT = 1 / 60

/** 逻辑画布（像素风基准分辨率，整数放大） */
export const VIEW = { w: 480, h: 320 }

export interface SimConfig {
  dt: number
  // 场地（内沿，墙在外侧）
  arenaW: number
  arenaH: number
  // 老鹰
  eagleSpeed: number
  eagleAccel: number
  dashMultiplier: number
  dashDuration: number
  dashCooldown: number
  eagleRadius: number
  catchRadius: number
  // 母鸡
  henSpeed: number
  henTurnSpeed: number // 弧度/秒
  henRadius: number
  henBlockDistance: number
  henAggression: number // 0=贴链被动 1=顶脸主动
  henEngageRange: number
  henChainDrag: number
  henWanderInterval: number
  henStandoff: number
  // 翅膀（开=挡得宽移速慢，收=窄而快）
  wingOpenSpan: number
  wingClosedSpan: number
  wingOpenSpeedMult: number
  wingClosedSpeedMult: number
  wingAnimTime: number
  wingOpenRange: number // 老鹰距离低于此张开（+迟滞收起）
  wingThickness: number
  // 鸡链
  chickCount: number
  chickSpacing: number // 链节静止长度
  chickRunSpeed: number
  chickRunAccel: number
  chainIterations: number // 距离约束迭代次数（只拉不压）
  chainMaxCorrection: number // 每次迭代单点最大位移钳制
  chainSlack: number // 允许的自然松弛比：约束把节拉回到 spacing×(1+slack) 而非死贴 spacing（留出鞭甩的弧线余量）
  chainRelax: number // 约束松弛系数 0..1：每次迭代只回拉这个比例（<1 保留惯性甩出的弧，鞭梢手感的来源）
  tailSpeedAmplify: number // 队尾目标速度放大（鞭甩弧线的来源）
  chickRadius: number
  // 小鸡自保
  chickEvadeForce: number
  chickEvadeRadius: number
  // 小鸡互相分离（只在低速≈静止时生效，防止母鸡站着不动时 6 只叠成一坨；绝不干扰运动中的鞭甩弧线）
  chickSeparationRadius: number // 小于此间距才互推
  chickSeparationForce: number // 分离推力（米制加速度口径，同 evadeForce）
  chickSeparationMaxSpeed: number // 小鸡速度超过此值就不推（运动中不生效 → 鞭甩不受影响）
  crouchDuration: number
  crouchCooldown: number
  crouchTriggerRadius: number
  chickSteerWeight: number // 玩家操作 vs 跟跑本能的混合权重
  // 脱手（渐进过载，不要瞬时判定）
  overloadStretch: number // 拉伸比阈值
  overloadDuration: number
  regrabRadius: number
  detachedChickSpeed: number
  buildGrace: number // 开局保护期（秒），不判脱链
  // 抓捕规则
  catchRequiresDash: boolean
  catchCooldown: number
  // 回合
  roundSeconds: number
  catchesToWin: number
}

export const defaultConfig: SimConfig = {
  dt: DT,
  arenaW: 442, // 68m
  arenaH: 273, // 42m

  eagleSpeed: 49, // 7.5 m/s
  eagleAccel: 260, // 40 m/s²
  dashMultiplier: 2.2,
  dashDuration: 0.28,
  dashCooldown: 2.0,
  eagleRadius: 3, // 0.42m
  catchRadius: 5, // 0.75m 触发半径

  henSpeed: 39, // 6 m/s
  henTurnSpeed: Math.PI * 2.4, // 240°/s ≈ 4.2 rad/s
  henRadius: 3.5, // 0.5m
  henBlockDistance: 9, // 1.4m
  henAggression: 0.5,
  henEngageRange: 91, // 14m
  henChainDrag: 0.5,
  henWanderInterval: 4,
  henStandoff: 14, // 2.2m

  wingOpenSpan: 20, // 3m
  wingClosedSpan: 8, // 1.2m
  wingOpenSpeedMult: 0.55,
  wingClosedSpeedMult: 1.0,
  wingAnimTime: 0.25,
  wingOpenRange: 46, // 7m（收起阈值 = 此值+13px 迟滞）
  wingThickness: 2,

  chickCount: 6,
  chickSpacing: 5.5, // 0.85m
  chickRunSpeed: 52, // 8 m/s
  chickRunAccel: 228, // 35 m/s²
  chainIterations: 4, // 2D 单链便宜，多迭代换稳定（Unity 版 3 子步×2 迭代）
  chainMaxCorrection: 2.3, // 0.35m
  chainSlack: 0.45, // 静止长度上再放 45% 才开始硬拉——鞭甩弧线的物理空间
  chainRelax: 0.5, // 半松弛：不一帧拉死，让队尾惯性甩出再收
  tailSpeedAmplify: 0.35,
  chickRadius: 1.8, // 0.28m

  chickEvadeForce: 65, // 10 m/s²
  chickEvadeRadius: 26, // 4m
  chickSeparationRadius: 4, // ≈0.6m：略小于 chickSpacing(5.5)，只在真挤成一坨时才互推
  chickSeparationForce: 26, // 4 m/s²：比 evadeForce 弱得多，只做温和撑开
  chickSeparationMaxSpeed: 10, // 世界单位/秒：低于此才算"静止"，运动中(链跑 50+/s)完全不触发
  crouchDuration: 1,
  crouchCooldown: 10,
  crouchTriggerRadius: 14, // 2.2m
  chickSteerWeight: 0.65,

  overloadStretch: 1.6,
  overloadDuration: 0.2,
  regrabRadius: 6.5, // 1m
  detachedChickSpeed: 36, // 5.5 m/s
  buildGrace: 2,

  catchRequiresDash: true,
  catchCooldown: 1.2,

  roundSeconds: 90,
  catchesToWin: 3,
}

/** 调参面板读写的就是这一份（对局中实时生效） */
export const liveConfig: SimConfig = { ...defaultConfig }

// ============================================================================
// 渲染侧参数（⚠️ 不进 sim！仅供 src/render 使用，不参与决定论、不影响联机复现）
// 放这里只是沿用「参数集中」的习惯，逻辑上和上面的 SimConfig 完全隔离。
// ============================================================================

/** 动态镜头：每帧框住所有活动角色的包围盒，平滑缩放/平移。纯渲染，不碰 sim。 */
export const CAMERA = {
  /** 包围盒四周留白（世界像素，未经 SCALE）——越大画面越松 */
  margin: 46,
  /** zoom 下限（拉最远，角色散得开时）——1 = 逻辑像素 1:1 到屏幕放大后 */
  minZoom: 1.0,
  /** zoom 上限（拉最近，角色聚一坨时）——越大越贴脸 */
  maxZoom: 2.1,
  /** 每帧向目标插值的系数（0..1，越小越平滑越跟手慢；防抖靠它） */
  lerp: 0.08,
} as const

/** 场地质感：程序生成的草丛/碎花装饰。种子固定 → 每局图案一致，纯渲染 RNG。 */
export const TERRAIN = {
  /** 装饰 RNG 种子（固定，别每局乱跳） */
  seed: 0x9e3779b9,
  /** 每 100×100 世界像素铺多少个装饰点（低密度，别抢角色） */
  density: 0.010,
  /** 草丛/碎花色板（对比弱，融进浅色草地） */
  colors: ['#b9dd8e', '#a9d17b', '#c6e6a6', '#e3c85a', '#d98fb0'],
} as const
