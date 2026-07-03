// Phaser 场景：拥有固定步长循环（提示词底线 #1 的渲染侧）。
// 用累加器把可变渲染帧驱动为整数个 60Hz sim tick，渲染只读 SimState 画画面。
// 不含任何游戏规则——规则全在 src/sim/。

import Phaser from 'phaser'
import { VIEW, liveConfig } from '../sim/config'
import type { SimState, SimInputs, Role, Vec } from '../sim/types'
import { createSim, startPlay, simTick } from '../sim/sim'
import { buildSprites, TEX } from './sprites'
import { InputController } from './input'

const ZERO: Vec = { x: 0, y: 0 }
const SCALE = 3 // 逻辑像素 → 屏幕像素整数放大

export interface SceneHooks {
  onResult: (winner: string, score: number) => void
  onTick: (s: SimState) => void
}

export class GameScene extends Phaser.Scene {
  private sim!: SimState
  private controls!: InputController
  private role: Role = 0
  private seed = 1
  private acc = 0
  private started = false // 已 startPlay
  private resultFired = false
  private hooks!: SceneHooks

  // 渲染对象
  private layer!: Phaser.GameObjects.Container
  private chainGfx!: Phaser.GameObjects.Graphics
  private arenaGfx!: Phaser.GameObjects.Graphics
  private eagleSpr!: Phaser.GameObjects.Image
  private henSpr!: Phaser.GameObjects.Image
  private haloGfx!: Phaser.GameObjects.Graphics
  private chickSprs: Phaser.GameObjects.Image[] = []
  private animT = 0

  constructor() {
    super('game')
  }

  init(data: { role: Role; seed: number; hooks: SceneHooks }): void {
    this.role = data.role
    this.seed = data.seed
    this.hooks = data.hooks
  }

  create(): void {
    buildSprites(this)
    this.cameras.main.setBackgroundColor('#c8e6a0') // 浅色草地
    this.controls = new InputController(this)

    this.sim = createSim(liveConfig, this.role, this.seed)
    this.acc = 0
    this.started = false
    this.resultFired = false

    // 世界坐标原点放画布中心
    this.layer = this.add.container(VIEW.w / 2 * SCALE, VIEW.h / 2 * SCALE)

    this.arenaGfx = this.add.graphics()
    this.layer.add(this.arenaGfx)
    this.drawArena()

    this.chainGfx = this.add.graphics()
    this.layer.add(this.chainGfx)

    this.haloGfx = this.add.graphics()
    this.layer.add(this.haloGfx)

    // 小鸡精灵
    this.chickSprs = this.sim.chicks.map(() => {
      const img = this.add.image(0, 0, TEX.chickA)
      img.setScale(SCALE)
      this.layer.add(img)
      return img
    })

    this.henSpr = this.add.image(0, 0, TEX.henA).setScale(SCALE)
    this.layer.add(this.henSpr)
    this.eagleSpr = this.add.image(0, 0, TEX.eagleA).setScale(SCALE)
    this.layer.add(this.eagleSpr)
  }

  private drawArena(): void {
    const g = this.arenaGfx
    g.clear()
    const w = liveConfig.arenaW * SCALE
    const h = liveConfig.arenaH * SCALE
    g.lineStyle(2 * SCALE, 0x7a9b52, 1)
    g.strokeRect(-w / 2, -h / 2, w, h)
    g.lineStyle(1, 0xb0d488, 0.5)
    // 简单地面网格提供纵深参照
    for (let x = -w / 2; x <= w / 2; x += 30 * SCALE) g.lineBetween(x, -h / 2, x, h / 2)
    for (let y = -h / 2; y <= h / 2; y += 30 * SCALE) g.lineBetween(-w / 2, y, w / 2, y)
  }

  /** 外部（结算后）请求重开 */
  restart(role: Role, seed: number): void {
    this.scene.restart({ role, seed, hooks: this.hooks })
  }

