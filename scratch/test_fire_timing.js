import { Boss } from '../src/game/Boss.js';
import { Player } from '../src/game/Player.js';

const dt = 1 / 60;
const w = 800;
const h = 800;

const boss = new Boss(w / 2, 130, { phaseSequence: [7, 5, 8, 4, 9], phaseHps: [7, 7, 7, 9, 11], enableBullets: true });
const player = new Player(w / 2, 710, boss);
player.autoFire = true;

let elapsed = 0;
let p0Blinked = false;
let p1StartTime = null;
let p2StartTime = null;
let p3StartTime = null;
let p4StartTime = null;

function handleBullets() {
  for (const b of player.bullets) {
    if (!b.alive) continue;
    if (!boss.shield.isBroken) {
      if (!boss.shield.isShattering && player.isInsideShield) {
        const playerDist = Math.hypot(player.x - boss.x, player.y - boss.y);
        if (playerDist <= boss.shield.radius * 0.75) {
          const dist = Math.hypot(b.x - boss.x, b.y - boss.y);
          if (dist <= boss.radius + 6) {
            b.alive = false;
            boss.takeDamage(1, null, Date.now());
            console.log(`[CORE HIT] t=${elapsed.toFixed(3)}s, Phase=${boss.currentPhaseIndex}, BossHP=${boss.hp}`);
            continue;
          }
        }
      }
      if (boss.shield.checkBulletCollision(b, null, Date.now())) continue;
    } else {
      if (Math.hypot(b.x - boss.x, b.y - boss.y) <= boss.radius + 6) {
        b.alive = false;
        boss.takeDamage(1, null, Date.now());
        console.log(`[CORE HIT (broken)] t=${elapsed.toFixed(3)}s, Phase=${boss.currentPhaseIndex}, BossHP=${boss.hp}`);
      }
    }
  }
}

while (elapsed < 20.0 && !boss.isDead && player.hp > 0) {
  elapsed += dt;
  const phase = boss.currentPhaseIndex;
  if (phase === 1 && p1StartTime === null) p1StartTime = elapsed;
  if (phase === 2 && p2StartTime === null) p2StartTime = elapsed;
  if (phase === 3 && p3StartTime === null) p3StartTime = elapsed;
  if (phase === 4 && p4StartTime === null) {
    p4StartTime = elapsed;
    console.log(`\nPhase 4 start at t=${elapsed.toFixed(3)}s, player fireTimer=${player.fireTimer.toFixed(3)}`);
  }

  const input = {
    keys: {},
    actions: [],
    consumeSkill2() { const i = this.actions.indexOf('skill2'); if (i !== -1) { this.actions.splice(i, 1); return true; } return false; },
    consumeSkill3() { return false; },
    getMovementVector() {
      let x = 0, y = 0;
      if (this.keys['KeyW']) y -= 1;
      if (this.keys['KeyS']) y += 1;
      if (this.keys['KeyA']) x -= 1;
      if (this.keys['KeyD']) x += 1;
      if (x !== 0 && y !== 0) { const inv = 0.70710678; return { x: x * inv, y: y * inv }; }
      return { x, y };
    }
  };

  if (phase === 0) {
    if (!boss.shield.isBroken && !boss.shield.isShattering) input.keys['KeyW'] = true;
    else if (!p0Blinked) { input.keys['KeyS'] = true; input.actions.push('skill2'); p0Blinked = true; }
    else {
      input.keys['KeyW'] = true;
      if (elapsed >= 2.4 && elapsed <= 2.85) input.keys['KeyD'] = true;
      else if (elapsed > 2.85 && player.x > 401) input.keys['KeyA'] = true;
    }
  } else if (phase === 1) {
    const p1Time = elapsed - p1StartTime;
    if (!boss.shield.isBroken && !boss.shield.isShattering) {
      input.keys['KeyS'] = true;
      if (p1Time >= 1.05 && p1Time <= 1.40) input.keys['KeyD'] = true;
    } else {
      input.keys['KeyW'] = true;
      if (p1Time < 1.85) {
        if (player.x < 433) input.keys['KeyD'] = true;
        else if (player.x > 437) input.keys['KeyA'] = true;
      } else {
        if (player.x > 402) input.keys['KeyA'] = true;
        else if (player.x < 398) input.keys['KeyD'] = true;
      }
    }
  } else if (phase === 2) {
    const targetY = boss.y + 45;
    const targetX = boss.x;
    if (player.y > targetY + 2) input.keys['KeyW'] = true;
    else if (player.y < targetY - 2) input.keys['KeyS'] = true;
    if (player.x < targetX - 2) input.keys['KeyD'] = true;
    else if (player.x > targetX + 2) input.keys['KeyA'] = true;
  } else if (phase === 3) {
    const p3Time = elapsed - p3StartTime;
    if (p3Time >= 0.40) {
      const targetY = boss.y + 45;
      const targetX = boss.x;
      if (player.y > targetY + 2) input.keys['KeyW'] = true;
      else if (player.y < targetY - 2) input.keys['KeyS'] = true;
      if (player.x < targetX - 2) input.keys['KeyD'] = true;
      else if (player.x > targetX + 2) input.keys['KeyA'] = true;
    }
  } else if (phase === 4) {
    input.keys['KeyW'] = true;
  }

  const prevBulletsCount = player.bullets.length;
  player.update(dt, input, w, h, boss.bullets);
  if (phase === 4 && player.bullets.length > prevBulletsCount) {
    console.log(`[BULLET FIRED] t=${elapsed.toFixed(3)}s (p4Time=${(elapsed-p4StartTime).toFixed(3)}s)`);
  }
  boss.update(dt, elapsed, player, { recordHit() {}, getFrequency() { return 4.0; } });
  handleBullets();

  if (phase === 4 && elapsed - p4StartTime > 0.4) break;
}
