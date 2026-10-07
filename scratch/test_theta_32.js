import { Boss } from '../src/game/Boss.js';
import { Player } from '../src/game/Player.js';
import { BossBullet } from '../src/game/BossBullet.js';

console.log('Testing theta = 0.32...');

const theta = 0.32;
const boss = new Boss(400, 130, {
  phaseSequence: [7, 5, 8, 4, 9],
  phaseHps: [7, 7, 8, 9, 11],
  enableBullets: true
});

boss.fireSnipeLance = function(p) {
  if (!p) return;
  const dx = p.x - this.x;
  const dy = p.y - this.y;
  const angle = Math.atan2(dy, dx);
  const speed = 360;
  [-theta, 0, theta].forEach(offset => {
    const a = angle + offset;
    const vx = Math.cos(a) * speed;
    const vy = Math.sin(a) * speed;
    this.bullets.push(new BossBullet(this.x, this.y, vx, vy));
  });
};

// 1. Stationary test: should be HIT
{
  const p = new Player(400, 430, boss);
  boss.bullets = [];
  boss.fireSnipeLance(p);
  let hit = false;
  for (let f = 0; f < 90; f++) {
    p.update(1/60, { getMovementVector: () => ({ x: 0, y: 0 }) }, 800, 800, boss.bullets);
    boss.update(1/60, f/60, p, { recordHit() {}, getFrequency() { return 4; } });
    if (p.hp < 3) { hit = true; break; }
  }
  console.log('Stationary test (expect HIT): ' + (hit ? 'HIT (PASS)' : 'MISSED (FAIL)'));
}

// 2. Micro-dodge test (move left by 35px): should NOT be hit
{
  const p = new Player(400, 430, boss);
  boss.bullets = [];
  boss.fireSnipeLance(p);
  let hit = false;
  for (let f = 0; f < 90; f++) {
    // move left until x <= 365, then stay
    const moveX = p.x > 365 ? -1 : 0;
    p.update(1/60, { getMovementVector: () => ({ x: moveX, y: 0 }) }, 800, 800, boss.bullets);
    boss.update(1/60, f/60, p, { recordHit() {}, getFrequency() { return 4; } });
    if (p.hp < 3) { hit = true; break; }
  }
  console.log('Micro-dodge test (expect CLEAN DODGE): ' + (!hit ? 'CLEAN (PASS)' : 'HIT (FAIL)'));
}
