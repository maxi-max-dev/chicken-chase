// 输入采集：WASD/方向键 = move，空格 = 技能（边沿触发）。
// 触屏设备再叠加一路虚拟摇杆 + 动作按钮，二者和键盘同级汇入同一个 InputFrame。
// 只负责把浏览器输入翻成 sim 的 InputFrame，不碰任何游戏逻辑。

import Phaser from 'phaser'
import type { InputFrame, Vec } from '../sim/types'

/** 是否触屏设备（有 touch point 且支持 coarse pointer）——决定是否显示虚拟控件 */
export function isTouchDevice(): boolean {
  if (typeof window === 'undefined') return false
  const coarse = typeof window.matchMedia === 'function' && window.matchMedia('(pointer: coarse)').matches
  const hasTouch = 'ontouchstart' in window || (navigator.maxTouchPoints ?? 0) > 0
  return hasTouch && coarse
}

export class InputController {
  private keys: Record<string, Phaser.Input.Keyboard.Key> = {}
  private spacePrev = false
  /** 是否发生过任意移动输入（开局用：按移动键才 startPlay） */
  moved = false

  // ---- 触屏通道（由 TouchControls 每帧写入，和键盘同级）----
  /** 摇杆当前方向（未归一化，x/y ∈ [-1,1]）；无摇杆输入时为零 */
  private touchMove: Vec = { x: 0, y: 0 }
  /** 触屏动作按钮「本帧刚按下」的边沿标记，采样后清零 */
  private touchActionEdge = false

  constructor(scene: Phaser.Scene) {
    const kb = scene.input.keyboard!
    const codes = Phaser.Input.Keyboard.KeyCodes
    this.keys = {
      up: kb.addKey(codes.UP),
      down: kb.addKey(codes.DOWN),
      left: kb.addKey(codes.LEFT),
      right: kb.addKey(codes.RIGHT),
      w: kb.addKey(codes.W),
      a: kb.addKey(codes.A),
      s: kb.addKey(codes.S),
      d: kb.addKey(codes.D),
      space: kb.addKey(codes.SPACE),
    }
  }

  /** 触屏 UI 调：写入当前摇杆方向（松手传零向量） */
  setTouchMove(v: Vec): void {
    this.touchMove = v
  }

  /** 触屏 UI 调：动作按钮被按下（边沿，攒到下一次 sample 消费） */
  pressTouchAction(): void {
    this.touchActionEdge = true
  }

  /**
   * 当前是否有任意移动输入处于"按下"状态（轮询，非边沿）。
   * 键盘按住 或 摇杆被推动 都算。开局门用它而不是 moved 标志：
   * 快速点按方向键时 keydown→keyup 可能整段落在两帧之间，边沿会被吃掉 → 游戏卡在待机；
   * 轮询"此刻是否有输入"对这种丢失免疫，摇杆按住也走这条门。
   */
  moveHeld(): boolean {
    const k = this.keys
    if (this.touchMove.x !== 0 || this.touchMove.y !== 0) return true
    return (
      k.left.isDown ||
      k.right.isDown ||
      k.up.isDown ||
      k.down.isDown ||
      k.w.isDown ||
      k.a.isDown ||
      k.s.isDown ||
      k.d.isDown
    )
  }

  /** 采一帧（每渲染帧调一次；action 只在"刚按下"那帧为 true） */
  sample(): InputFrame {
    let x = 0
    let y = 0
    if (this.keys.left.isDown || this.keys.a.isDown) x -= 1
    if (this.keys.right.isDown || this.keys.d.isDown) x += 1
    if (this.keys.up.isDown || this.keys.w.isDown) y -= 1
    if (this.keys.down.isDown || this.keys.s.isDown) y += 1

    // 摇杆叠加（和键盘同一通道，取并集）
    x += this.touchMove.x
    y += this.touchMove.y
    // 钳到单位圆内，避免键盘+摇杆同时推时方向被放大（sim 内会再归一化，这里保稳）
    const len = Math.hypot(x, y)
    if (len > 1) {
      x /= len
      y /= len
    }
    const move: Vec = { x, y }
    if (x !== 0 || y !== 0) this.moved = true

    const spaceDown = this.keys.space.isDown
    const keyAction = spaceDown && !this.spacePrev
    this.spacePrev = spaceDown

    const action = keyAction || this.touchActionEdge
    this.touchActionEdge = false

    return { move, action }
  }

  reset(): void {
    this.moved = false
    this.spacePrev = false
    this.touchMove = { x: 0, y: 0 }
    this.touchActionEdge = false
  }
}
