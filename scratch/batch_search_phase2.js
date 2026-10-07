import { Boss } from '../src/game/Boss.js';
import { Player } from '../src/game/Player.js';
import { Bullet } from '../src/game/Bullet.js';

const dt = 1 / 60;

// Fast simulation to checkpoint 2
function runToSec2End() {
  const boss = new Boss(400, 130, { phaseSequence: [7, 5, 8, 4, 9], phaseHps: [7, 7, 8, 9, 11] });
  const player = new Player(400, 710, boss);
  
  // Sec 1
  let elapsed = 0;
  let hasBlinkedBack = false;
  while (elapsed < 5.0 && boss.currentPhaseIndex === 0) {
    elapsed += dt;
    const input = {
      keys: {}, actions: [],
      consumeSkill2() { const i = this.actions.indexOf("skill2"); if (i !== -1) { this.actions.splice(i, 1); return true; } return false; },
      consumeSkill3() { return false; },
      getMovementVector() { let x=0, y=0; if (this.keys["KeyW"]) y-=1; if (this.keys["KeyS"]) y+=1; if (this.keys["KeyA"]) x-=1; if (this.keys["KeyD"]) x+=1; return {x, y}; }
    };
    if (!boss.shield.isBroken && !boss.shield.isShattering) input.keys["KeyW"] = true;
    else if ((boss.shield.isShattering || boss.shield.isBroken) && !hasBlinkedBack) { input.keys["KeyS"] = true; input.actions.push("skill2"); hasBlinkedBack = true; }
    else { input.keys["KeyW"] = true; if (elapsed >= 2.4 && elapsed <= 2.85) input.keys["KeyD"] = true; else if (elapsed > 2.85 && player.x > 401) input.keys["KeyA"] = true; }
    player.update(dt, input, 800, 800, boss.bullets);
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

  // Sec 2
  const sec2Start = elapsed;
  let hasUsedShield = false;
  while (elapsed < sec2Start + 6.0 && boss.currentPhaseIndex === 1) {
    elapsed += dt;
    const pTime = elapsed - sec2Start;
    const input = {
      keys: {}, actions: [],
      consumeSkill2() { return false; },
      consumeSkill3() { const i = this.actions.indexOf("skill3"); if (i !== -1) { this.actions.splice(i, 1); return true; } return false; },
      getMovementVector() { let x=0, y=0; if (this.keys["KeyW"]) y-=1; if (this.keys["KeyS"]) y+=1; if (this.keys["KeyA"]) x-=1; if (this.keys["KeyD"]) x+=1; return {x, y}; }
    };
    if (!boss.shield.isBroken && !boss.shield.isShattering) {
      input.keys["KeyS"] = true;
      if (!hasUsedShield && pTime >= 0.95) { input.actions.push("skill3"); hasUsedShield = true; }
    }
    player.update(dt, input, 800, 800, boss.bullets);
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

// Clone snapshot
function cloneState(snapshot) {
  const boss = new Boss(400, 130, {
    phaseSequence: [...snapshot.boss.phaseWeakpoints],
    phaseHps: [...snapshot.boss.phaseHps],
    enableBullets: true
  });
  boss.x = snapshot.boss.x;
  boss.y = snapshot.boss.y;
  boss.hp = snapshot.boss.hp;
  boss.maxHp = snapshot.boss.maxHp;
  boss.currentPhaseIndex = snapshot.boss.currentPhaseIndex;
  boss.currentPhaseHp = snapshot.boss.currentPhaseHp;
  boss.radialTimer = snapshot.boss.radialTimer;
  boss.snipeTimer = snapshot.boss.snipeTimer;
  boss.burstCount = snapshot.boss.burstCount;
  boss.shield.setConfiguration(snapshot.boss.shield.count, 1.45);
  boss.shield.currentAngle = snapshot.boss.shield.currentAngle;
  boss.shield.isBroken = snapshot.boss.shield.isBroken;
  boss.shield.weakpoints = snapshot.boss.shield.weakpoints.map(wp => ({ ...wp }));
  boss.bullets = snapshot.boss.bullets.map(b => {
    const bb = Object.assign(Object.create(Object.getPrototypeOf(b)), b);
    return bb;
  });

  const player = new Player(snapshot.player.x, snapshot.player.y, boss);
  player.vx = snapshot.player.vx;
  player.vy = snapshot.player.vy;
  player.hp = snapshot.player.hp;
  player.fireTimer = snapshot.player.fireTimer;
  player.autoFire = true;
  player.shieldCdTimer = snapshot.player.shieldCdTimer;
  player.blinkCdTimer = snapshot.player.blinkCdTimer;
  player.bullets = snapshot.player.bullets.map(b => {
    const pb = Object.assign(Object.create(Object.getPrototypeOf(b)), b);
    pb.target = boss;
    return pb;
  });

  return { player, boss, elapsed: snapshot.elapsed };
}

console.log('Generating base checkpoint at Phase 2 start...');
const baseSnapshot = runToSec2End();
console.log(`Base checkpoint: t=${baseSnapshot.elapsed.toFixed(3)}s, Player HP=${baseSnapshot.player.hp}, pos=(${baseSnapshot.player.x.toFixed(1)}, ${baseSnapshot.player.y.toFixed(1)}), Boss bullets=${baseSnapshot.boss.bullets.length}`);

// Batch search evaluator
export function evaluatePhase2Strategy(strategy, customBossConfig = null) {
  const { player, boss, elapsed: startElapsed } = cloneState(baseSnapshot);
  if (customBossConfig) {
    if (customBossConfig.snipeInterval) boss.snipeInterval = customBossConfig.snipeInterval;
    if (customBossConfig.radialInterval) boss.radialInterval = customBossConfig.radialInterval;
    if (customBossConfig.resetTimers) { boss.snipeTimer = 0; boss.radialTimer = 0; }
  }

  let elapsed = startElapsed;
  let hits = 0;
  player.takeDamage = function() {
    hits++;
    return Player.prototype.takeDamage.call(this, 1);
  };

  const inputsRecord = [];

  while (elapsed < startElapsed + 6.0 && boss.currentPhaseIndex === 2) {
    elapsed += dt;
    const pTime = elapsed - startElapsed;

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
        if (x !== 0 && y !== 0) {
          const inv = 0.70710678;
          return { x: x * inv, y: y * inv };
        }
        return { x, y };
      }
    };

    strategy(input, pTime, player, boss, elapsed);

    inputsRecord.push({
      time: elapsed,
      keys: { ...input.keys },
      actions: [...input.actions]
    });

    player.update(dt, input, 800, 800, boss.bullets);
    boss.update(dt, elapsed, player, { recordHit() {}, getFrequency() { return 4.0; } });

    for (const b of player.bullets) {
      if (!b.alive) continue;
      if (!boss.shield.isBroken) {
        if (boss.shield.checkBulletCollision(b, null, Date.now())) continue;
        if (!boss.shield.isShattering && Math.hypot(b.x - boss.x, b.y - boss.y) <= boss.radius + 6) {
          b.alive = false;
          boss.takeDamage(1, null, Date.now());
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
  const inCircle = distToBoss <= 88;
  const completed = boss.currentPhaseIndex >= 3;
  const success = completed && player.hp === 3 && inCircle;

  return {
    success,
    completed,
    hits,
    playerHp: player.hp,
    distToBoss,
    inCircle,
    duration: elapsed - startElapsed,
    playerX: player.x,
    playerY: player.y,
    inputsRecord
  };
}

// Run grid search across parameters!
console.log('\n--- Running Batch Search for Phase 2 Pure Movement ---');

let bestResult = null;
let winningConfigs = [];

// Parameter grid
const initialDrifts = [
  { name: 'left-dodge', keys: ['KeyW', 'KeyA'] },
  { name: 'right-dodge', keys: ['KeyW', 'KeyD'] },
  { name: 'pure-left', keys: ['KeyA'] },
  { name: 'pure-right', keys: ['KeyD'] }
];

const driftDurations = [0.3, 0.45, 0.6, 0.75, 0.9];
const approachOffsets = [45, 55, 65, 75]; // Y offset from boss

let testedCount = 0;

for (const bossConfig of [
  null, // Default
  { snipeInterval: 2.4, radialInterval: 3.2, resetTimers: true },
  { snipeInterval: 2.6, radialInterval: 3.5, resetTimers: true },
  { snipeInterval: 3.0, radialInterval: 3.5, resetTimers: true }
]) {
  const configLabel = bossConfig ? `Boss(snipe=${bossConfig.snipeInterval}, radial=${bossConfig.radialInterval})` : 'Default Boss';
  
  for (const drift of initialDrifts) {
    for (const dDur of driftDurations) {
      for (const targetYOff of approachOffsets) {
        testedCount++;
        const strategy = (input, pTime, player, boss) => {
          if (!boss.shield.isBroken && !boss.shield.isShattering) {
            if (pTime < dDur) {
              drift.keys.forEach(k => input.keys[k] = true);
            } else {
              // Steer forward towards boss
              input.keys['KeyW'] = true;
              if (player.x < 390) input.keys['KeyD'] = true;
              else if (player.x > 410) input.keys['KeyA'] = true;
            }
          } else {
            // Rush into target position inside circle
            const targetY = boss.y + targetYOff;
            if (player.y > targetY + 5) input.keys['KeyW'] = true;
            else if (player.y < targetY - 5) input.keys['KeyS'] = true;
            if (player.x < 395) input.keys['KeyD'] = true;
            else if (player.x > 405) input.keys['KeyA'] = true;
          }
        };

        const res = evaluatePhase2Strategy(strategy, bossConfig);
        if (res.success) {
          winningConfigs.push({
            bossConfig: configLabel,
            drift: drift.name,
            dDur,
            targetYOff,
            res
          });
        }
      }
    }
  }
}

console.log(`Tested ${testedCount} movement variations across configurations.`);
console.log(`Found ${winningConfigs.length} successful paths with 0 damage & inside circle!`);

if (winningConfigs.length > 0) {
  winningConfigs.forEach((w, idx) => {
    console.log(`\nWinner #${idx + 1}: [${w.bossConfig}] ${w.drift} (${w.dDur}s) -> targetYOff=${w.targetYOff}`);
    console.log(`   Duration: ${w.res.duration.toFixed(3)}s | HP: ${w.res.playerHp}/3 | Dist: ${w.res.distToBoss.toFixed(1)}px | Pos: (${w.res.playerX.toFixed(1)}, ${w.res.playerY.toFixed(1)})`);
  });
}
