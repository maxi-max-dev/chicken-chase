import { describe, it, expect } from 'vitest'
import { defaultConfig } from '../src/sim/config'
import { createSim } from '../src/sim/sim'
import { rulesTick } from '../src/sim/rules'
import type { SimState } from '../src/sim/types'

function playingSim(): SimState {
  const s = createSim(defaultConfig, 0, 999)
  s.phase = 'playing'
  return s
}

/** 把老鹰摆成"正在扑击 + 冷却好 + 贴住某小鸡"的可抓姿态。
 *  为隔离，把其它小鸡挪到很远，避免误抓邻居。 */
function poised(s: SimState, chickIdx: number): void {
  for (let i = 0; i < s.chicks.length; i++) {
    if (i !== chickIdx) s.chicks[i].pos = { x: -5000 - i * 50, y: -5000 }
  }
  const c = s.chicks[chickIdx]
  c.pos = { x: 0, y: 0 }
  s.eagle.pos = { x: 0, y: 0 }
  s.eagle.dashLeft = 0.1
  s.eagle.catchCooldown = 0
  // 把母鸡挪到很远，避免庇护
  s.hen.pos = { x: 9999, y: 9999 }
}

describe('抓捕规则', () => {
  it('必须扑击中：没扑击时贴住也抓不到', () => {
    const s = playingSim()
    poised(s, 5)
    s.eagle.dashLeft = 0 // 关掉扑击
    const before = s.chicks.length
    rulesTick(s, defaultConfig)
    expect(s.chicks.length).toBe(before)
  })

  it('扑击中贴住 + 无庇护 → 抓到，score+1', () => {
    const s = playingSim()
    poised(s, 5)
    rulesTick(s, defaultConfig)
    expect(s.score).toBe(1)
    expect(s.chicks.length).toBe(defaultConfig.chickCount - 1)
    expect(s.events.some((e) => e.kind === 'catch')).toBe(true)
  })

  it('蹲下免抓：扑击贴住但小鸡蹲下 → 抓不到', () => {
    const s = playingSim()
    poised(s, 5)
    s.chicks[5].crouchLeft = 0.5
    const before = s.chicks.length
    rulesTick(s, defaultConfig)
    expect(s.chicks.length).toBe(before)
  })

  it('抓捕冷却中不能再抓（一次俯冲最多一只）', () => {
    const s = playingSim()
    poised(s, 5)
    s.eagle.catchCooldown = 0.5
    const before = s.chicks.length
    rulesTick(s, defaultConfig)
    expect(s.chicks.length).toBe(before)
  })
})

describe('HUD 存活数据源（回归：抓一只 → chicks.length 减一）', () => {
  // HUD「存活」直接读 s.chicks.length；抓捕后必须真的从数组移除，存活数才会减。
  it('每抓一只 chicks.length 精确减一，且与 score 同步', () => {
    const s = playingSim()
    expect(s.chicks.length).toBe(defaultConfig.chickCount)
    poised(s, 5)
    rulesTick(s, defaultConfig)
    expect(s.score).toBe(1)
    expect(s.chicks.length).toBe(defaultConfig.chickCount - 1) // 存活 6 → 5
    // 再抓一只（换目标 + 冷却清零）
    s.eagle.catchCooldown = 0
    poised(s, 0)
    rulesTick(s, defaultConfig)
    expect(s.score).toBe(2)
    expect(s.chicks.length).toBe(defaultConfig.chickCount - 2) // 存活 5 → 4
  })
})

describe('妈妈的庇护', () => {
  it('母鸡身体挡在 老鹰→小鸡 连线上时，抓捕无效', () => {
    const s = playingSim()
    const c = s.chicks[5]
    c.pos = { x: 0, y: 0 }
    // 老鹰贴住小鸡（同点），但母鸡也在连线附近 → 庇护生效
    s.eagle.pos = { x: 0, y: 10 }
    c.pos = { x: 0, y: 0 }
    s.eagle.dashLeft = 0.1
    s.eagle.catchCooldown = 0
    // 母鸡站在老鹰和小鸡正中间
    s.hen.pos = { x: 0, y: 5 }
    // 拉近老鹰到 catchRadius 内
    s.eagle.pos = { x: 0, y: 3 }
    const before = s.chicks.length
    rulesTick(s, defaultConfig)
    expect(s.chicks.length).toBe(before) // 被庇护，没抓到
  })

  it('母鸡不在连线上时不构成庇护 → 能抓到', () => {
    const s = playingSim()
    const c = s.chicks[5]
    c.pos = { x: 0, y: 0 }
    s.eagle.pos = { x: 0, y: 2 }
    s.eagle.dashLeft = 0.1
    s.eagle.catchCooldown = 0
    s.hen.pos = { x: 500, y: 500 } // 母鸡远离连线
    rulesTick(s, defaultConfig)
    expect(s.score).toBe(1)
  })
})

describe('胜负', () => {
  it('抓够 catchesToWin 只 → 老鹰赢', () => {
    const s = playingSim()
    s.score = defaultConfig.catchesToWin
    rulesTick(s, defaultConfig)
    expect(s.phase).toBe('result')
    expect(s.winner).toBe('eagle')
  })

  it('时间耗尽 → 鸡群赢', () => {
    const s = playingSim()
    s.timeLeft = 0.001
    rulesTick(s, defaultConfig)
    expect(s.phase).toBe('result')
    expect(s.winner).toBe('flock')
  })
})
