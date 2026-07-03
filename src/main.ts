// 入口：装配 Phaser 游戏 + DOM UI + app 状态机，三者互不直接引用彼此内部。
// 固定步长循环在 GameScene 里；main 只负责生命周期编排。

import Phaser from 'phaser'
import { VIEW } from './sim/config'
import { app } from './app'
import { GameScene, type SceneHooks } from './render/GameScene'
import { UI } from './ui/ui'
import { TouchControls } from './ui/touch'
import { isTouchDevice } from './render/input'
import type { Role, SimState } from './sim/types'

const SCALE = 3

const uiRoot = document.getElementById('ui')!
const gameRoot = document.getElementById('game')!

let game: Phaser.Game | null = null
let seed = 1

// 触屏虚拟控件（仅触屏设备创建/显示）
const touch = isTouchDevice() ? new TouchControls(uiRoot) : null

const hooks: SceneHooks = {
  onResult: (winner, score) => ui.showResult(winner, score),
  onTick: (s: SimState) => ui.updateHUD(s),
  onSceneReady: (controls) => touch?.attach(controls),
}

function startGame(role: Role): void {
  app.startGame(role)
  ui.showGame(role)
  seed = (Date.now() & 0x7fffffff) || 1
  if (touch) {
    touch.setRole(role)
    touch.show()
  }

  if (!game) {
    game = new Phaser.Game({
      type: Phaser.AUTO,
      parent: gameRoot,
      width: VIEW.w * SCALE,
      height: VIEW.h * SCALE,
      pixelArt: true,
      backgroundColor: '#c8e6a0',
      scene: [GameScene],
      scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
    })
    game.scene.start('game', { role, seed, hooks })
    // 开发期调试钩子（生产构建不注入）：方便无头验证手感/状态
    if (import.meta.env.DEV) (window as unknown as { __game: Phaser.Game }).__game = game
  } else {
    const scene = game.scene.getScene('game') as unknown as GameScene
    scene.restart(role, seed)
  }
}

function restart(): void {
  startGame(app.role)
}

function backToMenu(): void {
  app.backToMenu()
  ui.showMenu()
  touch?.hide()
  if (game) game.scene.stop('game')
}

const ui = new UI(uiRoot, {
  onStart: startGame,
  onRestart: restart,
  onMenu: backToMenu,
})
