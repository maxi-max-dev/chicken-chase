// 鸡链：整个游戏的灵魂（提示词底线 #3）。
// 分三步：① 行为层——每只小鸡主动朝"前一节"跑（活物，各自限速，队尾提速造鞭甩）
//        ② 约束层——位置投影硬约束，只拉不压，绝不用弹簧（滞后会把小鸡甩到妈妈前面穿模）
//        ③ 脱链/重连——持续过载 0.2s 才脱手（瞬时会误伤），脱手的自己跑回队尾重连。
// 链序：chicks[0]=链头（跟母鸡），末位=队尾。detached 的小鸡不参与约束、单独跑回。

import type { SimState, SimConfig, Vec, ChickState } from './types'
import { dist, norm, sub, scale, approach, clampToArena } from './vec'

/** 某小鸡的"锚点"：链头锚母鸡，其余锚前一只（跳过已脱链的前节 → 锚更靠前的活节或母鸡） */
function anchorPos(s: SimState, idx: number): Vec {
  for (let j = idx - 1; j >= 0; j--) {
    if (!s.chicks[j].detached) return s.chicks[j].pos
  }
  return s.hen.pos
}

/** 队尾提速：越靠队尾目标速度越高，末位吃满 tailSpeedAmplify（鞭甩弧线来源） */
function speedCapFor(idx: number, activeCount: number, cfg: SimConfig): number {
  if (activeCount <= 1) return cfg.chickRunSpeed
  const frac = idx / (activeCount - 1) // 0=头 1=尾
  return cfg.chickRunSpeed * (1 + cfg.tailSpeedAmplify * frac)
}

/**
 * 行为层：每只活链小鸡朝锚点跑，保持 chickSpacing 静止距离。
 * 玩家小鸡（队尾）把玩家 move 以 chickSteerWeight 混进跟跑本能。
 */
function behaviorStep(s: SimState, cfg: SimConfig, playerChickMove: Vec): void {
  const active = s.chicks.filter((c) => !c.detached)
  const activeCount = active.length
  const tailIdx = s.chicks.length - 1

  for (let i = 0; i < s.chicks.length; i++) {
    const c = s.chicks[i]
    if (c.detached) {
      detachedStep(s, cfg, c)
      continue
    }
    const anchor = anchorPos(s, i)
    const toAnchor = sub(anchor, c.pos)
    const d = Math.hypot(toAnchor.x, toAnchor.y)
    const dir = norm(toAnchor)

    // 期望方向：距离 > 静止长度就追锚点；否则松弛（保持不主动压近）
    let desiredDir: Vec = { x: 0, y: 0 }
    if (d > cfg.chickSpacing) desiredDir = dir

    // 玩家小鸡（队尾）：混入玩家输入
    const isPlayerTail = s.playerRole === 2 && i === tailIdx
    if (isPlayerTail) {
      const w = cfg.chickSteerWeight
      desiredDir = {
        x: desiredDir.x * (1 - w) + playerChickMove.x * w,
        y: desiredDir.y * (1 - w) + playerChickMove.y * w,
      }
    }

    const cap = speedCapFor(i, activeCount, cfg)
    const target = scale(norm(desiredDir), Math.hypot(desiredDir.x, desiredDir.y) > 1e-6 ? cap : 0)
    c.vel = approach(c.vel, target, cfg.chickRunAccel, cfg.dt)
    c.pos.x += c.vel.x * cfg.dt
    c.pos.y += c.vel.y * cfg.dt
    if (Math.hypot(c.vel.x, c.vel.y) > 1e-3) c.facing = Math.atan2(c.vel.y, c.vel.x)
    clampToArena(c.pos, cfg.arenaW / 2, cfg.arenaH / 2, cfg.chickRadius)
  }
}

