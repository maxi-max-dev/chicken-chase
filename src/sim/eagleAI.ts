// 老鹰 AI：盯队尾小鸡，靠近且冷却好就扑击。
// 破局：3 秒没接近目标（bestDist 不再变小）就机动——直线强攻 or 绕背突击交替；
// 被母鸡严防（母鸡挡在连线上）的目标自动换软柿子。绕侧方向每次翻转（固定方向=二人转轨道成因）。

import type { SimState, SimConfig, InputFrame, Vec, ChickState } from './types'
import { norm, sub, add, scale, segPointDist } from './vec'

/** 母鸡是否严防某小鸡（身体挡在 老鹰→小鸡 连线上） */
function henGuards(s: SimState, cfg: SimConfig, chick: ChickState): boolean {
  const d = segPointDist(s.eagle.pos, chick.pos, s.hen.pos)
  return d < cfg.henRadius + cfg.wingClosedSpan * 0.5
}

/** 队里离老鹰最近的一只（不管脱没脱链）——全脱链时的兜底目标，别让老鹰站着发呆 */
function nearestChick(s: SimState): ChickState | null {
  let best: ChickState | null = null
  let bestD = Infinity
  for (const c of s.chicks) {
    const dx = c.pos.x - s.eagle.pos.x
    const dy = c.pos.y - s.eagle.pos.y
    const d = dx * dx + dy * dy
    if (d < bestD) {
      bestD = d
      best = c
    }
  }
  return best
}

/**
 * 选目标：优先队尾活链小鸡；若被母鸡严防则往前挑一只没被防的。
 * 全脱链（无活链节）时兜底盯最近的脱链小鸡——它们正跑回队尾，老鹰蹲点截胡而不是发呆。
 */
function pickTarget(s: SimState, cfg: SimConfig): ChickState | null {
  const active = s.chicks.filter((c) => !c.detached)
  if (active.length === 0) return nearestChick(s) // 全脱链兜底：追最近的（决定论：nearestChick 无随机）
  // 从队尾往前
  for (let k = active.length - 1; k >= 0; k--) {
    if (!henGuards(s, cfg, active[k])) return active[k]
  }
  // 全被防：就盯队尾（靠机动破）
  return active[active.length - 1]
}

export function eagleAIDecide(s: SimState, cfg: SimConfig): InputFrame {
  const ai = s.eagleAI

  // 目标维护
  ai.retargetTimer -= cfg.dt
  let target = ai.targetId >= 0 ? s.chicks.find((c) => c.id === ai.targetId && !c.detached) ?? null : null
  if (!target || ai.retargetTimer <= 0) {
    const next = pickTarget(s, cfg)
    if (next && (!target || next.id !== target.id)) {
      ai.targetId = next.id
      ai.bestDist = Infinity
      ai.stuckTimer = 0
      ai.maneuver = 0
      ai.flankSign = -ai.flankSign || 1
    }
    target = next
    ai.retargetTimer = 1.0
  }
  if (!target) return { move: { x: 0, y: 0 }, action: false }

  const toTarget = sub(target.pos, s.eagle.pos)
  const d = Math.hypot(toTarget.x, toTarget.y)

  // 僵局检测：有明显接近才刷新 bestDist，否则累计 stuckTimer
  if (d < ai.bestDist - 2) {
    ai.bestDist = d
    ai.stuckTimer = 0
  } else {
    ai.stuckTimer += cfg.dt
  }

  // 破局：3 秒没进展 → 进入机动（强攻 or 绕背二选一交替）
  if (ai.maneuver === 0 && ai.stuckTimer > 3) {
    ai.maneuver = ai.flankSign > 0 ? 2 : 1 // 1=强攻 2=绕背
    ai.maneuverTimer = 1.2
    ai.maneuverCommit = false
    // 绕背点：目标背向老鹰的侧后方
    const away = norm(sub(target.pos, s.eagle.pos))
    const perp = { x: -away.y * ai.flankSign, y: away.x * ai.flankSign }
    ai.maneuverPoint = add(target.pos, scale(perp, cfg.henStandoff * 1.4))
  }

  let moveDir: Vec
  if (ai.maneuver === 2 && !ai.maneuverCommit) {
    // 绕背：先跑到侧后点
    ai.maneuverTimer -= cfg.dt
    const toPoint = sub(ai.maneuverPoint, s.eagle.pos)
    if (Math.hypot(toPoint.x, toPoint.y) < 8 || ai.maneuverTimer <= 0) {
      ai.maneuverCommit = true // 到位 → 收尾强攻
      ai.stuckTimer = 0
      ai.bestDist = Infinity
    }
    moveDir = norm(toPoint)
  } else {
    // 强攻 / 常规：直奔目标
    moveDir = norm(toTarget)
    if (ai.maneuver !== 0) {
      ai.maneuverTimer -= cfg.dt
      if (ai.maneuverTimer <= 0) {
        ai.maneuver = 0
        ai.flankSign = -ai.flankSign // 下次机动换方向
        ai.stuckTimer = 0
        ai.bestDist = d
      }
    }
  }

  // 扑击：冷却好 + 在合适距离（catchRadius..dash 冲程）时触发
  const dashReach = cfg.eagleSpeed * cfg.dashMultiplier * cfg.dashDuration
  const wantDash =
    s.eagle.dashCooldown <= 0 &&
    s.eagle.dashLeft <= 0 &&
    d < dashReach * 0.95 &&
    d > cfg.catchRadius * 0.5
  return { move: moveDir, action: wantDash }
}
