import { Boss } from '../src/game/Boss.js';
import { Player } from '../src/game/Player.js';

console.log('--- Testing exact 5-WP break timing and circling ---');

const w = 800;
const h = 800;
const dt = 1 / 60;

// Run Phase 0 (7 WP)
const boss = new Boss(w / 2, 130, {
  phaseSequence: [7, 5, 8, 4, 9],
  phaseHps: [7, 7, 8, 9, 11],
  enableBullets: true
});
const player = new Player(w / 2, h - 90, boss);
player.autoFire = true;

let elapsed = 0;
let p0Blinked = false;

while (elapsed < 5.0 && boss.currentPhaseIndex < 1) {
  elapsed += dt;
  const input = {
    keys: {},
    actions: [],
    consumeSkill2() { return this.actions.includes('skill2'); },
    consumeSkill3() { return false; },
    getMovementVector() {
      let x = 0, y = 0;
      if (this.keys['KeyW']) y -= 1;
      if (this.keys['KeyS']) y += 1;
      return { x, y };
    }
  };

  if (!boss.shield.isBroken && !boss.shield.isShattering) {
    input.keys['KeyW'] = true;
  } else if (!p0Blinked) {
    input.keys['KeyS'] = true;
    input.actions.push('skill2');
    p0Blinked = true;
  } else {
    input.keys['KeyW'] = true;
  }

  player.update(dt, input, w, h, boss.bullets);
  boss.update(dt, elapsed, player, { recordHit() {}, getFrequency() { return 4.0; } });

  for (const b of player.bullets) {
    if (!b.alive) continue;
    if (!boss.shield.isBroken) {
      if (boss.shield.checkBulletCollision(b, null, Date.now())) continue;
    } else {
      if (Math.hypot(b.x - boss.x, b.y - boss.y) <= boss.radius + 6) {
        b.alive = false;
        boss.takeDamage(1, null, Date.now());
      }
    }
  }
}

console.log(`Phase 0 complete at ${elapsed.toFixed(3)}s. Player pos: (${player.x.toFixed(1)}, ${player.y.toFixed(1)})`);

// Now track Phase 1 (5 WP) step-by-step
player.skill1CdTimer = 0;
player.skill2CdTimer = 0;
const p1Start = elapsed;
let p1ShieldTime = null;
let p1BreakTime = null;

while (elapsed < 12.0 && boss.currentPhaseIndex < 2) {
  elapsed += dt;
  const p1Time = elapsed - p1Start;

  const input = {
    keys: {},
    actions: [],
    consumeSkill2() { return false; },
    consumeSkill3() { return this.actions.includes('skill3'); },
    getMovementVector() {
      let x = 0, y = 0;
      if (this.keys['KeyW']) y -= 1;
      if (this.keys['KeyS']) y += 1;
      if (this.keys['KeyA']) x -= 1;
      if (this.keys['KeyD']) x -= 1;
      return { x, y };
    }
  };

  // 破盾期：S + A 转圈
  if (!boss.shield.isBroken && !boss.shield.isShattering) {
    input.keys['KeyS'] = true;
    input.keys['KeyA'] = true;
  } else {
    if (!p1BreakTime) {
      p1BreakTime = elapsed;
      console.log(`Phase 1 shield broken at ${p1Time.toFixed(3)}s! Remaining WP: ${boss.shield.weakpoints}`);
    }
    // 破盾后开 L 护盾，且保持不动补齐输出
    if (!p1ShieldTime) {
      input.actions.push('skill3');
      p1ShieldTime = elapsed;
    }
    // 不动补齐输出
  }

  player.update(dt, input, w, h, boss.bullets);
  boss.update(dt, elapsed, player, { recordHit() {}, getFrequency() { return 4.0; } });

  for (const b of player.bullets) {
    if (!b.alive) continue;
    if (!boss.shield.isBroken) {
      if (boss.shield.checkBulletCollision(b, null, Date.now())) continue;
    } else {
      if (Math.hypot(b.x - boss.x, b.y - boss.y) <= boss.radius + 6) {
        b.alive = false;
        boss.takeDamage(1, null, Date.now());
      }
    }
  }
}

console.log(`Phase 1 complete at ${elapsed.toFixed(3)}s! Player pos: (${player.x.toFixed(1)}, ${player.y.toFixed(1)}), HP: ${player.hp}`);
