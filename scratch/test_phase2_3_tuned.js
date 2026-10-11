import { Boss } from '../src/game/Boss.js';
import { Player } from '../src/game/Player.js';

const dt = 1 / 60;
const w = 800;
const h = 800;

console.log('================================================================');
console.log(' TESTING PHASE 2 & 3 WITH UNIFORM rechargeDur = 1.45s');
console.log(' Pre-punch in-circle hits + Forward rush + Forward blink Doppler');
console.log('================================================================\n');

const boss = new Boss(w / 2, 130, { phaseSequence: [7, 5, 8, 4, 9], phaseHps: [7, 7, 8, 9, 11], enableBullets: true });
const player = new Player(w / 2, 710, boss);
player.autoFire = true;

function handlePlayerBulletCollisions(player, boss, phaseLog = null) {
  for (const b of player.bullets) {
    if (!b.alive) continue;

    if (!boss.shield.isBroken) {
      // Inside core check
      if (!boss.shield.isShattering && player.isInsideShield) {
        const playerDist = Math.hypot(player.x - boss.x, player.y - boss.y);
        if (playerDist <= boss.shield.radius * 0.75) {
          const dx = b.x - boss.x;
          const dy = b.y - boss.y;
          const dist = Math.hypot(dx, dy);
          if (dist <= boss.radius + 6) {
            b.alive = false;
            boss.takeDamage(1, null, Date.now());
            if (phaseLog) phaseLog.push(`[Inside Core Hit] Boss HP left: ${boss.currentPhaseHp}`);
            continue;
          }
        }
      }

      if (boss.shield.checkBulletCollision(b, null, Date.now())) continue;
    } else {
      if (Math.hypot(b.x - boss.x, b.y - boss.y) <= boss.radius + 6) {
        b.alive = false;
        boss.takeDamage(1, null, Date.now());
        if (phaseLog) phaseLog.push(`[Exposed Core Hit] Boss HP left: ${boss.currentPhaseHp}`);
      }
    }
  }
}

// 1. Run Phase 0
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
  handlePlayerBulletCollisions(player, boss);
}
console.log(`Phase 0 cleared at t=${elapsed.toFixed(3)}s, Player: (${player.x.toFixed(1)}, ${player.y.toFixed(1)}), HP=${player.hp}/3`);

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
  handlePlayerBulletCollisions(player, boss);
}
console.log(`Phase 1 cleared at t=${elapsed.toFixed(3)}s, Player: (${player.x.toFixed(1)}, ${player.y.toFixed(1)}), HP=${player.hp}/3`);

// 3. Run Phase 2 (8 WP, 8 HP) with rechargeDur = 1.45s!
const p2Start = elapsed;
const p2Log = [];
console.log(`\n--- Starting Phase 2 (rechargeDur = ${boss.shield.rechargeDuration}s) ---`);
while (elapsed < p2Start + 6.0 && boss.currentPhaseIndex === 2 && player.hp > 0) {
  elapsed += dt;
  const p2Time = elapsed - p2Start;

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

  // Rush W forward and into circle (targetY = 175)
  const targetY = boss.y + 45; // 175, inside circle
  if (player.y > targetY + 2) input.keys['KeyW'] = true;
  else if (player.y < targetY - 2) input.keys['KeyS'] = true;

  if (player.x > boss.x + 2) input.keys['KeyA'] = true;
  else if (player.x < boss.x - 2) input.keys['KeyD'] = true;

  player.update(dt, input, w, h, boss.bullets);
  boss.update(dt, elapsed, player, { recordHit() {}, getFrequency() { return 4.0; } });
  handlePlayerBulletCollisions(player, boss, p2Log);
}

const p2Duration = elapsed - p2Start;
console.log(`Phase 2 finished in ${p2Duration.toFixed(3)}s! Current Phase: ${boss.currentPhaseIndex}`);
console.log(`Player Pos: (${player.x.toFixed(1)}, ${player.y.toFixed(1)}), isInside: ${player.isInsideShield}`);
console.log(`Boss HP: ${boss.currentPhaseHp}, Shield Broken: ${boss.shield.isBroken}`);

// 4. Run Phase 3 (4 WP, 9 HP) with rechargeDur = 1.45s!
console.log(`\n--- Starting Phase 3 (rechargeDur = ${boss.shield.rechargeDuration}s) ---`);
const p3Start = elapsed;
const p3Log = [];
let p3ForwardBlinked = false;

while (elapsed < p3Start + 6.0 && boss.currentPhaseIndex === 3 && player.hp > 0) {
  elapsed += dt;
  const p3Time = elapsed - p3Start;

  const input = {
    keys: {}, actions: [],
    consumeSkill2() { const i = this.actions.indexOf('skill2'); if (i !== -1) { this.actions.splice(i, 1); return true; } return false; },
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

  // During 0 ~ 0.35s: player is naturally in circle! Auto-fire hits core!
  // At 0.35s: Boss spring punch hits player (-1 HP) and knocks player back at 550px/s for 1.05s!
  // At ~1.40s: Knockback ends, 4 WP are broken, shield shatters.
  // After knockback: Rush forward with W!
  if (p3Time >= 1.40) {
    input.keys['KeyW'] = true;
    if (p3Time >= 1.65 && p3Time <= 1.95) input.keys['KeyD'] = true;

    // Forward blink (W + skill2) to compress Doppler wave!
    if (!p3ForwardBlinked && p3Time >= 1.85 && player.blinkCdTimer <= 0) {
      input.actions.push('skill2');
      p3ForwardBlinked = true;
      p3Log.push(`[Forward Blink Executed] at p3Time=${p3Time.toFixed(3)}s`);
    }
  }

  player.update(dt, input, w, h, boss.bullets);
  boss.update(dt, elapsed, player, { recordHit() {}, getFrequency() { return 4.0; } });
  handlePlayerBulletCollisions(player, boss, p3Log);
}

const p3Duration = elapsed - p3Start;
console.log(`Phase 3 finished in ${p3Duration.toFixed(3)}s! Current Phase: ${boss.currentPhaseIndex}`);
console.log(`Player Pos: (${player.x.toFixed(1)}, ${player.y.toFixed(1)}), HP: ${player.hp}/3`);
console.log(`Phase 3 Hits Log (${p3Log.length}):`);
p3Log.forEach(l => console.log(`   ${l}`));
