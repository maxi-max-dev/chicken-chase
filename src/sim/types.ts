// 模拟层共享类型 —— 整个 sim 的数据契约。
// 铁律：本目录禁止 import Phaser / DOM / Math.random（决定论 = 多人联机的命根）。

// SimConfig 定义在 config.ts（数值集中地），这里再导出一次让 sim 各模块统一从类型契约取用。
export type { SimConfig } from './config'

export type Role = 0 | 1 | 2 // 0=老鹰 1=母鸡 2=小鸡(队尾)

export type Phase = 'waiting' | 'playing' | 'result'

export type Winner = 'none' | 'eagle' | 'flock'

export interface Vec {
  x: number
  y: number
}

/** 每 tick 每个受控角色一份输入。AI 角色由 sim 内部 AI 生成同构输入。 */
export interface InputFrame {
  /** 移动方向，已归一化或零向量 */
  move: Vec
  /** 技能键本 tick 是否"刚按下"（边沿触发，不是按住） */
  action: boolean
}

export interface SimInputs {
  eagle: InputFrame
  hen: InputFrame
  /** 玩家小鸡（队尾）的输入；role!=2 时传零输入即可 */
  chick: InputFrame
}

export interface EagleState {
  pos: Vec
  vel: Vec
  /** 朝向弧度（渲染层用，sim 内按速度更新） */
  facing: number
  /** >0 = 冲刺中（剩余秒数） */
  dashLeft: number
  /** >0 = 冲刺冷却中 */
  dashCooldown: number
  /** >0 = 抓捕冷却中（一次俯冲最多得一只） */
  catchCooldown: number
}

export interface HenState {
  pos: Vec
  facing: number
  /** 翅膀目标状态 */
  wingsOpen: boolean
  /** 翅膀开合动画进度 0(收)..1(开)，按 wingAnimTime 渐变 */
  wingT: number
}

export interface ChickState {
  id: number
  pos: Vec
  vel: Vec
  facing: number
  /** 脱链中（变警戒色，自己跑回队尾） */
  detached: boolean
  /** 持续过载累计秒数（达到 overloadDuration 触发脱链） */
  overload: number
  /** 重连后的保护期秒数（>0 跳过脱链判定） */
  reattachGrace: number
  /** >0 = 蹲下中（免抓） */
  crouchLeft: number
  /** >0 = 蹲下冷却中 */
  crouchCooldown: number
}

// ---- AI 内部状态（放进 SimState 保证决定论与可序列化） ----

export interface HenAIState {
  wanderTarget: Vec
  wanderTimer: number
}

export interface EagleAIState {
  /** 当前目标小鸡 id，-1 = 无 */
  targetId: number
  retargetTimer: number
  /** 对当前目标的历史最近距离（僵局检测基准） */
  bestDist: number
  /** 没有显著接近的累计秒数 */
  stuckTimer: number
  /** 0=无机动 1=强攻 2=绕后 */
  maneuver: number
  maneuverTimer: number
  maneuverPoint: Vec
  /** 绕后到位后转入收尾强攻 */
  maneuverCommit: boolean
  /** 绕侧方向 +1/-1，每次换目标/机动结束翻转（固定方向=二人转轨道成因） */
  flankSign: number
}

// ---- 事件：sim 产出、渲染层消费（音效/特效/界面提示），每 tick 开头清空 ----

export type SimEvent =
  | { kind: 'catch'; chickId: number }
  | { kind: 'dash' }
  | { kind: 'crouch'; chickId: number }
  | { kind: 'detach'; chickId: number }
  | { kind: 'reattach'; chickId: number }
  | { kind: 'result'; winner: Winner }

export interface SimState {
  tick: number
  phase: Phase
  winner: Winner
  /** 剩余秒数（仅 playing 相递减） */
  timeLeft: number
  /** 老鹰已抓数 */
  score: number
  playerRole: Role
  eagle: EagleState
  hen: HenState
  /** 链序：[0]=链头（紧跟母鸡）… 末位=队尾。被抓的从数组移除。 */
  chicks: ChickState[]
  henAI: HenAIState
  eagleAI: EagleAIState
  events: SimEvent[]
  /** mulberry32 内部状态，sim 内一切随机走它 */
  rngState: number
}

// ---- 跨模块函数契约（实现分属不同文件，签名必须一字不差） ----
//
// sim.ts:
//   createSim(cfg: SimConfig, playerRole: Role, seed: number): SimState   // 初始 phase='waiting'（全员冻结）
//   startPlay(s: SimState): void                                          // waiting → playing
//   simTick(s: SimState, cfg: SimConfig, inputs: SimInputs): void         // 原地推进一个固定步长（cfg.dt）
//
// rng.ts:
//   rand(s: SimState): number          // [0,1)，推进 s.rngState
//
// chain.ts:
//   chainTick(s: SimState, cfg: SimConfig, playerChickMove: Vec): void    // 行为层+约束层+脱链/重连
//   maxStretch(s: SimState, cfg: SimConfig): number                       // 测试用：当前最大链节距离/restLength
//
// henAI.ts:    henAIDecide(s: SimState, cfg: SimConfig): InputFrame
// eagleAI.ts:  eagleAIDecide(s: SimState, cfg: SimConfig): InputFrame
// chickAI.ts:  chickAITick(s: SimState, cfg: SimConfig): void             // 链上躲避推力 + 自动蹲下（含玩家小鸡的自动蹲）
//
// rules.ts:
//   rulesTick(s: SimState, cfg: SimConfig): void                          // 计时/抓捕判定/胜负（含庇护与蹲下免抓）
