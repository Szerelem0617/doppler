import { Boss } from '../src/game/Boss.js';
import { Player } from '../src/game/Player.js';
import { BossBullet } from '../src/game/BossBullet.js';

const dt = 1 / 60;

function getCheckpoint2() {
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

  return {
    elapsed,
    playerX: player.x,
    playerY: player.y,
    playerHp: player.hp,
    bossBullets: boss.bullets.map(b => ({ x: b.x, y: b.y, vx: b.vx, vy: b.vy, radius: b.radius, alive: b.alive }))
  };
}

const cp2 = getCheckpoint2();

export function findPhase2ZeroDamagePath() {
  const bossConfigs = [
    { name: 'Boss(snipe=3.0, radial=4.2)', snipeInterval: 3.0, radialInterval: 4.2 },
    { name: 'Boss(snipe=3.2, radial=4.5)', snipeInterval: 3.2, radialInterval: 4.5 },
    { name: 'Boss(snipe=3.5, radial=5.0)', snipeInterval: 3.5, radialInterval: 5.0 },
    { name: 'Boss(snipe=4.0, radial=5.0)', snipeInterval: 4.0, radialInterval: 5.0 }
  ];

  let winners = [];

  for (const bConf of bossConfigs) {
    for (let driftTime = 0.35; driftTime <= 0.85; driftTime += 0.08) {
      for (let driftKey of ['KeyA', 'KeyD']) {
        for (let targetDist = 50; targetDist <= 80; targetDist += 6) { // Distance to boss (inside circle <= 88)
          for (let lateralWeave of [0, 20, 30, -20, -30]) {
            const boss = new Boss(400, 130, { phaseSequence: [7, 5, 8, 4, 9], phaseHps: [7, 7, 8, 9, 11] });
            boss.currentPhaseIndex = 2;
            boss.currentPhaseHp = 8;
            boss.shield.setConfiguration(8, 1.45);
            boss.shield.isBroken = false;
            boss.radialTimer = 0;
            boss.snipeTimer = 0;
            boss.snipeInterval = bConf.snipeInterval;
            boss.radialInterval = bConf.radialInterval;
            boss.bullets = cp2.bossBullets.map(b => new BossBullet(b.x, b.y, b.vx, b.vy));

            const player = new Player(cp2.playerX, cp2.playerY, boss);
            player.autoFire = true;
            player.hp = cp2.playerHp;

            let hitsTaken = 0;
            player.takeDamage = function() { hitsTaken++; return Player.prototype.takeDamage.call(this, 1); };

            let elapsed = cp2.elapsed;
            const startElapsed = elapsed;

            const targetY = boss.y + targetDist;
            const targetX = boss.x + lateralWeave;

            while (elapsed < startElapsed + 5.5 && boss.currentPhaseIndex === 2 && player.hp > 0) {
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
                  if (x !== 0 && y !== 0) { const inv = 0.7071; return { x: x * inv, y: y * inv }; }
                  return { x, y };
                }
              };

              if (!boss.shield.isBroken && !boss.shield.isShattering) {
                input.keys['KeyW'] = true;
                if (pTime < driftTime) {
                  input.keys[driftKey] = true;
                } else {
                  if (driftKey === 'KeyA' && player.x < 396) input.keys['KeyD'] = true;
                  else if (driftKey === 'KeyD' && player.x > 404) input.keys['KeyA'] = true;
                }
              } else {
                // In break & circle rush: stay inside target zone [targetX, targetY]
                const dx = targetX - player.x;
                const dy = targetY - player.y;
                if (Math.abs(dx) > 6) {
                  if (dx > 0) input.keys['KeyD'] = true;
                  else input.keys['KeyA'] = true;
                }
                if (Math.abs(dy) > 6) {
                  if (dy > 0) input.keys['KeyS'] = true;
                  else input.keys['KeyW'] = true;
                }
              }

              player.update(dt, input, 800, 800, boss.bullets);
              boss.update(dt, elapsed, player, { recordHit() {}, getFrequency() { return 4.0; } });

              for (const b of player.bullets) {
                if (!b.alive) continue;
                if (!boss.shield.isBroken) {
                  if (boss.shield.checkBulletCollision(b, null, Date.now())) continue;
                }
                if (Math.hypot(b.x - boss.x, b.y - boss.y) <= boss.radius + 6) {
                  b.alive = false;
                  boss.takeDamage(1, null, Date.now());
                }
              }
            }

            const distToBoss = Math.hypot(player.x - boss.x, player.y - boss.y);
            const inCircle = distToBoss <= 88;
            const completed = boss.currentPhaseIndex >= 3;

            if (completed && hitsTaken === 0 && inCircle) {
              winners.push({
                bConf,
                driftTime,
                driftKey,
                targetDist,
                lateralWeave,
                duration: elapsed - startElapsed,
                distToBoss,
                playerX: player.x,
                playerY: player.y
              });
            }
          }
        }
      }
    }
  }

  return winners;
}

console.log('Running dense search across movement paths and frequencies...');
const winners = findPhase2ZeroDamagePath();
console.log(`Found ${winners.length} zero-damage paths!`);

if (winners.length > 0) {
  winners.sort((a, b) => a.duration - b.duration);
  console.log('\nTop 3 Zero-Damage Paths:');
  winners.slice(0, 3).forEach((w, i) => {
    console.log(`  #${i+1} [${w.bConf.name}] drift=${w.driftKey} for ${w.driftTime.toFixed(2)}s, targetDist=${w.targetDist}px, lateral=${w.lateralWeave}px`);
    console.log(`     Duration: ${w.duration.toFixed(3)}s | Dist: ${w.distToBoss.toFixed(1)}px (<= 88) | Pos: (${w.playerX.toFixed(1)}, ${w.playerY.toFixed(1)})`);
  });
}
