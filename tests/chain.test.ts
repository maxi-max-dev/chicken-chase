import { describe, it, expect } from 'vitest'
import { defaultConfig } from '../src/sim/config'
import { createSim } from '../src/sim/sim'
import { chainTick, maxStretch } from '../src/sim/chain'
import type { SimState } from '../src/sim/types'

function freshSim(): SimState {
  const s = createSim(defaultConfig, 1, 12345)
  s.phase = 'playing'
  // 关掉重连保护期，让约束/脱链逻辑直接生效
  for (const c of s.chicks) c.reattachGrace = 0
  return s
}

describe('鸡链约束：只拉不压', () => {
  it('把一只小鸡压得离锚点很近时，约束不会把它往外推（不压）', () => {
    const cfg = defaultConfig
    // 直接构造隔离场景：单节，锚点=母鸡，小鸡压近到远小于静止长度
    const s = freshSim()
    // 只保留一只小鸡，避免链上其它节的联动干扰
    s.chicks = [s.chicks[0]]
    s.hen.pos = { x: 0, y: 0 }
    s.chicks[0].pos = { x: 0, y: 1.0 } // 距锚点 1.0 << spacing(5.5)
    const before = { ...s.chicks[0].pos }
    chainTick(s, cfg, { x: 0, y: 0 })
    const after = s.chicks[0].pos
    // 约束层不得把压近的小鸡往外推。行为层可能让它主动往锚点靠（距离更近），
    // 但绝不能出现"距离变大"的外推。
    const dBefore = Math.hypot(before.x - s.hen.pos.x, before.y - s.hen.pos.y)
    const dAfter = Math.hypot(after.x - s.hen.pos.x, after.y - s.hen.pos.y)
    expect(dAfter).toBeLessThanOrEqual(dBefore + 1e-6) // 没被推远
  })

  it('把小鸡拉得远超静止长度时，约束会把它拉回（只拉）', () => {
    const s = freshSim()
    const cfg = defaultConfig
    // chick[0] 锚母鸡(0,20)；把它拉到远处
    s.chicks[0].pos = { x: 0, y: 20 + cfg.chickSpacing * 3 }
    const distBefore = s.chicks[0].pos.y - 20
    chainTick(s, cfg, { x: 0, y: 0 })
    const distAfter = s.chicks[0].pos.y - 20
    expect(distAfter).toBeLessThan(distBefore) // 被拉回
  })

  it('稳态下最大拉伸比接近 1（链条不炸开）', () => {
    const s = freshSim()
    const cfg = defaultConfig
    for (let i = 0; i < 120; i++) chainTick(s, cfg, { x: 0, y: 0 })
    expect(maxStretch(s, cfg)).toBeLessThan(1.05)
  })
})

describe('脱手判据：持续过载 0.2 秒才脱手', () => {
  it('瞬时过载一两帧不脱手', () => {
    const s = freshSim()
    const cfg = defaultConfig
    const c = s.chicks[s.chicks.length - 1]
    const anchorY = s.chicks[s.chicks.length - 2].pos.y
    // 手动制造 1 帧的巨大过载后立刻恢复
    c.pos = { x: 200, y: anchorY } // 极度拉伸
    // 只跑脱链判定一帧（借 chainTick，但行为/约束会立刻拉回，过载计时应清零）
    chainTick(s, cfg, { x: 0, y: 0 })
    expect(c.detached).toBe(false)
  })

  it('持续过载超过 0.2 秒（约 13 帧）触发脱手', () => {
    const s = freshSim()
    const cfg = defaultConfig
    const c = s.chicks[s.chicks.length - 1]
    // 每帧强行把它拽到远处再跑判定，模拟持续过载
    const framesFor02s = Math.ceil(cfg.overloadDuration / cfg.dt) + 2
    let detached = false
    for (let i = 0; i < framesFor02s; i++) {
      c.pos = { x: 300, y: 0 } // 每帧重新拉爆（持续过载）
      chainTick(s, cfg, { x: 0, y: 0 })
      if (c.detached) {
        detached = true
        break
      }
    }
    expect(detached).toBe(true)
  })

  it('脱手小鸡标记 detached 并发 detach 事件', () => {
    const s = freshSim()
    const cfg = defaultConfig
    const c = s.chicks[s.chicks.length - 1]
    let sawEvent = false
    for (let i = 0; i < 20; i++) {
      c.pos = { x: 300, y: 0 }
      chainTick(s, cfg, { x: 0, y: 0 })
      if (s.events.some((e) => e.kind === 'detach')) sawEvent = true
      if (c.detached) break
    }
    expect(c.detached).toBe(true)
    expect(sawEvent).toBe(true)
  })
})
