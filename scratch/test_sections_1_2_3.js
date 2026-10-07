import { Boss } from '../src/game/Boss.js';
import { Player } from '../src/game/Player.js';

console.log('==============================================');
console.log(' SECTION 1 -> 2 -> 3 CHAIN TEST');
console.log('==============================================');

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

// SECTION 1 (Phase 0: 7 WP, 7 HP)
console.log('\n--- Running Section 1 ---');
let p0Blinked = false;
while (elapsed < 5.0 && boss.currentPhaseIndex === 0) {
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
console.log(`Section 1 Complete at ${elapsed.toFixed(3)}s! Player: (${player.x.toFixed(1)}, ${player.y.toFixed(1)}), HP: ${player.hp}`);

// SECTION 2 (Phase 1: 5 WP, 7 HP)
console.log('\n--- Running Section 2 ---');
player.skill1CdTimer = 0;
player.skill2CdTimer = 0;
let p1Shielded = false;
const p1Start = elapsed;

while (elapsed < 12.0 && boss.currentPhaseIndex === 1) {
  elapsed += dt;
  const input = {
    keys: {},
    actions: [],
    consumeSkill2() { return false; },
    consumeSkill3() {
      const idx = this.actions.indexOf('skill3');
      if (idx !== -1) {
        this.actions.splice(idx, 1);
        return true;
      }
      return false;
    },
    getMovementVector() {
      let x = 0, y = 0;
      if (this.keys['KeyW']) y -= 1;
      if (this.keys['KeyS']) y += 1;
      return { x, y };
    }
  };

  if (!boss.shield.isBroken && !boss.shield.isShattering) {
    // 纯 S 后退，红移拉伸刚好匹配 72°，保持 X=400 轴线不变！
    input.keys['KeyS'] = true;
  } else {
    if (!p1Shielded) {
      input.actions.push('skill3');
      p1Shielded = true;
    }
    // 碎盾与伤害阶段：保持不动或微幅后退，由力场盾吸收保护
    // 保持静止让子弹迅速打满 7 点伤害！
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
console.log(`Section 2 Complete at ${elapsed.toFixed(3)}s! Player: (${player.x.toFixed(1)}, ${player.y.toFixed(1)}), HP: ${player.hp}`);

// SECTION 3 (Phase 2: 8 WP, 8 HP)
console.log('\n--- Running Section 3 ---');
player.skill1CdTimer = 0;
player.skill2CdTimer = 0;
let p2Blinked = false;
const p2Start = elapsed;

while (elapsed < 18.0 && boss.currentPhaseIndex === 2) {
  elapsed += dt;
  const p2Time = elapsed - p2Start;

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
    // 0 ~ 0.82s: W 前推击破前 4 盾
    if (!p2Blinked && p2Time >= 0.82) {
      input.keys['KeyA'] = true;
      input.actions.push('skill2');
      p2Blinked = true;
    } else if (p2Blinked) {
      // 闪现后：W+D 斜向切入回正 (击破后 4 盾)
      input.keys['KeyW'] = true;
      input.keys['KeyD'] = true;
    } else {
      input.keys['KeyW'] = true;
    }
  } else {
    // 碎盾与暴露虚弱期：前冲进圈，进入圈内后保持在圈内！
    const curDist = Math.hypot(player.x - boss.x, player.y - boss.y);
    if (curDist > 50 && player.y > boss.y + 40) {
      input.keys['KeyW'] = true;
    }
  }

  player.update(dt, input, w, h, boss.bullets);
  boss.update(dt, elapsed, player, { recordHit() {}, getFrequency() { return 4.0; } });

  for (const b of player.bullets) {
    if (!b.alive) continue;
    if (!boss.shield.isBroken) {
      if (boss.shield.checkBulletCollision(b, null, Date.now())) continue;
      if (!boss.shield.isShattering) {
        if (Math.hypot(b.x - boss.x, b.y - boss.y) <= boss.radius + 6) {
          b.alive = false;
          boss.takeDamage(1, null, Date.now());
        }
      }
    } else {
      if (Math.hypot(b.x - boss.x, b.y - boss.y) <= boss.radius + 6) {
        b.alive = false;
        boss.takeDamage(1, null, Date.now());
      }
    }
  }
}

const distToBoss = Math.hypot(player.x - boss.x, player.y - boss.y);
const isInside = distToBoss <= boss.shield.radius;
console.log(`Section 3 Complete at ${elapsed.toFixed(3)}s! Player: (${player.x.toFixed(1)}, ${player.y.toFixed(1)}), HP: ${player.hp}, DistToBoss: ${distToBoss.toFixed(1)}px (Shield R: ${boss.shield.radius}px, isInside: ${isInside})`);
console.log(`Section 3 Status: Phase = ${boss.currentPhaseIndex}, isInside = ${isInside}, Success = ${boss.currentPhaseIndex === 3 && player.hp === 3 && isInside}`);
