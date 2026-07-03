// 纯向量工具。sim 内部专用，无副作用地返回新值（除非注释标注原地）。

import type { Vec } from './types'

export function len(v: Vec): number {
  return Math.hypot(v.x, v.y)
}

export function dist(a: Vec, b: Vec): number {
  return Math.hypot(a.x - b.x, a.y - b.y)
}

export function sub(a: Vec, b: Vec): Vec {
  return { x: a.x - b.x, y: a.y - b.y }
}

export function add(a: Vec, b: Vec): Vec {
  return { x: a.x + b.x, y: a.y + b.y }
}

export function scale(v: Vec, k: number): Vec {
  return { x: v.x * k, y: v.y * k }
}

/** 归一化；零向量返回零向量 */
export function norm(v: Vec): Vec {
  const l = Math.hypot(v.x, v.y)
  if (l < 1e-6) return { x: 0, y: 0 }
  return { x: v.x / l, y: v.y / l }
}

export function dot(a: Vec, b: Vec): number {
  return a.x * b.x + a.y * b.y
}

/** 把速度朝目标向量以加速度 accel 逼近（原地不改传入，返回新速度） */
export function approach(vel: Vec, target: Vec, accel: number, dt: number): Vec {
  const dx = target.x - vel.x
  const dy = target.y - vel.y
  const d = Math.hypot(dx, dy)
  const maxStep = accel * dt
  if (d <= maxStep || d < 1e-6) return { x: target.x, y: target.y }
  const k = maxStep / d
  return { x: vel.x + dx * k, y: vel.y + dy * k }
}

/** 把点钳进场地内沿矩形（原地修改） */
export function clampToArena(p: Vec, halfW: number, halfH: number, r: number): void {
  const mx = halfW - r
  const my = halfH - r
  if (p.x < -mx) p.x = -mx
  else if (p.x > mx) p.x = mx
  if (p.y < -my) p.y = -my
  else if (p.y > my) p.y = my
}

/** 线段 ab 到点 p 的最近距离（庇护判定用：老鹰-小鸡连线是否被母鸡身体挡住） */
export function segPointDist(a: Vec, b: Vec, p: Vec): number {
  const abx = b.x - a.x
  const aby = b.y - a.y
  const apx = p.x - a.x
  const apy = p.y - a.y
  const abLen2 = abx * abx + aby * aby
  let t = abLen2 < 1e-6 ? 0 : (apx * abx + apy * aby) / abLen2
  t = t < 0 ? 0 : t > 1 ? 1 : t
  const cx = a.x + abx * t
  const cy = a.y + aby * t
  return Math.hypot(p.x - cx, p.y - cy)
}
