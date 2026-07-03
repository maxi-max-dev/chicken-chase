// 程序生成像素精灵：把小像素图（字符网格）画进 Phaser Texture。
// 不追求美术精致，追求俯视一眼可辨（母鸡/小鸡/老鹰各一个可认形象 + 两帧走路）。
// 生成一次缓存进 TextureManager，渲染层按名字取用。

import Phaser from 'phaser'

/** 调色板：字符 → 颜色（'.'=透明） */
type Palette = Record<string, string>

/** 用字符网格画一张纹理。每个字符 = scale×scale 像素块。 */
function paint(
  scene: Phaser.Scene,
  key: string,
  rows: string[],
  palette: Palette,
  scale = 1,
): void {
  if (scene.textures.exists(key)) return
  const h = rows.length
  const w = rows[0].length
  const g = scene.make.graphics({ x: 0, y: 0 }, false)
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const ch = rows[y][x]
      if (ch === '.' || ch === ' ') continue
      const col = palette[ch]
      if (!col) continue
      g.fillStyle(Phaser.Display.Color.HexStringToColor(col).color, 1)
      g.fillRect(x * scale, y * scale, scale, scale)
    }
  }
  g.generateTexture(key, w * scale, h * scale)
  g.destroy()
}

// ---- 像素图案（面朝右，渲染时按 facing 旋转）----

// 母鸡：胖身子 + 冠 + 喙，两帧腿
const HEN_PAL: Palette = { B: '#e8c07d', b: '#c9973f', R: '#d94a3a', Y: '#f4b942', E: '#2a2a2a', W: '#fff3d6' }
const HEN_A = [
  '...RR....',
  '..RRR....',
  '.BBBBBB..',
  'BBBBBBBBY',
  'BBBBEBBBY',
  'BBBBBBBB.',
  '.bBBBBb..',
  '..b..b...',
  '..b......',
]
const HEN_B = [
  '...RR....',
  '..RRR....',
  '.BBBBBB..',
  'BBBBBBBBY',
  'BBBBEBBBY',
  'BBBBBBBB.',
  '.bBBBBb..',
  '...b..b..',
  '......b..',
]

// 母鸡张翅：身子两侧伸出翅膀
const HEN_WING_A = [
  '....RR.....',
  '...RRR.....',
  'W.BBBBBB..W',
  'WWBBBBBBBYW',
  '.WBBBEBBBW.',
  'W.BBBBBB.W.',
  '..bBBBBb...',
  '...b..b....',
  '...b.......',
]
const HEN_WING_B = [
  '....RR.....',
  '...RRR.....',
  'W.BBBBBB..W',
  'WWBBBBBBBYW',
  '.WBBBEBBBW.',
  'W.BBBBBB.W.',
  '..bBBBBb...',
  '....b..b...',
  '.......b...',
]

// 小鸡：小黄团 + 喙
const CHICK_PAL: Palette = { Y: '#ffe14d', y: '#e6b800', O: '#ff9d2e', E: '#2a2a2a' }
const CHICK_A = ['.YYY.', 'YYYYY', 'YYEYO', 'YYYYY', '.y.y.']
const CHICK_B = ['.YYY.', 'YYYYY', 'YYEYO', 'YYYYY', 'y.y..']
// 脱链警戒色（红橙）
const CHICK_ALERT_PAL: Palette = { Y: '#ff8a3d', y: '#c94a1a', O: '#ffd23d', E: '#2a2a2a' }

// 老鹰：深褐 + 尖喙 + 张翼
const EAGLE_PAL: Palette = { D: '#6b4423', d: '#4a2f18', Y: '#f4b942', E: '#ffd23d', W: '#8a5a2b' }
const EAGLE_A = [
  'W.......W',
  'WW.DDD.WW',
  '.WDDDDDW.',
  '.DDDDEDDY',
  '.DDDDDDDY',
  '..dDDDd..',
  '...d.d...',
]
const EAGLE_B = [
  '.W.....W.',
  'WWW.DDD.W',
  '.WDDDDDWW',
  '.DDDDEDDY',
  '.DDDDDDDY',
  '..dDDDd..',
  '...d.d...',
]

export const TEX = {
  henA: 'hen_a',
  henB: 'hen_b',
  henWingA: 'hen_wing_a',
  henWingB: 'hen_wing_b',
  chickA: 'chick_a',
  chickB: 'chick_b',
  chickAlertA: 'chick_alert_a',
  chickAlertB: 'chick_alert_b',
  eagleA: 'eagle_a',
  eagleB: 'eagle_b',
} as const

/** 生成全部精灵纹理（scene.create 里调一次） */
export function buildSprites(scene: Phaser.Scene): void {
  paint(scene, TEX.henA, HEN_A, HEN_PAL)
  paint(scene, TEX.henB, HEN_B, HEN_PAL)
  paint(scene, TEX.henWingA, HEN_WING_A, HEN_PAL)
  paint(scene, TEX.henWingB, HEN_WING_B, HEN_PAL)
  paint(scene, TEX.chickA, CHICK_A, CHICK_PAL)
  paint(scene, TEX.chickB, CHICK_B, CHICK_PAL)
  paint(scene, TEX.chickAlertA, CHICK_A, CHICK_ALERT_PAL)
  paint(scene, TEX.chickAlertB, CHICK_B, CHICK_ALERT_PAL)
  paint(scene, TEX.eagleA, EAGLE_A, EAGLE_PAL)
  paint(scene, TEX.eagleB, EAGLE_B, EAGLE_PAL)
}
