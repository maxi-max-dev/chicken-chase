// Phaser 场景：拥有固定步长循环（提示词底线 #1 的渲染侧）。
// 用累加器把可变渲染帧驱动为整数个 60Hz sim tick，渲染只读 SimState 画画面。
// 不含任何游戏规则——规则全在 src/sim/。

import Phaser from 'phaser'
import { VIEW, liveConfig, CAMERA, TERRAIN } from '../sim/config'
import type { SimState, SimInputs, Role, Vec } from '../sim/types'
import { createSim, startPlay, simTick } from '../sim/sim'
import { buildSprites, TEX } from './sprites'
import { InputController } from './input'

const ZERO: Vec = { x: 0, y: 0 }
const SCALE = 3 // 逻辑像素 → 屏幕像素整数放大

export interface SceneHooks {
  onResult: (winner: string, score: number) => void
  onTick: (s: SimState) => void
  /** 场景就绪：把本局的 InputController 交给外部（触屏控件绑定用） */
  onSceneReady: (controls: InputController) => void
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
  private terrainGfx!: Phaser.GameObjects.Graphics
  private chainGfx!: Phaser.GameObjects.Graphics
  private arenaGfx!: Phaser.GameObjects.Graphics
  private eagleSpr!: Phaser.GameObjects.Image
  private henSpr!: Phaser.GameObjects.Image
  private haloGfx!: Phaser.GameObjects.Graphics
  private fxGfx!: Phaser.GameObjects.Graphics
  private chickSprs: Phaser.GameObjects.Image[] = []
  private animT = 0

  // 动态镜头当前值（平滑插值目标）——世界坐标（含 SCALE），非 sim
  private camX = 0
  private camY = 0
  private camZoom = CAMERA.minZoom
  private camInit = false

  // 抓捕反馈：羽毛粒子 + 极轻微震屏（纯渲染）
  private feathers: Array<{ x: number; y: number; vx: number; vy: number; life: number }> = []

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
    this.hooks.onSceneReady(this.controls)

    this.sim = createSim(liveConfig, this.role, this.seed)
    this.acc = 0
    this.started = false
    this.resultFired = false
    this.feathers = []
    this.camInit = false

    // 世界坐标原点放画布中心：sim 原点(0,0) = 世界(VIEW.w/2, VIEW.h/2)*SCALE
    this.layer = this.add.container(VIEW.w / 2 * SCALE, VIEW.h / 2 * SCALE)

    // 场地质感（草丛/碎花，最底层，一次生成，种子固定）
    this.terrainGfx = this.add.graphics()
    this.layer.add(this.terrainGfx)
    this.drawTerrain()

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

