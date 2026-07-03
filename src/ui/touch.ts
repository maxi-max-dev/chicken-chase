// 触屏虚拟控件（仅触屏设备显示）：屏幕左半虚拟摇杆 + 右下动作按钮。
// 输出接进 InputController 的触屏通道（和键盘同级），不绕过它直喂 sim。
// 纯 DOM 蒙层，pointer 事件驱动；桌面不创建这些元素。

import type { InputController } from '../render/input'
import type { Role } from '../sim/types'

/** 摇杆最大拖动半径（px）——超出后方向仍是满推 */
const STICK_RADIUS = 52

/** 角色 → 动作按钮显示的字（对应各自空格技能） */
const ACTION_GLYPH: Record<Role, string> = {
  0: '扑', // 老鹰扑击
  1: '翅', // 母鸡开/收翅膀
  2: '蹲', // 小鸡紧急蹲下
}

export class TouchControls {
  private root: HTMLElement
  private stickBase!: HTMLElement
  private stickKnob!: HTMLElement
  private actionBtn!: HTMLElement
  private ctrl: InputController | null = null

  /** 当前正在控制摇杆的 pointerId（-1 = 空闲）——只认第一根手指，避免多指打架 */
  private stickPointer = -1
  private baseCX = 0
  private baseCY = 0

  constructor(root: HTMLElement) {
    this.root = root
    this.build()
    this.hide()
  }

  /** 把控件绑到当前对局的 InputController（每局 create 时调一次） */
  attach(ctrl: InputController): void {
    this.ctrl = ctrl
  }

  /** 设置动作按钮图标（按玩家角色） */
  setRole(role: Role): void {
    this.actionBtn.textContent = ACTION_GLYPH[role] ?? '·'
  }

  show(): void {
    this.stickZone.classList.remove('hidden')
    this.actionBtn.classList.remove('hidden')
  }

  hide(): void {
    this.stickZone.classList.add('hidden')
    this.actionBtn.classList.add('hidden')
    this.releaseStick()
  }

  private build(): void {
    // 摇杆底盘（按下才移到手指处，平时停在左下角作提示）
    const base = document.createElement('div')
    base.className = 'touch-stick'
    const knob = document.createElement('div')
    knob.className = 'touch-knob'
    base.appendChild(knob)
    this.stickBase = base
    this.stickKnob = knob
    this.root.appendChild(base)

    // 屏幕左半的透明触控区：按下即在按下点生成摇杆
    const stickZone = document.createElement('div')
    stickZone.className = 'touch-stick-zone hidden'
    this.root.appendChild(stickZone)
    this.stickZone = stickZone

    // 动作按钮（右下）
    const btn = document.createElement('div')
    btn.className = 'touch-action hidden'
    btn.textContent = '·'
    this.actionBtn = btn
    this.root.appendChild(btn)

    this.bindStick(stickZone)
    this.bindAction(btn)
  }
  private stickZone!: HTMLElement

  private bindStick(zone: HTMLElement): void {
    const onDown = (e: PointerEvent) => {
      if (this.stickPointer !== -1) return
      e.preventDefault()
      this.stickPointer = e.pointerId
      this.baseCX = e.clientX
      this.baseCY = e.clientY
      // 摇杆底盘居中到按下点
      this.stickBase.style.left = `${e.clientX}px`
      this.stickBase.style.top = `${e.clientY}px`
      this.stickBase.classList.add('active')
      this.updateKnob(0, 0)
      try {
        zone.setPointerCapture(e.pointerId)
      } catch {
        // capture 可选，失败也能靠 pointermove 全局工作
      }
    }
    const onMove = (e: PointerEvent) => {
      if (e.pointerId !== this.stickPointer) return
      e.preventDefault()
      let dx = e.clientX - this.baseCX
      let dy = e.clientY - this.baseCY
      const len = Math.hypot(dx, dy)
      const clamped = Math.min(len, STICK_RADIUS)
      const nx = len > 0 ? (dx / len) : 0
      const ny = len > 0 ? (dy / len) : 0
      this.updateKnob(nx * clamped, ny * clamped)
      // 方向输出：按拖动比例给方向（满推 = 单位向量），y 屏幕向下 = sim +y
      const mag = clamped / STICK_RADIUS
      this.ctrl?.setTouchMove({ x: nx * mag, y: ny * mag })
    }
    const onUp = (e: PointerEvent) => {
      if (e.pointerId !== this.stickPointer) return
      e.preventDefault()
      this.releaseStick()
    }
    zone.addEventListener('pointerdown', onDown)
    // move/up 挂 window：手指滑出 zone 也不丢
    window.addEventListener('pointermove', onMove, { passive: false })
    window.addEventListener('pointerup', onUp)
    window.addEventListener('pointercancel', onUp)
  }

  private bindAction(btn: HTMLElement): void {
    btn.addEventListener('pointerdown', (e) => {
      e.preventDefault()
      btn.classList.add('pressed')
      this.ctrl?.pressTouchAction()
    })
    const clear = () => btn.classList.remove('pressed')
    btn.addEventListener('pointerup', clear)
    btn.addEventListener('pointercancel', clear)
    btn.addEventListener('pointerleave', clear)
  }

  private updateKnob(x: number, y: number): void {
    this.stickKnob.style.transform = `translate(calc(-50% + ${x}px), calc(-50% + ${y}px))`
  }

  private releaseStick(): void {
    this.stickPointer = -1
    this.stickBase.classList.remove('active')
    this.updateKnob(0, 0)
    this.ctrl?.setTouchMove({ x: 0, y: 0 })
  }
}
