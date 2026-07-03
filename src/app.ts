// 应用层状态机：菜单 ↔ 对局 的生命周期中枢。
// UI（DOM）和渲染（Phaser 场景）都只跟它说话，互相不直接引用。
// sim 实例由 GameScene 创建/销毁（它拥有固定步长循环），app 只持引用。

import type { Role, SimState } from './sim/types'

export type AppPhase = 'menu' | 'ingame'
type AppEvent = 'start' | 'menu'

class App {
  phase: AppPhase = 'menu'
  role: Role = 0
  /** 当前对局的 sim 状态；菜单态为 null。GameScene 写，UI 只读。 */
  sim: SimState | null = null

  private listeners: Record<AppEvent, Array<() => void>> = { start: [], menu: [] }

  /** 菜单 → 对局（UI 调用；GameScene 监听 'start' 后创建 sim） */
  startGame(role: Role): void {
    this.role = role
    this.phase = 'ingame'
    this.emit('start')
  }

  /** 任意 → 主菜单（UI 调用；GameScene 监听 'menu' 后销毁 sim） */
  backToMenu(): void {
    this.phase = 'menu'
    this.sim = null
    this.emit('menu')
  }

  on(evt: AppEvent, fn: () => void): void {
    this.listeners[evt].push(fn)
  }

  private emit(evt: AppEvent): void {
    for (const fn of this.listeners[evt]) fn()
  }
}

export const app = new App()
