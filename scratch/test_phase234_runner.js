import { Boss } from '../src/game/Boss.js';
import { Player } from '../src/game/Player.js';
import { BossBullet } from '../src/game/BossBullet.js';

const dt = 1 / 60;
const w = 800;
const h = 800;

console.log('================================================================');
console.log(' ATTEMPT 1: Phase 1 -> Phase 2 Pure Movement Full Simulation');
console.log('================================================================\n');

// 1. Run Phase 0
const boss = new Boss(w / 2, 130, { phaseSequence: [7, 5, 8, 4, 9], phaseHps: [7, 7, 8, 9, 11], enableBullets: true });
const player = new Player(w / 2, 710, boss);
let elapsed = 0;
let hasBlinkedBack = false;

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

console.log(`Phase 0 cleared at t=${elapsed.toFixed(3)}s, Player: (${player.x.toFixed(1)}, ${player.y.toFixed(1)}), HP=${player.hp}`);

// 2. Run Phase 1
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

console.log(`Phase 1 cleared at t=${elapsed.toFixed(3)}s, Player: (${player.x.toFixed(1)}, ${player.y.toFixed(1)}), HP=${player.hp}`);

// 3. Run Phase 2 (Pure Movement)
const p2Start = elapsed;
let p2HitsTaken = 0;
player.takeDamage = function() {
  if (this.invincibleTimer > 0) return false;
  p2HitsTaken++;
  console.log(`  [Phase 2 Hurt] t=${elapsed.toFixed(3)}s, pos=(${this.x.toFixed(1)}, ${this.y.toFixed(1)})`);
  return Player.prototype.takeDamage.call(this, 1);
};

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
      if (Math.hypot(b.x - boss.x, b.y - boss.y) <= boss.radius + 6) {
        b.alive = false;
        boss.takeDamage(1, null, Date.now());
      }
    }
  }
}

const p2Duration = elapsed - p2Start;
const distToBoss = Math.hypot(player.x - boss.x, player.y - boss.y);
console.log(`Phase 2 Result:`);
console.log(`  Duration: ${p2Duration.toFixed(3)}s`);
console.log(`  Phase Index: ${boss.currentPhaseIndex}`);
console.log(`  Player HP: ${player.hp}/3 (Hits taken: ${p2HitsTaken})`);
console.log(`  Player Pos: (${player.x.toFixed(1)}, ${player.y.toFixed(1)})`);
console.log(`  Dist to Boss: ${distToBoss.toFixed(1)}px (Inside circle: ${distToBoss <= 88})`);
console.log(`  Boss Bullets count: ${boss.bullets.length}`);