  update(_time: number, deltaMs: number): void {
    if (!this.sim) return
    const dt = liveConfig.dt

    // 采输入（玩家角色）
    const frame = this.controls.sample()
    // 开局门：轮询"此刻是否按住移动键"而非监听 keydown 边沿。
    // 快速点按方向键时，按下到松开可能整段落在两帧之间，边沿会被吃掉，
    // 游戏就永远停在待机页（连倒计时都不走，老鹰也跟着一起冻着）。轮询对这种丢失免疫。
    if (!this.started && this.sim.phase === 'waiting' && this.controls.moveHeld()) {
      startPlay(this.sim)
      this.started = true
    }

    const inputs: SimInputs = {
      eagle: this.role === 0 ? frame : { move: ZERO, action: false },
      hen: this.role === 1 ? frame : { move: ZERO, action: false },
      chick: this.role === 2 ? frame : { move: ZERO, action: false },
    }

    // 固定步长累加器（封顶防卡顿雪崩）
    this.acc += Math.min(deltaMs / 1000, 0.25)
    let steps = 0
    while (this.acc >= dt && steps < 8) {
      simTick(this.sim, liveConfig, inputs)
      this.acc -= dt
      steps++
    }

    this.hooks.onTick(this.sim)
    this.render()

    if (this.sim.phase === 'result' && !this.resultFired) {
      this.resultFired = true
      this.hooks.onResult(this.sim.winner, this.sim.score)
    }
  }

  private render(): void {
    this.animT += 1
    const walkFrame = Math.floor(this.animT / 8) % 2 === 0 // 两帧走路

    // 老鹰
    const e = this.sim.eagle
    this.eagleSpr.setTexture(walkFrame ? TEX.eagleA : TEX.eagleB)
    this.eagleSpr.setPosition(e.pos.x * SCALE, e.pos.y * SCALE)
    this.eagleSpr.setRotation(e.facing + Math.PI / 2)

    // 母鸡（翅膀开合切换纹理）
    const h = this.sim.hen
    const wingOpen = h.wingsOpen && h.wingT > 0.5
    const henTex = wingOpen
      ? walkFrame
        ? TEX.henWingA
        : TEX.henWingB
      : walkFrame
        ? TEX.henA
        : TEX.henB
    this.henSpr.setTexture(henTex)
    this.henSpr.setPosition(h.pos.x * SCALE, h.pos.y * SCALE)
    this.henSpr.setRotation(h.facing + Math.PI / 2)

    // 鸡链连线（母鸡→链头→…→队尾）
    const g = this.chainGfx
    g.clear()
    g.lineStyle(2, 0xffffff, 0.6)
    let prev: Vec = h.pos
    for (const c of this.sim.chicks) {
      if (c.detached) {
        prev = c.pos // 脱链的不连线，但更新参照避免跨越
        continue
      }
      g.lineBetween(prev.x * SCALE, prev.y * SCALE, c.pos.x * SCALE, c.pos.y * SCALE)
      prev = c.pos
    }

    // 小鸡 + 状态光环
    const halo = this.haloGfx
    halo.clear()
    // chicks 数量可能减少（被抓），多余精灵隐藏
    for (let i = 0; i < this.chickSprs.length; i++) {
      const spr = this.chickSprs[i]
      const c = this.sim.chicks[i]
      if (!c) {
        spr.setVisible(false)
        continue
      }
      spr.setVisible(true)
      const alert = c.detached
      spr.setTexture(alert ? (walkFrame ? TEX.chickAlertA : TEX.chickAlertB) : walkFrame ? TEX.chickA : TEX.chickB)
      spr.setPosition(c.pos.x * SCALE, c.pos.y * SCALE)
      spr.setRotation(c.facing + Math.PI / 2)

      // 蹲下：变色 + 光环 + 缩小（三重信号，俯视一眼可见）
      if (c.crouchLeft > 0) {
        spr.setScale(SCALE * 0.7)
        halo.lineStyle(2, 0x35c1ff, 0.9)
        halo.strokeCircle(c.pos.x * SCALE, c.pos.y * SCALE, 9 * SCALE * 0.5)
      } else {
        spr.setScale(SCALE)
      }
      if (alert) {
        halo.lineStyle(2, 0xff5a2a, 0.8)
        halo.strokeCircle(c.pos.x * SCALE, c.pos.y * SCALE, 7 * SCALE * 0.5)
      }
    }
  }
}
