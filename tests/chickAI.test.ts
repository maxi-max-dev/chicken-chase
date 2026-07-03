import { describe, it, expect } from 'vitest'
import { defaultConfig } from '../src/sim/config'
import { createSim } from '../src/sim/sim'
import { chickAITick } from '../src/sim/chickAI'
import type { SimState } from '../src/sim/types'

function freshSim(): SimState {
  const s = createSim(defaultConfig, 1, 555)
  s.phase = 'playing'
  // 把老鹰挪到远处，隔离出纯分离行为（不掺躲避/蹲下）
  s.eagle.pos = { x: 9999, y: 9999 }
  s.eagle.dashLeft = 0
  return s
}

describe('小鸡静止分离（观察项修复：母鸡不动时不再叠成一坨）', () => {
  it('低速下叠成一坨的小鸡会被温和撑开', () => {
    const s = freshSim()
    // 把所有活链小鸡堆到几乎同一点（模拟母鸡站着不动的聚堆），速度置零
    for (const c of s.chicks) {
      c.detached = false
      c.pos = { x: 0.2 * c.id, y: 0.2 * c.id } // 几乎重叠
      c.vel = { x: 0, y: 0 }
    }
    const minPairBefore = minPairDist(s)
    for (let i = 0; i < 60; i++) chickAITick(s, defaultConfig)
    const minPairAfter = minPairDist(s)
    // 撑开了（最近的一对间距变大）
    expect(minPairAfter).toBeGreaterThan(minPairBefore)
  })

  it('运动中的小鸡不受分离干扰（鞭甩弧线不被碰）', () => {
    const s = freshSim()
    // 两只挨得很近，但都在高速运动（超过 chickSeparationMaxSpeed）
    const a = s.chicks[0]
    const b = s.chicks[1]
    for (const c of s.chicks) c.pos = { x: 999, y: 999 } // 其余挪开
    a.pos = { x: 0, y: 0 }
    b.pos = { x: 1, y: 0 } // 间距 1 << separationRadius
    const fast = defaultConfig.chickSeparationMaxSpeed + 20
    a.vel = { x: fast, y: 0 }
    b.vel = { x: fast, y: 0 }
    a.detached = false
    b.detached = false
    const aBefore = { ...a.pos }
    const bBefore = { ...b.pos }
    chickAITick(s, defaultConfig)
    // 高速 → 分离一律不生效，位置不被分离力改动（此测试不跑链/物理，仅 chickAITick）
    expect(a.pos).toEqual(aBefore)
    expect(b.pos).toEqual(bBefore)
  })
})

function minPairDist(s: SimState): number {
  let m = Infinity
  const cs = s.chicks.filter((c) => !c.detached)
  for (let i = 0; i < cs.length; i++)
    for (let j = i + 1; j < cs.length; j++) {
      const d = Math.hypot(cs[i].pos.x - cs[j].pos.x, cs[i].pos.y - cs[j].pos.y)
      if (d < m) m = d
    }
  return m
}
