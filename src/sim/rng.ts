// 确定性伪随机（mulberry32）。sim 内一切随机走这里，禁止 Math.random。
// 同种子同调用序列 → 同输出，是多人联机逐 tick 复现的地基。

import type { SimState } from './types'

/** 推进 rngState，返回 [0,1) */
export function rand(s: SimState): number {
  s.rngState = (s.rngState + 0x6d2b79f5) | 0
  let t = s.rngState
  t = Math.imul(t ^ (t >>> 15), t | 1)
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296
}

/** [min,max) 区间随机 */
export function randRange(s: SimState, min: number, max: number): number {
  return min + rand(s) * (max - min)
}