/** 脱链小鸡：直奔当前队尾锚点（母鸡或最后一只活节），到重连半径内重连 */
function detachedStep(s: SimState, cfg: SimConfig, c: ChickState): void {
  // 目标 = 最后一只活链小鸡；没有活节则母鸡
  let target: Vec = s.hen.pos
  for (let j = s.chicks.length - 1; j >= 0; j--) {
    const o = s.chicks[j]
    if (!o.detached && o.id !== c.id) {
      target = o.pos
      break
    }
  }
  const dir = norm(sub(target, c.pos))
  c.vel = approach(c.vel, scale(dir, cfg.detachedChickSpeed), cfg.chickRunAccel, cfg.dt)
  c.pos.x += c.vel.x * cfg.dt
  c.pos.y += c.vel.y * cfg.dt
  if (Math.hypot(c.vel.x, c.vel.y) > 1e-3) c.facing = Math.atan2(c.vel.y, c.vel.x)
  clampToArena(c.pos, cfg.arenaW / 2, cfg.arenaH / 2, cfg.chickRadius)

  if (dist(c.pos, target) <= cfg.regrabRadius) {
    c.detached = false
    c.overload = 0
    c.reattachGrace = cfg.buildGrace
    s.events.push({ kind: 'reattach', chickId: c.id })
  }
}

/**
 * 约束层：位置投影，只拉不压（超出静止长度才回拉，短了不管）。
 * 迭代若干次收敛。锚点（母鸡/前节）视为质量无穷，只移动本节 → 保证不把小鸡甩到妈妈前面。
 */
function constrainStep(s: SimState, cfg: SimConfig): void {
  // 硬拉的起点不是静止长度，而是 spacing×(1+slack)：静止长度以内交给行为层，
  // slack 区间是队尾惯性甩出的弧线空间，超出 slack 才用 relax 松弛系数缓拉回（不一帧拉死 → 鞭梢）。
  const leash = cfg.chickSpacing * (1 + cfg.chainSlack)
  for (let iter = 0; iter < cfg.chainIterations; iter++) {
    for (let i = 0; i < s.chicks.length; i++) {
      const c = s.chicks[i]
      if (c.detached) continue
      const anchor = anchorPos(s, i)
      const dx = c.pos.x - anchor.x
      const dy = c.pos.y - anchor.y
      const d = Math.hypot(dx, dy)
      if (d <= leash || d < 1e-6) continue // 只拉不压，且 slack 内不拉
      const over = d - leash
      const corr = Math.min(over, cfg.chainMaxCorrection) * cfg.chainRelax
      const k = corr / d
      c.pos.x -= dx * k
      c.pos.y -= dy * k
    }
  }
}

/**
 * 脱链/重连判定：拉伸比 = 当前链节距离 / 静止长度。
 * 超过 overloadStretch 且持续 overloadDuration 才脱手；未过载则过载计时清零。
 * reattachGrace / buildGrace 期内跳过判定。
 */
function detachStep(s: SimState, cfg: SimConfig): void {
  for (let i = 0; i < s.chicks.length; i++) {
    const c = s.chicks[i]
    if (c.reattachGrace > 0) {
      c.reattachGrace = Math.max(0, c.reattachGrace - cfg.dt)
      c.overload = 0
      continue
    }
    if (c.detached) continue

    const anchor = anchorPos(s, i)
    const d = dist(c.pos, anchor)
    const stretch = d / cfg.chickSpacing
    if (stretch > cfg.overloadStretch) {
      c.overload += cfg.dt
      if (c.overload >= cfg.overloadDuration) {
        c.detached = true
        c.overload = 0
        s.events.push({ kind: 'detach', chickId: c.id })
      }
    } else {
      c.overload = 0
    }
  }
}

/** 一个 tick 的完整链更新（行为 → 约束 → 脱链/重连） */
export function chainTick(s: SimState, cfg: SimConfig, playerChickMove: Vec): void {
  behaviorStep(s, cfg, playerChickMove)
  constrainStep(s, cfg)
  detachStep(s, cfg)
}

/** 测试与 AI 用：当前最大链节拉伸比（活链节 距离/静止长度 的最大值；无活节返回 0） */
export function maxStretch(s: SimState, cfg: SimConfig): number {
  let m = 0
  for (let i = 0; i < s.chicks.length; i++) {
    const c = s.chicks[i]
    if (c.detached) continue
    const anchor = anchorPos(s, i)
    const stretch = dist(c.pos, anchor) / cfg.chickSpacing
    if (stretch > m) m = stretch
  }
  return m
}

/** 便于渲染/AI 取"当前活链队尾" */
export function tailChick(s: SimState): ChickState | null {
  for (let j = s.chicks.length - 1; j >= 0; j--) {
    if (!s.chicks[j].detached) return s.chicks[j]
  }
  return null
}
