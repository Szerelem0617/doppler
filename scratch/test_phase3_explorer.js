import { Boss } from '../src/game/Boss.js';
import { Player } from '../src/game/Player.js';
import { BossBullet } from '../src/game/BossBullet.js';

const dt = 1 / 60;
const w = 800;
const h = 800;

console.log('================================================================');
console.log(' ATTEMPT 2: Phase 3 (4 WP, 9 HP) Batch Trajectory Explorer');
console.log('================================================================\n');

// Function to run through Phase 0 -> 1 -> 2
function runToPhase3Start() {
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

  return { player, boss, elapsed };
}

const cp2 = runToPhase3Start();
console.log(`Checkpoint reached: Phase=${cp2.boss.currentPhaseIndex}, t=${cp2.elapsed.toFixed(3)}s, Player=(${cp2.player.x.toFixed(1)}, ${cp2.player.y.toFixed(1)}), HP=${cp2.player.hp}`);

// Batch exploration of Phase 3 strategies
// Test parameters:
// - weaveStart: time in Phase 3 to start lateral dodge (e.g. 1.5s - 1.9s)
// - weaveDuration: duration of lateral dodge (e.g. 0.3s - 0.6s)
// - weaveDir: 'KeyD' or 'KeyA'
// - rushYTarget: target Y distance for post-break core bursting (e.g. 50 - 90px)
const candidates = [];
for (let weaveStart of [1.4, 1.5, 1.6, 1.7, 1.8]) {
  for (let weaveDuration of [0.3, 0.45, 0.6]) {
    for (let weaveDir of ['KeyD', 'KeyA']) {
      for (let rushYTarget of [50, 70, 90, 120]) {
        candidates.push({ weaveStart, weaveDuration, weaveDir, rushYTarget });
      }
    }
  }
}

console.log(`Testing ${candidates.length} candidate strategies for Phase 3...`);

let successful = [];

for (const cand of candidates) {
  // Deep clone state
  const boss = new Boss(w / 2, 130, { phaseSequence: [7, 5, 8, 4, 9], phaseHps: [7, 7, 8, 9, 11], enableBullets: true });
  boss.currentPhaseIndex = 3;
  boss.currentPhaseHp = 9;
  boss.shield.setConfiguration(4, 1.45);
  boss.radialTimer = cp2.boss.radialTimer;
  boss.snipeTimer = cp2.boss.snipeTimer;
  boss.bullets = [];

  const player = new Player(cp2.player.x, cp2.player.y, boss);
  player.hp = cp2.player.hp;
  player.autoFire = true;
  player.skill2CdTimer = cp2.player.skill2CdTimer;
  player.skill3CdTimer = cp2.player.skill3CdTimer;

  let hitsTakenExcludingPunch = 0;
  let punchCount = 0;
  player.takeDamage = function(dmg) {
    if (this.invincibleTimer > 0) return false;
    if (boss.springPunchActive || this.isKnockedBack) {
      punchCount++;
    } else {
      hitsTakenExcludingPunch++;
    }
    return Player.prototype.takeDamage.call(this, dmg);
  };

  let elapsed = cp2.elapsed;
  const p3Start = elapsed;

  while (elapsed < p3Start + 6.0 && boss.currentPhaseIndex === 3 && player.hp > 0) {
    elapsed += dt;
    const p3Time = elapsed - p3Start;

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

    if (!boss.shield.isBroken && !boss.shield.isShattering) {
      // Shield active: during knockback, Doppler breaks 4 weakpoints
      // Nothing needed, player auto-slides back at 550px/s
    } else {
      // Shield broken: rush boss to burst 9 HP
      const targetY = boss.y + cand.rushYTarget;
      if (player.y > targetY + 2) input.keys['KeyW'] = true;
      else if (player.y < targetY - 2) input.keys['KeyS'] = true;

      // Weave to dodge snipe
      if (p3Time >= cand.weaveStart && p3Time <= cand.weaveStart + cand.weaveDuration) {
        input.keys[cand.weaveDir] = true;
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

  const p3Duration = elapsed - p3Start;
  const isPhaseCleared = boss.currentPhaseIndex >= 4;

  if (isPhaseCleared && hitsTakenExcludingPunch === 0) {
    successful.push({
      cand,
      duration: p3Duration,
      finalHp: player.hp,
      punchCount,
      playerX: player.x,
      playerY: player.y,
      elapsed
    });
  }
}

console.log(`Phase 3 Batch Sweep Results:`);
console.log(`  Successful (cleared with only intentional spring punch): ${successful.length} / ${candidates.length}`);

if (successful.length > 0) {
  successful.sort((a, b) => a.duration - b.duration);
  console.log('\nTop 5 fastest paths for Phase 3:');
  successful.slice(0, 5).forEach((s, idx) => {
    console.log(`  #${idx + 1}: Duration ${s.duration.toFixed(3)}s | End Pos: (${s.playerX.toFixed(1)}, ${s.playerY.toFixed(1)}) | HP: ${s.finalHp}/3`);
    console.log(`      weaveStart=${s.cand.weaveStart}s, weaveDuration=${s.cand.weaveDuration}s, dir=${s.cand.weaveDir}, rushYTarget=${s.cand.rushYTarget}px`);
  });
}
