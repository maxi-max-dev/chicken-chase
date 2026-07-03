// DOM 蒙层：主菜单 / 开局说明 / HUD / 结算。文案全走 strings.ts。
// UI 只跟 app 状态机说话，不直接碰 sim 或 Phaser 场景。

import { S } from '../strings'
import { app } from '../app'
import type { Role, SimState } from '../sim/types'

function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  cls?: string,
  text?: string,
): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag)
  if (cls) e.className = cls
  if (text !== undefined) e.textContent = text
  return e
}

export interface UICallbacks {
  onStart: (role: Role) => void
  onRestart: () => void
  onMenu: () => void
}

export class UI {
  root: HTMLElement
  private menu!: HTMLElement
  private tutorial!: HTMLElement
  private hud!: HTMLElement
  private result!: HTMLElement
  private hudTime!: HTMLElement
  private hudScore!: HTMLElement
  private hudAlive!: HTMLElement
  private selectedRole: Role = 0
  private cb: UICallbacks

  constructor(root: HTMLElement, cb: UICallbacks) {
    this.root = root
    this.cb = cb
    this.buildMenu()
    this.buildTutorial()
    this.buildHUD()
    this.buildResult()
    this.showMenu()
    this.bindKeys()
  }

  // ---- 主菜单 ----
  private buildMenu(): void {
    const m = el('div', 'overlay menu')
    m.appendChild(el('h1', 'title', S.title))
    m.appendChild(el('p', 'subtitle', S.subtitle))
    m.appendChild(el('div', 'section-label', S.menuRoleHeader))

    const roleLabels = [S.roleEagle, S.roleHen, S.roleChick]
    const rolesWrap = el('div', 'roles')
    roleLabels.forEach((label, i) => {
      const btn = el('button', 'role-btn', label)
      btn.dataset.role = String(i)
      btn.addEventListener('click', () => this.selectRole(i as Role))
      rolesWrap.appendChild(btn)
    })
    m.appendChild(rolesWrap)

    const start = el('button', 'start-btn', S.menuStart)
    start.addEventListener('click', () => this.cb.onStart(this.selectedRole))
    m.appendChild(start)
    m.appendChild(el('p', 'hint', S.menuKeyHint))
    this.menu = m
    this.root.appendChild(m)
    this.selectRole(0)
  }

  private selectRole(r: Role): void {
    this.selectedRole = r
    this.menu.querySelectorAll('.role-btn').forEach((b) => {
      const btn = b as HTMLElement
      btn.classList.toggle('sel', btn.dataset.role === String(r))
    })
  }

  // ---- 开局说明蒙层 ----
  private buildTutorial(): void {
    const t = el('div', 'overlay tutorial hidden')
    t.appendChild(el('h2', '', S.tutorialGoal))
    this.tutorialSkill = el('p', 'skill', '')
    t.appendChild(this.tutorialSkill)
    t.appendChild(el('p', 'move', S.tutorialMove))
    t.appendChild(el('p', 'start-cue', S.tutorialStart))
    this.tutorial = t
    this.root.appendChild(t)
  }
  private tutorialSkill!: HTMLElement

  // ---- HUD ----
  private buildHUD(): void {
    const h = el('div', 'hud hidden')
    this.hudTime = el('span', 'hud-time', '90')
    this.hudScore = el('span', 'hud-score', '')
    this.hudAlive = el('span', 'hud-alive', '')
    h.appendChild(this.hudTime)
    h.appendChild(this.hudScore)
    h.appendChild(this.hudAlive)
    this.hud = h
    this.root.appendChild(h)
  }

  // ---- 结算 ----
  private buildResult(): void {
    const r = el('div', 'overlay result hidden')
    this.resultTitle = el('h2', 'result-title', '')
    this.resultSub = el('p', 'result-sub', '')
    const again = el('button', 'start-btn', S.again)
    again.addEventListener('click', () => this.cb.onRestart())
    const menu = el('button', 'role-btn', S.backToMenu)
    menu.addEventListener('click', () => this.cb.onMenu())
    r.appendChild(this.resultTitle)
    r.appendChild(this.resultSub)
    r.appendChild(again)
    r.appendChild(menu)
    this.result = r
    this.root.appendChild(r)
  }
  private resultTitle!: HTMLElement
  private resultSub!: HTMLElement

  private bindKeys(): void {
    window.addEventListener('keydown', (e) => {
      if (app.phase === 'menu') {
        if (e.key === '1') this.selectRole(0)
        else if (e.key === '2') this.selectRole(1)
        else if (e.key === '3') this.selectRole(2)
        else if (e.key === 'Enter') this.cb.onStart(this.selectedRole)
      } else if (app.phase === 'ingame' && !this.result.classList.contains('hidden')) {
        if (e.key === 'r' || e.key === 'R') this.cb.onRestart()
      }
    })
  }

  // ---- 显隐控制 ----
  showMenu(): void {
    this.menu.classList.remove('hidden')
    this.tutorial.classList.add('hidden')
    this.hud.classList.add('hidden')
    this.result.classList.add('hidden')
  }

  showGame(role: Role): void {
    this.menu.classList.add('hidden')
    this.result.classList.add('hidden')
    const skill = [S.skillEagle, S.skillHen, S.skillChick][role]
    this.tutorialSkill.textContent = skill
    this.tutorial.classList.remove('hidden')
    this.hud.classList.remove('hidden')
  }

  /** sim 进入 playing 后隐藏开局说明 */
  hideTutorial(): void {
    this.tutorial.classList.add('hidden')
  }

  showResult(winner: string, score: number): void {
    this.result.classList.remove('hidden')
    this.resultTitle.textContent = winner === 'eagle' ? S.eagleWin : S.flockWin
    this.resultSub.textContent = S.resultCaught.replace('{n}', String(score))
  }

  /** 每帧刷新 HUD 数字 */
  updateHUD(s: SimState): void {
    this.hudTime.textContent = String(Math.ceil(s.timeLeft))
    this.hudScore.textContent = `${S.hudCaught} ${s.score}/${liveCatchesToWin}`
    this.hudAlive.textContent = `${S.hudAlive} ${s.chicks.length}`
    if (s.phase === 'playing') this.hideTutorial()
  }
}

// HUD 需要显示目标抓捕数——从 config 取（避免 UI 直接依赖循环 import，用轻量常量）
import { defaultConfig } from '../sim/config'
const liveCatchesToWin = defaultConfig.catchesToWin
