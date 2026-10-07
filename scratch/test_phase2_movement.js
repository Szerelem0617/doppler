import { Boss } from '../src/game/Boss.js';
import { Player } from '../src/game/Player.js';
import { Bullet } from '../src/game/Bullet.js';

const dt = 1 / 60;

function simulatePhase2(options = {}) {
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
    } else {
      if (options.sec2Drift && elapsed >= 5.6) {
        input.keys["KeyA"] = true;
      }
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

  // Phase 2 start
  const p2Start = elapsed;
  let hitsTaken = [];
  player.takeDamage = function(amount) {
    hitsTaken.push({ t: elapsed, pTime: elapsed - p2Start, x: this.x, y: this.y, hpBefore: this.hp });
    return Player.prototype.takeDamage.call(this, amount);
  };

  while (elapsed < p2Start + 6.0 && boss.currentPhaseIndex === 2) {
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
        if (x !== 0 && y !== 0) {
          const inv = 0.70710678;
          return { x: x * inv, y: y * inv };
        }
        return { x, y };
      }
    };

    if (options.p2Controller) {
      options.p2Controller(input, pTime, player, boss, elapsed);
    }

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
  return {
    completed: boss.currentPhaseIndex >= 3,
    finalHp: player.hp,
    hitsTaken,
    distToBoss,
    inCircle: distToBoss <= 88,
    elapsed: elapsed - p2Start,
    playerX: player.x,
    playerY: player.y
  };
}

// Test simple forward W
const res1 = simulatePhase2({
  sec2Drift: true,
  p2Controller(input, pTime, player, boss) {
    if (!boss.shield.isBroken && !boss.shield.isShattering) {
      input.keys['KeyW'] = true;
      if (player.x < 390) input.keys['KeyD'] = true;
      else if (player.x > 410) input.keys['KeyA'] = true;
    } else {
      input.keys['KeyW'] = true;
      if (player.x < 390) input.keys['KeyD'] = true;
      else if (player.x > 410) input.keys['KeyA'] = true;
    }
  }
});
console.log('Test 1 (drift in Sec 2, then W+D into center in Sec 3):');
console.log('Completed:', res1.completed, 'HP:', res1.finalHp, 'Hits taken:', res1.hitsTaken);
console.log('Dist to boss:', res1.distToBoss.toFixed(1), 'In circle:', res1.inCircle, 'Duration:', res1.elapsed.toFixed(3));
