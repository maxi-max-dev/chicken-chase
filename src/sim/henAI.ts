// 母鸡 AI：老鹰远就随机遛弯，靠近才回防卡位——挡在老鹰和"被盯的落单/队尾小鸡"之间。
// 别无限后退、别开局冲锋（henStandoff 是与老鹰保持的最小距离，卡位不贴脸）。

import type { SimState, SimConfig, InputFrame, Vec } from './types'
import { dist, norm, sub, add, scale, len } from './vec'
import { randRange } from './rng'
import { tailChick } from './chain'

function pickWander(s: SimState, cfg: SimConfig): Vec {
  const mx = cfg.arenaW / 2 - cfg.henRadius - 8
  const my = cfg.arenaH / 2 - cfg.henRadius - 8
  return { x: randRange(s, -mx, mx), y: randRange(s, -my, my) }
}

export function henAIDecide(s: SimState, cfg: SimConfig): InputFrame {
  const ai = s.henAI
  const eagleDist = dist(s.hen.pos, s.eagle.pos)

  // 被盯的小鸡：优先老鹰 AI 的目标，否则队尾
  let guarded: Vec | null = null
  const targetId = s.eagleAI.targetId
  if (targetId >= 0) {
    const t = s.chicks.find((c) => c.id === targetId && !c.detached)
    if (t) guarded = t.pos
  }
  if (!guarded) {
    const tail = tailChick(s)
    if (tail) guarded = tail.pos
  }

  ai.wanderTimer -= cfg.dt

  // 老鹰远：随机遛弯（别赖在原地）
  if (eagleDist > cfg.henEngageRange || !guarded) {
    if (ai.wanderTimer <= 0 || dist(s.hen.pos, ai.wanderTarget) < 10) {
      ai.wanderTarget = pickWander(s, cfg)
      ai.wanderTimer = cfg.henWanderInterval
    }
    return { move: norm(sub(ai.wanderTarget, s.hen.pos)), action: false }
  }

  // 回防卡位：站到 (被盯小鸡 → 老鹰) 连线上，靠小鸡一侧，与老鹰保持 standoff
  const toEagle = norm(sub(s.eagle.pos, guarded))
  const blockPoint = add(guarded, scale(toEagle, Math.min(cfg.henStandoff, dist(guarded, s.eagle.pos) * 0.5)))
  const toBlock = sub(blockPoint, s.hen.pos)
  const move = len(toBlock) > 2 ? norm(toBlock) : { x: 0, y: 0 }

  // 翅膀：老鹰足够近才张开（wingOpenRange，收起加迟滞防抖）
  const wantOpen = eagleDist < (s.hen.wingsOpen ? cfg.wingOpenRange + 13 : cfg.wingOpenRange)
  const action = wantOpen !== s.hen.wingsOpen // 边沿：需要切换才发 action

  return { move, action }
}
