import { Boss } from '../src/game/Boss.js';
import { Player } from '../src/game/Player.js';
import { BossBullet } from '../src/game/BossBullet.js';

const dt = 1 / 60;
const w = 800;
const h = 800;

console.log('================================================================');
console.log(' TAS BATCH STRATEGY EXPLORER & PARAMETER OPTIMIZER');
console.log(' High-speed parallel parameter sweeps for pure-movement paths');
console.log('================================================================\n');

// 1. Run Section 1 (Phase 0: 7 WP, 7 HP) to Checkpoint 1
export function runToSec1End() {
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

  return { player, boss, elapsed };
}

// 2. Run Section 2 (Phase 1: 5 WP, 7 HP) with twin reflect to Checkpoint 2
export function runToSec2End(cp1, config = { shieldTime: 1.15 }) {
  const boss = new Boss(w / 2, 130, { phaseSequence: [7, 5, 8, 4, 9], phaseHps: [7, 7, 8, 9, 11], enableBullets: true });
  boss.currentPhaseIndex = 1;
  boss.currentPhaseHp = 7;
  boss.shield.setConfiguration(5, 1.45);
  boss.snipeTimer = 1.95; // Initial warmup for 0.55s twin snipe
  boss.radialTimer = 0;

  const player = new Player(cp1.player.x, cp1.player.y, boss);
  player.hp = cp1.player.hp;
  player.autoFire = true;

  let elapsed = cp1.elapsed;
  const p1Start = elapsed;
  let shieldUsed = false;
  let reflectHits = 0;
  let laserHits = 0;

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
    if (!shieldUsed && p1Time >= config.shieldTime) { input.actions.push('skill3'); shieldUsed = true; }

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
          laserHits++;
        }
      }
    }
  }

  return { player, boss, elapsed, reflectHits, laserHits };
}

// 3. Batch Search Engine for Phase 2 Pure Movement Paths
export function batchSearchPhase2(cp2) {
  console.log('\n>>> Starting Phase 2 Batch Evaluation (Pure Movement Sweep) <<<');

  const candidates = [];
  // Grid sweep over subtle movement parameters
  for (let targetDist = 52; targetDist <= 72; targetDist += 4) { // Target distance to Boss center (inside circle <= 88)
    for (let lateralWeave of [0, 8, -8, 15, -15]) { // Slight lateral offset to test angle resilience
      for (let rushDelay = 0; rushDelay <= 0.25; rushDelay += 0.05) { // Delay before full forward rush
        candidates.push({ targetDist, lateralWeave, rushDelay });
      }
    }
  }

  console.log(`Evaluating batch of ${candidates.length} micro-variation movement trajectories...`);

  let winners = [];
  let minHitsTaken = 999;
  let failReasons = { hitCount: 0, timeOut: 0, missedWeakpoints: 0 };

  for (const cand of candidates) {
    // Clone starting state
    const boss = new Boss(w / 2, 130, { phaseSequence: [7, 5, 8, 4, 9], phaseHps: [7, 7, 8, 9, 11], enableBullets: true });
    boss.currentPhaseIndex = 2;
    boss.currentPhaseHp = 8;
    boss.shield.setConfiguration(8, 1.85);
    boss.snipeTimer = 0;
    boss.radialTimer = 0;
    boss.bullets = [];

    const player = new Player(cp2.player.x, cp2.player.y, boss);
    player.hp = cp2.player.hp;
    player.autoFire = true;

    let hitsTaken = 0;
    player.takeDamage = function() {
      if (this.invincibleTimer > 0) return false;
      hitsTaken++;
      return Player.prototype.takeDamage.call(this, 1);
    };

    let elapsed = cp2.elapsed;
    const startElapsed = elapsed;
    const targetY = boss.y + cand.targetDist;
    const targetX = boss.x + cand.lateralWeave;

    while (elapsed < startElapsed + 5.5 && boss.currentPhaseIndex === 2 && player.hp > 0) {
      elapsed += dt;
      const pTime = elapsed - startElapsed;

      const input = {
        keys: {}, actions: [],
        consumeSkill2() { return false; },
        consumeSkill3() { return false; }, // PURE MOVEMENT: NO SHIELD
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

    const distToBoss = Math.hypot(player.x - boss.x, player.y - boss.y);
    const inCircle = distToBoss <= 88;
    const completed = boss.currentPhaseIndex >= 3;

    if (hitsTaken < minHitsTaken) minHitsTaken = hitsTaken;

    if (completed && hitsTaken === 0 && inCircle) {
      winners.push({
        cand,
        duration: elapsed - startElapsed,
        distToBoss,
        playerX: player.x,
        playerY: player.y,
        playerHp: player.hp
      });
    } else {
      if (hitsTaken > 0) failReasons.hitCount++;
      else if (!completed) failReasons.timeOut++;
      else if (!inCircle) failReasons.missedWeakpoints++;
    }
  }

  return { candidatesCount: candidates.length, winners, minHitsTaken, failReasons };
}

// Execute complete pipeline test
console.log('1. Evaluating Phase 0 (Section 1)...');
const cp1 = runToSec1End();
console.log(`   ✅ Phase 0 Complete: t=${cp1.elapsed.toFixed(3)}s, Pos=(${cp1.player.x.toFixed(1)}, ${cp1.player.y.toFixed(1)}), HP=${cp1.player.hp}/3`);

console.log('2. Evaluating Phase 1 (Section 2: Twin Reflect)...');
const cp2 = runToSec2End(cp1, { shieldTime: 1.15 });
console.log(`   ✅ Phase 1 Complete: t=${cp2.elapsed.toFixed(3)}s, Pos=(${cp2.player.x.toFixed(1)}, ${cp2.player.y.toFixed(1)}), HP=${cp2.player.hp}/3`);

console.log('3. Running Phase 2 Batch Parameter Sweep...');
const batchResult = batchSearchPhase2(cp2);
console.log(`\nBatch Evaluation Result:`);
console.log(`   Total Trajectories Tested: ${batchResult.candidatesCount}`);
console.log(`   Zero-Damage Paths Found: ${batchResult.winners.length}`);
console.log(`   Minimum Hits Taken Across Batch: ${batchResult.minHitsTaken}`);

if (batchResult.winners.length > 0) {
  batchResult.winners.sort((a, b) => a.duration - b.duration);
  console.log('\nTop 3 Optimal Pure-Movement Paths:');
  batchResult.winners.slice(0, 3).forEach((w, i) => {
    console.log(`   #${i + 1} targetDist=${w.cand.targetDist}px, lateral=${w.cand.lateralWeave}px, delay=${w.cand.rushDelay}s`);
    console.log(`      Duration: ${w.duration.toFixed(3)}s | Dist to Boss: ${w.distToBoss.toFixed(1)}px (<= 88) | HP: ${w.playerHp}/3`);
  });
}
