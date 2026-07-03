import { describe, it, expect } from 'vitest'
import { defaultConfig } from '../src/sim/config'
import { createSim, startPlay, simTick } from '../src/sim/sim'
import type { SimInputs } from '../src/sim/types'

function zeroInputs(): SimInputs {
  const z = { move: { x: 0, y: 0 }, action: false }
  return { eagle: { ...z }, hen: { ...z }, chick: { ...z } }
}

describe('决定论', () => {
  it('同种子同输入，逐 tick 状态一致（多人联机地基）', () => {
    const runOnce = () => {
      const s = createSim(defaultConfig, 0, 42) // 玩家老鹰，其余 AI
      startPlay(s)
      for (let i = 0; i < 300; i++) simTick(s, defaultConfig, zeroInputs())
      return JSON.stringify({
        eagle: s.eagle.pos,
        hen: s.hen.pos,
        chicks: s.chicks.map((c) => c.pos),
        score: s.score,
        rng: s.rngState,
      })
    }
    expect(runOnce()).toBe(runOnce())
  })
})

describe('老鹰 AI 永不发呆（回归：player=chick 时老鹰照追）', () => {
  // 曾经的 bug：玩家选小鸡、把整条链甩到全员脱链时，pickTarget 返回 null，
  // 老鹰收到零向量输入原地冻结（母鸡还在动、计时还在走，唯独老鹰不动）。
  it('player=chick 跑 N tick 后老鹰位移 > 0', () => {
    const s = createSim(defaultConfig, 2, 42) // 玩家小鸡
    startPlay(s)
    const start = { ...s.eagle.pos }
    for (let i = 0; i < 300; i++) simTick(s, defaultConfig, zeroInputs())
    const disp = Math.hypot(s.eagle.pos.x - start.x, s.eagle.pos.y - start.y)
    expect(disp).toBeGreaterThan(0)
  })

  it('全员脱链时老鹰仍追（不原地发呆）', () => {
    const s = createSim(defaultConfig, 2, 7)
    startPlay(s)
    const start = { ...s.eagle.pos }
    for (let i = 0; i < 90; i++) {
      for (const c of s.chicks) c.detached = true // 每 tick 强制全脱链
      simTick(s, defaultConfig, zeroInputs())
    }
    const disp = Math.hypot(s.eagle.pos.x - start.x, s.eagle.pos.y - start.y)
    expect(disp).toBeGreaterThan(0)
  })
})

describe('生命周期', () => {
  it('waiting 态全员冻结（simTick 不移动角色）', () => {
    const s = createSim(defaultConfig, 0, 7)
    const eagleBefore = { ...s.eagle.pos }
    simTick(s, defaultConfig, {
      eagle: { move: { x: 1, y: 0 }, action: false },
      hen: { move: { x: 0, y: 0 }, action: false },
      chick: { move: { x: 0, y: 0 }, action: false },
    })
    expect(s.eagle.pos).toEqual(eagleBefore) // 没开局，输入无效
  })

  it('startPlay 后老鹰输入生效', () => {
    const s = createSim(defaultConfig, 0, 7)
    startPlay(s)
    simTick(s, defaultConfig, {
      eagle: { move: { x: 1, y: 0 }, action: false },
      hen: { move: { x: 0, y: 0 }, action: false },
      chick: { move: { x: 0, y: 0 }, action: false },
    })
    expect(s.eagle.pos.x).toBeGreaterThan(0)
  })
})

describe('鞭甩手感（smoke）：母鸡急转时队尾甩出弧线（灵魂机制）', () => {
  it('母鸡直冲后急转 90°，队尾离母鸡的距离远大于链头（鞭梢甩出）', () => {
    const s = createSim(defaultConfig, 1, 3) // 玩家母鸡
    startPlay(s)
    const run = (mx: number, my: number, n: number) => {
      for (let i = 0; i < n; i++)
        simTick(s, defaultConfig, {
          eagle: { move: { x: 0, y: 0 }, action: false },
          hen: { move: { x: mx, y: my }, action: false },
          chick: { move: { x: 0, y: 0 }, action: false },
        })
    }
    run(1, 0, 50) // 向右直冲，链拉直
    // 急转向上
    let maxTailDist = 0
    let maxHeadDist = 0
    for (let i = 0; i < 40; i++) {
      run(0, 1, 1)
      const head = s.chicks[0]
      const tail = s.chicks[s.chicks.length - 1]
      maxTailDist = Math.max(maxTailDist, Math.hypot(tail.pos.x - s.hen.pos.x, tail.pos.y - s.hen.pos.y))
      maxHeadDist = Math.max(maxHeadDist, Math.hypot(head.pos.x - s.hen.pos.x, head.pos.y - s.hen.pos.y))
    }
    // 鞭梢：队尾被甩到离母鸡很远（接近整条链长），链头始终贴着母鸡
    expect(maxTailDist).toBeGreaterThan(maxHeadDist * 2.5)
    // 且没被甩断到超过整条链自然长度（约束在兜底）
    expect(maxTailDist).toBeLessThan(defaultConfig.chickCount * defaultConfig.chickSpacing * 1.2)
  })
})
