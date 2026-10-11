import { Boss } from '../src/game/Boss.js';
import { Player } from '../src/game/Player.js';
import { BossBullet } from '../src/game/BossBullet.js';

const dt = 1 / 60;
const w = 800;
const h = 800;

console.log('================================================================');
console.log(' ATTEMPT 3: Phase 4 (9 WP, 11 HP) Simulation & Exploration');
console.log('================================================================\n');

// 1. Run through Phase 0 -> 1 -> 2 -> 3
const boss = new Boss(w / 2, 130, { phaseSequence: [7, 5, 8, 4, 9], phaseHps: [7, 7, 8, 9, 11], enableBullets: true });
const player = new Player(w / 2, 710, boss);
let elapsed = 0;
let hasBlinkedBack = false;

// Phase 0
while (elapsed < 5.0 && boss.currentPhaseIndex === 0) {
  elapsed += dt;
  const input = {
    keys: {}, actions: [],
    consumeSkill2() { const i = this.actions.indexOf('skill2'); if (i !== -1) { this.actions.splice(i, 1); return true; } return false; },
    consumeSkill3() { return false; },
    getMovementVector() { let x = 0, y = 0; if (this.keys['KeyW']) y -= 1; if (this.keys['KeyS']) y += 1; if (this.keys['KeyA']) x -= 1; if (this.keys['KeyD']) x += 1; return { x, y }; }
  };
  if (!boss.shield.isBroken && !boss.shield.isShattering) input.keys['KeyW'] = true;
  else if ((boss.shield.isShattering || boss.shield.isBroken) && !hasBlinkedBack) { input.keys['KeyS'] = true; input.actions.push('skill2'); hasBlinkedBack = true; }
  else { input.keys['KeyW'] = true; if (elapsed >= 2.4 && elapsed <= 2.85) input.keys['KeyD'] = true; else if (elapsed > 2.85 && player.x > 401) input.keys['KeyA'] = true; }

  player.update(dt, input, w, h, boss.bullets);
  boss.update(dt, elapsed, player, { recordHit() {}, getFrequency() { return 4.0; } });

  for (const b of player.bullets) {
    if (!b.alive) continue;
    if (!boss.shield.isBroken) {
      if (boss.shield.checkBulletCollision(b, null, Date.now())) continue;
      if (!boss.shield.isShattering && Math.hypot(b.x - boss.x, b.y - boss.y) <= boss.radius + 6) { b.alive = false; boss.takeDamage(1, null, Date.now()); }
    } else {
      if (Math.hypot(b.x - boss.x, b.y - boss.y) <= boss.radius + 6) { b.alive = false; boss.takeDamage(1, null, Date.now()); }
    }
  }
}

// Phase 1
const p1Start = elapsed;
let p1ShieldUsed = false;
while (elapsed < p1Start + 5.0 && boss.currentPhaseIndex === 1 && player.hp > 0) {
  elapsed += dt;
  const p1Time = elapsed - p1Start;
  const input = {
    keys: {}, actions: [],
    consumeSkill2() { return false; },
    consumeSkill3() { const i = this.actions.indexOf('skill3'); if (i !== -1) { this.actions.splice(i, 1); return true; } return false; },
    getMovementVector() { let x = 0, y = 0; if (this.keys['KeyW']) y -= 1; if (this.keys['KeyS']) y += 1; if (this.keys['KeyA']) x -= 1; if (this.keys['KeyD']) x += 1; return { x, y }; }
  };
  if (!boss.shield.isBroken && !boss.shield.isShattering) input.keys['KeyS'] = true;
  if (!p1ShieldUsed && p1Time >= 1.15) { input.actions.push('skill3'); p1ShieldUsed = true; }

  player.update(dt, input, w, h, boss.bullets);
  boss.update(dt, elapsed, player, { recordHit() {}, getFrequency() { return 4.0; } });

  for (const b of player.bullets) {
    if (!b.alive) continue;
    if (!boss.shield.isBroken) {
      if (boss.shield.checkBulletCollision(b, null, Date.now())) continue;
    } else {
      if (Math.hypot(b.x - boss.x, b.y - boss.y) <= boss.radius + 6) { b.alive = false; boss.takeDamage(1, null, Date.now()); }
    }
  }
}

