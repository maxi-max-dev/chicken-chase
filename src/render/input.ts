// 键盘输入采集：WASD/方向键 = move，空格 = 技能（边沿触发）。
// 只负责把浏览器按键翻成 sim 的 InputFrame，不碰任何游戏逻辑。

import Phaser from 'phaser'
import type { InputFrame, Vec } from '../sim/types'

export class InputController {
  private keys: Record<string, Phaser.Input.Keyboard.Key> = {}
  private spacePrev = false
  /** 是否发生过任意移动输入（开局用：按移动键才 startPlay） */
  moved = false

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

  /**
   * 当前是否有任意移动键处于"按下"状态（轮询，非边沿）。
   * 开局门用它而不是 moved 标志：快速点按方向键时，keydown→keyup 可能整段落在
   * 两次渲染帧之间，sample() 那一刻 isDown 已回落，moved 永远不会置真 → 游戏卡在待机。
   * 轮询"此刻是否按住"对这种边沿丢失免疫（只要按住跨过任意一帧就能进局）。
   */
  moveHeld(): boolean {
    const k = this.keys
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

  /** 采一帧（每渲染帧调一次；action 只在空格"刚按下"那帧为 true） */
  sample(): InputFrame {
    let x = 0
    let y = 0
    if (this.keys.left.isDown || this.keys.a.isDown) x -= 1
    if (this.keys.right.isDown || this.keys.d.isDown) x += 1
    if (this.keys.up.isDown || this.keys.w.isDown) y -= 1
    if (this.keys.down.isDown || this.keys.s.isDown) y += 1
    const move: Vec = { x, y }
    if (x !== 0 || y !== 0) this.moved = true

    const spaceDown = this.keys.space.isDown
    const action = spaceDown && !this.spacePrev
    this.spacePrev = spaceDown

    return { move, action }
  }

  reset(): void {
    this.moved = false
    this.spacePrev = false
  }
}
