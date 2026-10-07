import { Boss } from '../src/game/Boss.js';
import { Player } from '../src/game/Player.js';

console.log('--- Diagnosing Section 3 Weakpoint Hits ---');

const w = 800;
const h = 800;
const dt = 1 / 60;

// Setup Boss directly at Phase 2 (8 WP, 8 HP) with player at (400, 559)
const boss = new Boss(w / 2, 130, {
  phaseSequence: [7, 5, 8, 4, 9],
  phaseHps: [7, 7, 8, 9, 11],
  enableBullets: true
});
boss.currentPhaseIndex = 2;
boss.currentPhaseHp = 8;
boss.shield.setConfiguration(8, 2.8);

const player = new Player(400, 559, boss);
player.autoFire = true;

let elapsed = 0;
let p2Blinked = false;
let hitLog = [];

while (elapsed < 4.0) {
  elapsed += dt;

  const input = {
    keys: {},
    actions: [],
    consumeSkill2() {
      const idx = this.actions.indexOf('skill2');
      if (idx !== -1) {
        this.actions.splice(idx, 1);
        return true;
      }
      return false;
    },
    consumeSkill3() { return false; },
    getMovementVector() {
      let x = 0, y = 0;
      if (this.keys['KeyW']) y -= 1;
      if (this.keys['KeyS']) y += 1;
      if (this.keys['KeyA']) x -= 1;
      if (this.keys['KeyD']) x += 1;
      return { x, y };
    }
  };

  if (!boss.shield.isBroken && !boss.shield.isShattering) {
    if (!p2Blinked && elapsed >= 0.82) {
      input.keys['KeyA'] = true;
      input.actions.push('skill2');
      p2Blinked = true;
      console.log(`Blinked at t=${elapsed.toFixed(3)}s! Player pos: (${player.x.toFixed(1)}, ${player.y.toFixed(1)})`);
    } else if (p2Blinked) {
      input.keys['KeyW'] = true;
      input.keys['KeyD'] = true;
    } else {
      input.keys['KeyW'] = true;
    }
  } else {
    // 碎盾与虚弱期
    const curDist = Math.hypot(player.x - boss.x, player.y - boss.y);
    if (curDist > 55) {
      input.keys['KeyW'] = true;
    }
  }

  player.update(dt, input, w, h, boss.bullets);
  boss.update(dt, elapsed, player, { recordHit() {}, getFrequency() { return 4.0; } });

  for (const b of player.bullets) {
    if (!b.alive) continue;
    if (!boss.shield.isBroken) {
      if (boss.shield.checkBulletCollision(b, null, Date.now())) {
        hitLog.push({ t: elapsed.toFixed(3), wp: boss.shield.weakpoints.map(x => x?1:0).join('') });
      }
    } else {
      if (Math.hypot(b.x - boss.x, b.y - boss.y) <= boss.radius + 6) {
        b.alive = false;
        boss.takeDamage(1, null, Date.now());
      }
    }
  }

  if (boss.shield.isBroken && !boss.shield.isShattering && boss.currentPhaseHp <= 0) {
    console.log(`Phase 2 complete at t=${elapsed.toFixed(3)}s!`);
    break;
  }
}

console.log('Hit log:');
for (const h of hitLog) {
  console.log(`  t=${h.t}s: ${h.wp}`);
}
console.log(`Final state: PhaseHp=${boss.currentPhaseHp}, ShieldBroken=${boss.shield.isBroken}, isShattering=${boss.shield.isShattering}, Player pos=(${player.x.toFixed(1)}, ${player.y.toFixed(1)}), DistToBoss=${Math.hypot(player.x - boss.x, player.y - boss.y).toFixed(1)}`);
