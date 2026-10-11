import { Boss } from '../src/game/Boss.js';
import { Player } from '../src/game/Player.js';

const dt = 1 / 60;
const w = 800;
const h = 800;

const boss = new Boss(w / 2, 130, { phaseSequence: [7, 5, 8, 4, 9], phaseHps: [7, 7, 8, 9, 11], enableBullets: false });
boss.currentPhaseIndex = 4;
boss.currentPhaseHp = 11;
boss.shield.setConfiguration(9, 1.45);

// Test different D durations / timings from initial pos (466, 364):
for (let dDuration of [0.3, 0.5, 0.8, 1.0, 1.2, 1.5, 2.0]) {
  const b = new Boss(w / 2, 130, { phaseSequence: [7, 5, 8, 4, 9], phaseHps: [7, 7, 8, 9, 11], enableBullets: false });
  b.currentPhaseIndex = 4;
  b.currentPhaseHp = 11;
  b.shield.setConfiguration(9, 1.45);

  const p = new Player(466, 364, b);
  p.autoFire = true;

  let t = 0;
  while (t < 3.0 && !b.shield.isBroken) {
    t += dt;
    const input = {
      keys: { 'KeyW': true }, actions: [],
      consumeSkill2() { return false; },
      consumeSkill3() { return false; },
      getMovementVector() {
        let x = 0, y = 0;
        if (this.keys['KeyW']) y -= 1;
        if (this.keys['KeyS']) y += 1;
        if (this.keys['KeyA']) x -= 1;
        if (this.keys['KeyD']) x += 1;
        if (x !== 0 && y !== 0) { const inv = 0.7071; return { x: x * inv, y: y * inv }; }
        return { x, y };
      }
    };

    if (t >= 0.8 && t < 0.8 + dDuration) {
      input.keys['KeyD'] = true;
    }

    p.update(dt, input, w, h, []);
    b.update(dt, t, p, { recordHit() {}, getFrequency() { return 4.0; } });

    for (const bullet of p.bullets) {
      if (!bullet.alive) continue;
      b.shield.checkBulletCollision(bullet, null, Date.now());
    }
  }

  const brokenCount = b.shield.weakpoints.filter(wp => wp === false).length;
  console.log(`dDuration ${dDuration.toFixed(1)}s: time=${t.toFixed(3)}s, isBroken=${b.shield.isBroken}, broken=${brokenCount}/9, endX=${p.x.toFixed(1)}`);
}