    // 特效层（羽毛粒子）在最上
    this.fxGfx = this.add.graphics()
    this.layer.add(this.fxGfx)
  }

  /** 渲染侧独立 RNG（mulberry32），只给场地装饰用，绝不碰 sim 的 rngState */
  private makeRng(seed: number): () => number {
    let a = seed >>> 0
    return () => {
      a = (a + 0x6d2b79f5) | 0
      let t = a
      t = Math.imul(t ^ (t >>> 15), t | 1)
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296
    }
  }

  /** 程序生成草丛/碎花/色斑（种子固定，密度低对比弱，不抢角色）。纯渲染。 */
  private drawTerrain(): void {
    const g = this.terrainGfx
    g.clear()
    const w = liveConfig.arenaW
    const h = liveConfig.arenaH
    const rng = this.makeRng(TERRAIN.seed)
    const count = Math.floor((w * h) / 10000 * TERRAIN.density * 10000)
    for (let i = 0; i < count; i++) {
      const x = (rng() - 0.5) * w
      const y = (rng() - 0.5) * h
      const col = TERRAIN.colors[Math.floor(rng() * TERRAIN.colors.length)]
      const color = Phaser.Display.Color.HexStringToColor(col).color
      const kind = rng()
      const px = x * SCALE
      const py = y * SCALE
      if (kind < 0.55) {
        // 草丛：三根短竖线
        g.lineStyle(SCALE, color, 0.5)
        for (let b = -1; b <= 1; b++) {
          g.lineBetween(px + b * 1.4 * SCALE, py, px + b * 1.4 * SCALE, py - 3 * SCALE)
        }
      } else if (kind < 0.82) {
        // 碎花：小十字点
        g.fillStyle(color, 0.55)
        g.fillRect(px - SCALE / 2, py - SCALE * 1.5, SCALE, SCALE * 3)
        g.fillRect(px - SCALE * 1.5, py - SCALE / 2, SCALE * 3, SCALE)
      } else {
        // 色斑：淡椭圆
        g.fillStyle(color, 0.28)
        g.fillEllipse(px, py, 6 * SCALE, 4 * SCALE)
      }
    }
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

    // 消费 sim 事件（渲染侧特效，不改 sim）：抓捕瞬间羽毛 + 极轻微震屏
    for (const ev of this.sim.events) {
      if (ev.kind === 'catch') {
        const c = this.sim.chicks.find((k) => k.id === ev.chickId)
        const at = c ? c.pos : this.sim.eagle.pos
        this.spawnFeathers(at)
        this.cameras.main.shake(120, 0.004) // 极轻微
      }
    }

    this.hooks.onTick(this.sim)
    this.updateCamera()
    this.render()

    if (this.sim.phase === 'result' && !this.resultFired) {
      this.resultFired = true
      this.hooks.onResult(this.sim.winner, this.sim.score)
    }
  }

  /** 动态镜头：框住所有活动角色包围盒，平滑插值 zoom/scroll，钳制在场地内。纯渲染。 */
  private updateCamera(): void {
    const cam = this.cameras.main
    // 收集活动角色（sim 坐标）
    let minX = Infinity
    let minY = Infinity
    let maxX = -Infinity
    let maxY = -Infinity
    const acc = (p: Vec) => {
      if (p.x < minX) minX = p.x
      if (p.y < minY) minY = p.y
      if (p.x > maxX) maxX = p.x
      if (p.y > maxY) maxY = p.y
    }
    acc(this.sim.hen.pos)
    acc(this.sim.eagle.pos)
    for (const c of this.sim.chicks) acc(c.pos)
    if (!isFinite(minX)) {
      minX = maxX = minY = maxY = 0
    }
    // 加边距
    minX -= CAMERA.margin
    minY -= CAMERA.margin
    maxX += CAMERA.margin
    maxY += CAMERA.margin
    const bw = Math.max(1, maxX - minX)
    const bh = Math.max(1, maxY - minY)

    // 让包围盒填满视口 → zoom = 视口/包围盒（世界像素含 SCALE）
    const viewW = cam.width
    const viewH = cam.height
    const zx = viewW / (bw * SCALE)
    const zy = viewH / (bh * SCALE)
    let targetZoom = Math.min(zx, zy)
    targetZoom = Phaser.Math.Clamp(targetZoom, CAMERA.minZoom, CAMERA.maxZoom)

    // 目标中心（世界坐标：sim(0,0)=世界 VIEW.w/2*SCALE, VIEW.h/2*SCALE）
    const cx = (minX + maxX) / 2
    const cy = (minY + maxY) / 2
    const targetX = (VIEW.w / 2 + cx) * SCALE
    const targetY = (VIEW.h / 2 + cy) * SCALE

    if (!this.camInit) {
      this.camX = targetX
      this.camY = targetY
      this.camZoom = targetZoom
      this.camInit = true
    } else {
      this.camX += (targetX - this.camX) * CAMERA.lerp
      this.camY += (targetY - this.camY) * CAMERA.lerp
      this.camZoom += (targetZoom - this.camZoom) * CAMERA.lerp
    }

    // scroll 钳制在场地边界内（防止镜头越出草地露黑边）
    const arenaHalfW = (VIEW.w / 2 + liveConfig.arenaW / 2 + CAMERA.margin) * SCALE
    const arenaHalfH = (VIEW.h / 2 + liveConfig.arenaH / 2 + CAMERA.margin) * SCALE
    const worldMinX = (VIEW.w / 2 - liveConfig.arenaW / 2 - CAMERA.margin) * SCALE
    const worldMinY = (VIEW.h / 2 - liveConfig.arenaH / 2 - CAMERA.margin) * SCALE
    const halfViewW = viewW / (2 * this.camZoom)
    const halfViewH = viewH / (2 * this.camZoom)
    // 场地比视口小则居中，否则钳制中心不越界
    const clampedX =
      arenaHalfW - worldMinX <= 2 * halfViewW
        ? (worldMinX + arenaHalfW) / 2
        : Phaser.Math.Clamp(this.camX, worldMinX + halfViewW, arenaHalfW - halfViewW)
    const clampedY =
      arenaHalfH - worldMinY <= 2 * halfViewH
        ? (worldMinY + arenaHalfH) / 2
        : Phaser.Math.Clamp(this.camY, worldMinY + halfViewH, arenaHalfH - halfViewH)

    cam.setZoom(this.camZoom)
    cam.centerOn(clampedX, clampedY)
  }

  /** 抓捕点撒一小撮羽毛粒子（渲染侧，用固定色，不依赖 sim RNG） */
  private spawnFeathers(at: Vec): void {
    const x = (VIEW.w / 2 + at.x) * SCALE
    const y = (VIEW.h / 2 + at.y) * SCALE
    for (let i = 0; i < 10; i++) {
      const ang = (i / 10) * Math.PI * 2 + (this.animT % 6)
      const spd = 40 + (i % 3) * 22
      this.feathers.push({
        x,
        y,
        vx: Math.cos(ang) * spd,
        vy: Math.sin(ang) * spd - 30,
        life: 1,
      })
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

    // 羽毛粒子（fxGfx 层坐标 = sim 坐标 × SCALE，和其它渲染对象同系）
    const fx = this.fxGfx
    fx.clear()
    const dt = 1 / 60
    for (let i = this.feathers.length - 1; i >= 0; i--) {
      const f = this.feathers[i]
      f.life -= dt * 1.4
      if (f.life <= 0) {
        this.feathers.splice(i, 1)
        continue
      }
      f.x += f.vx * dt
      f.y += f.vy * dt
      f.vy += 120 * dt // 轻微下坠
      f.vx *= 0.96
      const lx = f.x - (VIEW.w / 2) * SCALE // 换回 layer 局部坐标（layer 原点在世界中心）
      const ly = f.y - (VIEW.h / 2) * SCALE
      fx.fillStyle(0xfff3d6, Math.max(0, f.life))
      fx.fillRect(lx - SCALE, ly - SCALE, 2 * SCALE, 2 * SCALE)
    }
  }
}
