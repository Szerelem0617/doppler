import { Boss } from '../src/game/Boss.js';
import { Player } from '../src/game/Player.js';
import { BossBullet } from '../src/game/BossBullet.js';

const dt = 1 / 60;

// Run Sec 1 & 2
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
    if (pTime >= 2.0 && player.x > 320) {
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

console.log("Checkpoint 2: t=", elapsed.toFixed(3), "Phase:", boss.currentPhaseIndex, "Player:", player.x, player.y);
console.log("Bullets alive:", boss.bullets.length);

// Phase 2
boss.snipeInterval = 3.5;
boss.radialInterval = 5.0;
boss.snipeTimer = 0;
boss.radialTimer = 0;

player.takeDamage = function(dmg) {
  console.log(`[HIT] t=${elapsed.toFixed(3)}, player pos=(${this.x.toFixed(1)}, ${this.y.toFixed(1)})`);
  // Find which bullet hit player
  for (const b of boss.bullets) {
    const d = Math.hypot(b.x - this.x, b.y - this.y);
    if (d <= this.radius + b.radius) {
      console.log(`   Hit by bullet at (${b.x.toFixed(1)}, ${b.y.toFixed(1)}) vel=(${b.vx.toFixed(1)}, ${b.vy.toFixed(1)})`);
    }
  }
  return Player.prototype.takeDamage.call(this, dmg);
};

const p2Start = elapsed;
while (elapsed < p2Start + 5.5 && boss.currentPhaseIndex === 2 && player.hp > 0) {
  elapsed += dt;
  const pTime = elapsed - p2Start;

  const input = {
    keys: { KeyW: true }, actions: [],
    consumeSkill2() { return false; },
    consumeSkill3() { return false; },
    getMovementVector() {
      let x = 0, y = -1;
      if (pTime < 0.6) x = -0.5;
      else if (player.x < 395) x = 0.5;
      return { x, y };
    }
  };

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

console.log(`Phase 2 end: bossPhase=${boss.currentPhaseIndex}, playerHp=${player.hp}, elapsed=${(elapsed-p2Start).toFixed(3)}`);
