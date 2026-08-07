// English copy for the en/ build. Key-for-key mirror of src/strings.ts.
// Only vite.config.en.ts pulls this file in (it swaps the strings module at
// resolve time), so the Chinese build never sees it.
// Keep lines short: style.css uses fixed font sizes and the boxes do not grow.

export const S = {
  title: 'Eagle and Chicks',
  subtitle: 'Pixel party game about a line of chicks · prototype',

  // Main menu
  menuRoleHeader: 'Choose a role',
  roleEagle: 'Eagle — catch the chicks',
  roleHen: 'Hen — keep the eagle off the chicks',
  roleChick: 'Chick — survive (you play the tail)',
  menuStart: 'Start game',
  menuKeyHint: 'Click a role or press 1 / 2 / 3 · Enter to start',

  // Opening overlay (clock paused, everyone frozen)
  skillEagle: 'Space to dive — you only catch a chick during the dive',
  skillHen: 'Space for wings — open blocks wider, closed runs faster',
  skillChick: 'Space to duck — 1s of immunity, then a cooldown',
  tutorialMove: 'WASD / arrow keys to move',
  tutorialGoal: 'Eagle: catch 3 chicks in 90s · Flock: run out the clock',
  tutorialStart: 'Press a move key to start',

  // Touch build (touch devices only; replaces the matching lines above)
  skillEagleTouch: 'Tap DIVE — you only catch a chick during the dive',
  skillHenTouch: 'Tap WING — open blocks wider, closed runs faster',
  skillChickTouch: 'Tap DUCK — 1s of immunity, then a cooldown',
  tutorialMoveTouch: 'Drag on the left half to move',
  tutorialStartTouch: 'Push the stick to start',

  // HUD
  hudCaught: 'Caught',
  hudAlive: 'Alive',
  hintDashEagle: 'Space to dive',
  hintWingsHen: 'Space for wings',
  hintCrouchChick: 'Space to duck',

  // Result
  eagleWin: 'Eagle wins!',
  flockWin: 'Flock holds out!',
  resultCaught: 'Caught {n} this round',
  again: 'Play again (R)',
  backToMenu: 'Back to menu',

  // Page
  pageTip: 'Click the game once before using the keyboard — the browser needs focus',
  pageMobile: 'Left half to move, bottom-right button for your skill',
  tuningHint: 'Tab for the tuning panel',
}
