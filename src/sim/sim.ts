// 模拟中枢：createSim / startPlay / simTick。
// simTick 每次原地推进一个固定步长（cfg.dt）。渲染层只读产出的 SimState。
// 输入来源：玩家角色用外部 InputFrame，其余角色由内部 AI 生成同构输入。

import type { SimState, SimConfig, SimInputs, Role, InputFrame, Vec } from './types'
import { clampToArena, norm } from './vec'
import { chainTick } from './chain'
import { chickAITick } from './chickAI'
import { henAIDecide } from './henAI'
import { eagleAIDecide } from './eagleAI'
import { rulesTick } from './rules'

function zeroInput(): InputFrame {
  return { move: { x: 0, y: 0 }, action: false }
}

export function createSim(cfg: SimConfig, playerRole: Role, seed: number): SimState {
  const chicks = []
  // 链头在母鸡正下方，依次向下排开
  for (let i = 0; i < cfg.chickCount; i++) {
    chicks.push({
      id: i,
      pos: { x: 0, y: (i + 1) * cfg.chickSpacing },
      vel: { x: 0, y: 0 },
      facing: Math.PI / 2,
      detached: false,
      overload: 0,
      reattachGrace: cfg.buildGrace,
      crouchLeft: 0,
      crouchCooldown: 0,
    })
  }

  return {
    tick: 0,
    phase: 'waiting',
    winner: 'none',
    timeLeft: cfg.roundSeconds,
    score: 0,
    playerRole,
    eagle: {
      pos: { x: 0, y: -cfg.arenaH / 2 + 30 },
      vel: { x: 0, y: 0 },
      facing: Math.PI / 2,
      dashLeft: 0,
      dashCooldown: 0,
      catchCooldown: 0,
    },
    hen: {
      pos: { x: 0, y: 20 },
      facing: -Math.PI / 2,
      wingsOpen: false,
      wingT: 0,
    },
    chicks,
    henAI: { wanderTarget: { x: 0, y: 0 }, wanderTimer: 0 },
    eagleAI: {
      targetId: -1,
      retargetTimer: 0,
      bestDist: Infinity,
      stuckTimer: 0,
      maneuver: 0,
      maneuverTimer: 0,
      maneuverPoint: { x: 0, y: 0 },
      maneuverCommit: false,
      flankSign: 1,
    },
    events: [],
    rngState: seed | 0,
  }
}

export function startPlay(s: SimState): void {
  if (s.phase === 'waiting') s.phase = 'playing'
}

// ---- 各角色物理推进 ----

function stepEagle(s: SimState, cfg: SimConfig, input: InputFrame): void {
  const e = s.eagle
  if (e.dashCooldown > 0) e.dashCooldown = Math.max(0, e.dashCooldown - cfg.dt)
  if (e.dashLeft > 0) e.dashLeft = Math.max(0, e.dashLeft - cfg.dt)

  // 触发扑击（边沿）：冷却好 + 有方向
  const dir = norm(input.move)
  const hasDir = Math.hypot(dir.x, dir.y) > 1e-6
  if (input.action && e.dashCooldown <= 0 && e.dashLeft <= 0 && hasDir) {
    e.dashLeft = cfg.dashDuration
    e.dashCooldown = cfg.dashCooldown
    s.events.push({ kind: 'dash' })
  }

  const speed = e.dashLeft > 0 ? cfg.eagleSpeed * cfg.dashMultiplier : cfg.eagleSpeed
  // 冲刺中锁朝向（用当前 facing 方向冲）；否则跟输入
  let mv: Vec
  if (e.dashLeft > 0) {
    mv = { x: Math.cos(e.facing), y: Math.sin(e.facing) }
  } else {
    mv = hasDir ? dir : { x: 0, y: 0 }
    if (hasDir) e.facing = Math.atan2(dir.y, dir.x)
  }
  e.vel = { x: mv.x * speed, y: mv.y * speed }
  e.pos.x += e.vel.x * cfg.dt
  e.pos.y += e.vel.y * cfg.dt
  clampToArena(e.pos, cfg.arenaW / 2, cfg.arenaH / 2, cfg.eagleRadius)
}

function stepHen(s: SimState, cfg: SimConfig, input: InputFrame): void {
  const h = s.hen
  // 翅膀切换（边沿）
  if (input.action) h.wingsOpen = !h.wingsOpen
  // 开合动画渐变
  const target = h.wingsOpen ? 1 : 0
  const rate = cfg.dt / cfg.wingAnimTime
  if (h.wingT < target) h.wingT = Math.min(target, h.wingT + rate)
  else if (h.wingT > target) h.wingT = Math.max(target, h.wingT - rate)

  const dir = norm(input.move)
  const hasDir = Math.hypot(dir.x, dir.y) > 1e-6
  const speedMult = h.wingsOpen ? cfg.wingOpenSpeedMult : cfg.wingClosedSpeedMult
  const speed = cfg.henSpeed * speedMult
  if (hasDir) {
    h.pos.x += dir.x * speed * cfg.dt
    h.pos.y += dir.y * speed * cfg.dt
    h.facing = Math.atan2(dir.y, dir.x)
  }
  clampToArena(h.pos, cfg.arenaW / 2, cfg.arenaH / 2, cfg.henRadius)
}

/** 推进一个固定步长。 */
export function simTick(s: SimState, cfg: SimConfig, inputs: SimInputs): void {
  s.events = []
  if (s.phase !== 'playing') {
    s.tick++
    return
  }

  // 分派输入：玩家角色用外部输入，其余用 AI
  const eagleIn = s.playerRole === 0 ? inputs.eagle : eagleAIDecide(s, cfg)
  const henIn = s.playerRole === 1 ? inputs.hen : henAIDecide(s, cfg)
  const chickIn = s.playerRole === 2 ? inputs.chick : zeroInput()

  // 顺序：老鹰/母鸡先动 → 链跟跑+约束 → 小鸡自保 → 规则判定
  stepEagle(s, cfg, eagleIn)
  stepHen(s, cfg, henIn)
  chainTick(s, cfg, chickIn.move)
  chickAITick(s, cfg)
  rulesTick(s, cfg)

  s.tick++
}