// Phase 2
const p2Start = elapsed;
const cand = { targetDist: 56, lateralWeave: 8, rushDelay: 0.25 };
const targetY = boss.y + cand.targetDist;
const targetX = boss.x + cand.lateralWeave;

while (elapsed < p2Start + 6.0 && boss.currentPhaseIndex === 2 && player.hp > 0) {
  elapsed += dt;
  const pTime = elapsed - p2Start;
  const input = {
    keys: {}, actions: [],
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

  if (pTime >= cand.rushDelay) {
    if (player.y > targetY + 2) input.keys['KeyW'] = true;
    else if (player.y < targetY - 2) input.keys['KeyS'] = true;
    if (player.x < targetX - 2) input.keys['KeyD'] = true;
    else if (player.x > targetX + 2) input.keys['KeyA'] = true;
  }

  player.update(dt, input, w, h, boss.bullets);
  boss.update(dt, elapsed, player, { recordHit() {}, getFrequency() { return 4.0; } });

  for (const b of player.bullets) {
    if (!b.alive) continue;
    if (!boss.shield.isBroken) {
      if (boss.shield.checkBulletCollision(b, null, Date.now())) continue;
    } else {
      if (Math.hypot(b.x - boss.x, b.y - boss.y) <= boss.radius + 6) { b.alive = false; boss.takeDamage(1, null, Date.now()); }
    }
  }
}

// Phase 3
const p3Start = elapsed;
let p3Blinked = false;
while (elapsed < p3Start + 6.0 && boss.currentPhaseIndex === 3 && player.hp > 0) {
  elapsed += dt;
  const p3Time = elapsed - p3Start;
  const input = {
    keys: {}, actions: [],
    consumeSkill2() { const idx = this.actions.indexOf('skill2'); if (idx !== -1) { this.actions.splice(idx, 1); return true; } return false; },
    consumeSkill3() { return false; },
    getMovementVector() { let x = 0, y = 0; if (this.keys['KeyW']) y -= 1; if (this.keys['KeyS']) y += 1; if (this.keys['KeyA']) x -= 1; if (this.keys['KeyD']) x += 1; return { x, y }; }
  };

  if (!p3Blinked && p3Time >= 0.05) { input.actions.push('skill2'); p3Blinked = true; }
  if (p3Time >= 1.40) {
    input.keys['KeyW'] = true;
    if (p3Time >= 1.65 && p3Time <= 1.95) input.keys['KeyD'] = true;
  }

  player.update(dt, input, w, h, boss.bullets);
  boss.update(dt, elapsed, player, { recordHit() {}, getFrequency() { return 4.0; } });

  for (const b of player.bullets) {
    if (!b.alive) continue;
    if (!boss.shield.isBroken) {
      if (boss.shield.checkBulletCollision(b, null, Date.now())) continue;
    } else {
      if (Math.hypot(b.x - boss.x, b.y - boss.y) <= boss.radius + 6) { b.alive = false; boss.takeDamage(1, null, Date.now()); }
    }
  }
}

console.log(`Phase 4 Reached!`);
console.log(`  t=${elapsed.toFixed(3)}s, Player: (${player.x.toFixed(1)}, ${player.y.toFixed(1)}), HP=${player.hp}/3`);
console.log(`  Player skill3CdTimer (Shield CD): ${player.shieldCdTimer.toFixed(2)}s`);
console.log(`  Player skill2CdTimer (Blink CD): ${player.blinkCdTimer.toFixed(2)}s`);
console.log(`  Boss bullets from barrage: ${boss.bullets.length}`);
console.log(`  Boss shield count: ${boss.shield.count}, HP: ${boss.currentPhaseHp}`);

// Phase 4 Combat Loop
const p4Start = elapsed;
let p4ShieldUsed = false;
let p4DamageLog = [];

player.takeDamage = function(dmg) {
  if (this.invincibleTimer > 0) return false;
  if (this.skill1Active) return false;
  const hitting = boss.bullets.filter(b => Math.hypot(b.x - this.x, b.y - this.y) <= b.radius + this.radius + 15);
  console.log(`  [P4 DAMAGE] p4Time=${(elapsed - p4Start).toFixed(3)}s, hpBefore=${this.hp}, pos=(${this.x.toFixed(1)}, ${this.y.toFixed(1)})`);
  hitting.forEach(b => console.log(`     Bullet: pos=(${b.x.toFixed(1)}, ${b.y.toFixed(1)}), vel=(${b.vx.toFixed(1)}, ${b.vy.toFixed(1)})`));
  p4DamageLog.push({ t: elapsed - p4Start, hpBefore: this.hp, pos: { x: this.x, y: this.y } });
  return Player.prototype.takeDamage.call(this, dmg);
};

let prevBroken = 0;
while (elapsed < p4Start + 6.0 && !boss.isDead && player.hp > 0) {
  elapsed += dt;
  const p4Time = elapsed - p4Start;

  const input = {
    keys: {}, actions: [],
    consumeSkill2() { return false; },
    consumeSkill3() {
      const idx = this.actions.indexOf('skill3');
      if (idx !== -1) { this.actions.splice(idx, 1); return true; }
      return false;
    },
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

  // Fast break: rush W + D to break 9 weakpoints
  if (!boss.shield.isBroken && !boss.shield.isShattering) {
    input.keys['KeyW'] = true;
    input.keys['KeyD'] = true;
  } else {
    // Shield broken! Center on Boss core and laser it to death!
    const targetY = boss.y + 60;
    if (player.y > targetY + 2) input.keys['KeyW'] = true;
    else if (player.y < targetY - 2) input.keys['KeyS'] = true;

    if (player.x > boss.x + 2) input.keys['KeyA'] = true;
    else if (player.x < boss.x - 2) input.keys['KeyD'] = true;
  }

  // Use shield as soon as cooldown finishes
  if (!p4ShieldUsed && player.shieldCdTimer <= 0) {
    input.actions.push('skill3');
    p4ShieldUsed = true;
    console.log(`  [P4 Shield Activated] p4Time=${p4Time.toFixed(3)}s, t=${elapsed.toFixed(3)}s`);
  }

  player.update(dt, input, w, h, boss.bullets);
  boss.update(dt, elapsed, player, { recordHit() {}, getFrequency() { return 4.0; } });

  const curBroken = boss.shield.weakpoints.filter(wp => wp === false).length;
  if (curBroken !== prevBroken) {
    console.log(`  [P4 WP Broken] p4Time=${p4Time.toFixed(3)}s, broken=${curBroken}/9, isBroken=${boss.shield.isBroken}`);
    prevBroken = curBroken;
  }

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

console.log(`\n=== Phase 4 Battle Outcome ===`);
console.log(`  Boss isDead: ${boss.isDead}`);
console.log(`  Boss currentPhaseIndex: ${boss.currentPhaseIndex}`);
console.log(`  Boss phaseHp remaining: ${boss.currentPhaseHp}`);
console.log(`  Boss shield isBroken: ${boss.shield.isBroken}, broken weakpoints: ${boss.shield.weakpoints.filter(wp => wp === false).length}/9`);
console.log(`  Player HP: ${player.hp}/3`);
console.log(`  Phase 4 Duration: ${(elapsed - p4Start).toFixed(3)}s, Total Time: ${elapsed.toFixed(3)}s`);
console.log(`  Damage Taken Events:`, p4DamageLog);

