// 规则层：计时、抓捕判定、胜负。
// 抓捕四道门：① 老鹰必须正在扑击（catchRequiresDash）② 抓捕冷却好
//           ③ 碰到小鸡（catchRadius 内）④ 蹲下免抓 ⑤「妈妈的庇护」母鸡身体挡在连线上无效。
// 抓到：小鸡移除、score++、抓捕冷却 catchCooldown（一次俯冲最多一只）。
// 胜负：score≥catchesToWin → eagle；timeLeft≤0 → flock。

import type { SimState, SimConfig } from './types'
import { dist, segPointDist } from './vec'

/** 母鸡身体是否挡在 老鹰→小鸡 连线上（庇护） */
function sheltered(s: SimState, cfg: SimConfig, chickX: number, chickY: number): boolean {
  const d = segPointDist(s.eagle.pos, { x: chickX, y: chickY }, s.hen.pos)
  // 张开翅膀挡得更宽
  const span = s.hen.wingsOpen
    ? cfg.wingClosedSpan + (cfg.wingOpenSpan - cfg.wingClosedSpan) * s.hen.wingT
    : cfg.wingClosedSpan
  return d < cfg.henRadius + span * 0.5
}

export function rulesTick(s: SimState, cfg: SimConfig): void {
  if (s.phase !== 'playing') return

  // 计时
  s.timeLeft = Math.max(0, s.timeLeft - cfg.dt)

  // 冷却推进
  if (s.eagle.catchCooldown > 0) s.eagle.catchCooldown = Math.max(0, s.eagle.catchCooldown - cfg.dt)

  // 抓捕判定
  const dashing = s.eagle.dashLeft > 0
  const canCatch = (!cfg.catchRequiresDash || dashing) && s.eagle.catchCooldown <= 0
  if (canCatch) {
    for (let i = 0; i < s.chicks.length; i++) {
      const c = s.chicks[i]
      if (c.crouchLeft > 0) continue // 蹲下免抓
      if (dist(s.eagle.pos, c.pos) > cfg.catchRadius + cfg.chickRadius) continue
      if (sheltered(s, cfg, c.pos.x, c.pos.y)) continue // 妈妈的庇护
      // 抓到
      s.chicks.splice(i, 1)
      s.score += 1
      s.eagle.catchCooldown = cfg.catchCooldown
      s.events.push({ kind: 'catch', chickId: c.id })
      break // 一次最多一只
    }
  }

  // 胜负
  if (s.score >= cfg.catchesToWin) {
    s.phase = 'result'
    s.winner = 'eagle'
    s.events.push({ kind: 'result', winner: 'eagle' })
  } else if (s.timeLeft <= 0) {
    s.phase = 'result'
    s.winner = 'flock'
    s.events.push({ kind: 'result', winner: 'flock' })
  }
}
