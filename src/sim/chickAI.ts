// 小鸡自保 AI：老鹰逼近时给链上小鸡一个躲避推力（叠加进位置，链约束随后收敛），
// 并在极近距离自动蹲下免抓（含玩家小鸡的兜底自动蹲）。蹲下有冷却。
// 注意：躲避是推位置不是改跟跑目标——保持"活物跟跑 + 被推让"的混合手感。

import type { SimState, SimConfig } from './types'
import { dist, norm, sub, scale } from './vec'

/**
 * 静止分离：母鸡站着不动时 6 只小鸡会叠成一坨（只拉不压的链约束下静止聚堆是必然的）。
 * 给低速（≈静止）的活链小鸡一个极小的互推力把它们温和撑到 chickSeparationRadius。
 * 只在低速生效 → 运动中的鞭甩弧线（队尾速度 50+/s）完全不受影响，链的灵魂不动。
 * 决定论：纯遍历、无随机；对称成对推、先算后写（不依赖遍历顺序）。
 */
function separationStep(s: SimState, cfg: SimConfig): void {
  const n = s.chicks.length
  const push = s.chicks.map(() => ({ x: 0, y: 0 }))
  const r = cfg.chickSeparationRadius
  const maxV = cfg.chickSeparationMaxSpeed
  for (let i = 0; i < n; i++) {
    const a = s.chicks[i]
    if (a.detached) continue
    for (let j = i + 1; j < n; j++) {
      const b = s.chicks[j]
      if (b.detached) continue
      const d = dist(a.pos, b.pos)
      if (d >= r || d < 1e-4) continue
      // 越挤推越强（线性衰减到 0）
      const strength = (1 - d / r) * cfg.chickSeparationForce * cfg.dt
      const dir = norm(sub(a.pos, b.pos))
      push[i].x += dir.x * strength
      push[i].y += dir.y * strength
      push[j].x -= dir.x * strength
      push[j].y -= dir.y * strength
    }
  }
  for (let i = 0; i < n; i++) {
    const c = s.chicks[i]
    if (c.detached) continue
    // 只在低速（≈静止）时应用——运动中的鞭甩一律不碰
    if (Math.hypot(c.vel.x, c.vel.y) > maxV) continue
    c.pos.x += push[i].x
    c.pos.y += push[i].y
  }
}

export function chickAITick(s: SimState, cfg: SimConfig): void {
  separationStep(s, cfg)
  for (const c of s.chicks) {
    // 冷却/蹲下计时
    if (c.crouchLeft > 0) c.crouchLeft = Math.max(0, c.crouchLeft - cfg.dt)
    if (c.crouchCooldown > 0) c.crouchCooldown = Math.max(0, c.crouchCooldown - cfg.dt)
    if (c.detached) continue

    const dEagle = dist(c.pos, s.eagle.pos)

    // 躲避推力：老鹰进 evadeRadius，沿远离方向推（越近越强）
    if (dEagle < cfg.chickEvadeRadius && dEagle > 1e-3) {
      const away = norm(sub(c.pos, s.eagle.pos))
      const strength = (1 - dEagle / cfg.chickEvadeRadius) * cfg.chickEvadeForce
      const push = scale(away, strength * cfg.dt)
      c.pos.x += push.x
      c.pos.y += push.y
    }

    // 自动蹲下（含玩家小鸡兜底）：极近 + 冷却好 + 老鹰正冲刺（威胁最大时）
    if (
      dEagle < cfg.crouchTriggerRadius &&
      c.crouchLeft <= 0 &&
      c.crouchCooldown <= 0 &&
      s.eagle.dashLeft > 0
    ) {
      c.crouchLeft = cfg.crouchDuration
      c.crouchCooldown = cfg.crouchCooldown
      s.events.push({ kind: 'crouch', chickId: c.id })
    }
  }
}
