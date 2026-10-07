import { Boss } from '../src/game/Boss.js';
import { Player } from '../src/game/Player.js';
import { BossBullet } from '../src/game/BossBullet.js';

console.log('--- Testing Victory Trigger and Timer Freeze ---');

const boss = new Boss(400, 130, {
  phaseSequence: [7, 5, 8, 4, 9],
  phaseHps: [7, 7, 8, 9, 11],
  enableBullets: true
});
boss.currentPhaseIndex = 4;
boss.currentPhaseHp = 1; // 1 HP left

const player = new Player(400, 169.6, boss);
player.autoFire = false; // Player not shooting! Killed solely by reflected bullet!

let speedrunSeconds = 14.25;
let isVictory = false;
let isVictoryPending = false;
let showVictoryCalled = false;
let recordedClearTime = null;

function fakeShowVictory() {
  showVictoryCalled = true;
  recordedClearTime = speedrunSeconds;
  console.log(`showVictory() called! Modal pops up with time: ${speedrunSeconds.toFixed(2)}s`);
}

const dt = 1 / 60;

// Simulate reflected bullet hitting boss
const bb = new BossBullet(400, 138, 0, -650);
bb.isReflected = true;
boss.bullets.push(bb);

for (let frame = 0; frame < 120; frame++) {
  // Timer update
  if (!isVictory && !isVictoryPending) {
    speedrunSeconds += dt;
  }

  // Boss update (bullet hits boss and kills it)
  boss.update(dt, frame * dt, player, { recordHit() {}, getFrequency() { return 4.0; } });

  // Victory detection
  if (boss.isDead && !isVictoryPending) {
    isVictory = true;
    isVictoryPending = true;
    console.log(`Boss died at frame ${frame}! Freezing timer at: ${speedrunSeconds.toFixed(2)}s`);
    setTimeout(fakeShowVictory, 800);
  }
}

console.log(`After simulation:
  isDead: ${boss.isDead}
  isVictory: ${isVictory}
  Timer value: ${speedrunSeconds.toFixed(2)}s (Must NOT keep ticking!)
`);

setTimeout(() => {
  console.log(`After 900ms:
    showVictoryCalled: ${showVictoryCalled}
    Recorded clear time in modal: ${recordedClearTime.toFixed(2)}s
    SUCCESS: ${showVictoryCalled && Math.abs(recordedClearTime - 14.25) < 0.1}
  `);
  process.exit(0);
}, 900);
