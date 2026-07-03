// 玩家可见文案集中地（提示词底线 #2：换语言只改这个文件）。
// ⚠️ 新增文案后必须重跑 Tools/gen_font.py 重生成像素字体子集——子集缺字 = 静默空白。

export const S = {
  title: '老鹰抓小鸡',
  subtitle: '像素鸡链派对游戏 · 原型试玩',

  // 主菜单
  menuRoleHeader: '选择角色',
  roleEagle: '老鹰 — 抓小鸡',
  roleHen: '母鸡 — 挡住老鹰护住娃',
  roleChick: '小鸡 — 活下来（你是队尾那只）',
  menuStart: '开始游戏',
  menuKeyHint: '点击或按 1 / 2 / 3 选角色 · 回车开始',

  // 开局蒙层（计时暂停，全员冻结）
  skillEagle: '空格 扑击 — 只有扑击中碰到小鸡才算抓到',
  skillHen: '空格 开/收翅膀 — 张开挡得宽，收起跑得快',
  skillChick: '空格 紧急蹲下 — 1 秒免抓，有冷却',
  tutorialMove: 'WASD / 方向键 移动',
  tutorialGoal: '90 秒内抓住 3 只老鹰赢；守到时间结束鸡群赢',
  tutorialStart: '按移动键开始',

  // 触屏版说明（仅触屏设备显示，替换上面对应几条）
  skillEagleTouch: '按「扑」钮 扑击 — 只有扑击中碰到小鸡才算抓到',
  skillHenTouch: '按「翅」钮 开/收翅膀 — 张开挡得宽，收起跑得快',
  skillChickTouch: '按「蹲」钮 紧急蹲下 — 1 秒免抓，有冷却',
  tutorialMoveTouch: '左半屏 拖动摇杆 移动',
  tutorialStartTouch: '推动摇杆开始',

  // HUD
  hudCaught: '已抓',
  hudAlive: '存活',
  hintDashEagle: '空格 扑击',
  hintWingsHen: '空格 开/收翅膀',
  hintCrouchChick: '空格 紧急蹲下',

  // 结算
  eagleWin: '老鹰赢了！',
  flockWin: '鸡群守住了！',
  resultCaught: '本局抓到 {n} 只',
  again: '再来一局 (R)',
  backToMenu: '回主菜单',

  // 网页
  pageTip: '先点一下游戏画面再按键——浏览器需要键盘焦点',
  pageMobile: '左半屏摇杆移动，右下按钮出技能',
  tuningHint: 'Tab 调参面板',
}
