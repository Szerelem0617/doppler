import { Boss } from '../src/game/Boss.js';
import { Player } from '../src/game/Player.js';

console.log('--- Testing Section 2 (5-WP) with Return to Center ---');

const w = 800;
const h = 800;
const dt = 1 / 60;

const boss = new Boss(w / 2, 130, {
  phaseSequence: [7, 5, 8, 4, 9],
  phaseHps: [7, 7, 8, 9, 11],
  enableBullets: true
});
const player = new Player(w / 2, h - 90, boss);
player.autoFire = true;

let elapsed = 0;
let p0Blinked = false;

// 1. Phase 0
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

// 2. Phase 1 (5 WP): S+A 破盾，然后开 L 盾并在后移/输出时向右回中 (KeyD)
player.skill1CdTimer = 0;
player.skill2CdTimer = 0;
let p1ShieldUsed = false;

while (elapsed < 12.0 && boss.currentPhaseIndex < 2) {
  elapsed += dt;
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

  if (!boss.shield.isBroken && !boss.shield.isShattering) {
    // 破盾：向后 S + 向左 A (逆时针抵消角位移)
    input.keys['KeyS'] = true;
    input.keys['KeyA'] = true;
  } else {
    // 碎盾/伤害期：开 L 护盾反弹并向右 D 回正轴线！
    if (!p1ShieldUsed) {
      input.actions.push('skill3');
      p1ShieldUsed = true;
    }
    input.keys['KeyS'] = true;
    if (player.x < 395) {
      input.keys['KeyD'] = true;
    }
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
