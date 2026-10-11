import { Boss } from '../src/game/Boss.js';
import { Player } from '../src/game/Player.js';

const dt = 1 / 60;
const w = 800;
const h = 800;

console.log('Testing Phase 3 and Phase 4 complete sequence...');

const boss = new Boss(w / 2, 130, { phaseSequence: [7, 5, 8, 4, 9], phaseHps: [7, 7, 7, 9, 11], enableBullets: true });
const player = new Player(w / 2, 710, boss);
player.autoFire = true;

let elapsed = 0;
let p0Blinked = false;
let p1StartTime = null;
let p2StartTime = null;
let p3StartTime = null;
let p4StartTime = null;
let p4Blinked = false;

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
            continue;
          }
        }
      }
      if (boss.shield.checkBulletCollision(b, null, Date.now())) continue;
    } else {
      if (Math.hypot(b.x - boss.x, b.y - boss.y) <= boss.radius + 6) {
        b.alive = false;
        boss.takeDamage(1, null, Date.now());
      }
    }
  }
}

while (elapsed < 25.0 && !boss.isDead && player.hp > 0) {
  elapsed += dt;
  const phase = boss.currentPhaseIndex;
  if (phase === 1 && p1StartTime === null) p1StartTime = elapsed;
  if (phase === 2 && p2StartTime === null) p2StartTime = elapsed;
  if (phase === 3 && p3StartTime === null) {
    p3StartTime = elapsed;
    console.log(`>>> Phase 3 Started at t=${elapsed.toFixed(3)}s, Pos: (${player.x.toFixed(1)}, ${player.y.toFixed(1)}), isInside: ${player.isInsideShield}, HP: ${player.hp}/3, boss.hp: ${boss.hp}`);
  }
  if (phase === 4 && p4StartTime === null) {
    p4StartTime = elapsed;
    console.log(`>>> Phase 4 Started at t=${elapsed.toFixed(3)}s, Pos: (${player.x.toFixed(1)}, ${player.y.toFixed(1)}), isInside: ${player.isInsideShield}, HP: ${player.hp}/3, boss.hp: ${boss.hp}`);
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

  // Phase 0: 7 WP, 7 HP
  if (phase === 0) {
    if (!boss.shield.isBroken && !boss.shield.isShattering) {
      input.keys['KeyW'] = true;
    } else if (!p0Blinked) {
      input.keys['KeyS'] = true;
      input.actions.push('skill2');
      p0Blinked = true;
    } else {
      input.keys['KeyW'] = true;
      if (elapsed >= 2.4 && elapsed <= 2.85) input.keys['KeyD'] = true;
      else if (elapsed > 2.85 && player.x > 401) input.keys['KeyA'] = true;
    }
  }
  // Phase 1: 5 WP, 7 HP
  else if (phase === 1) {
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
  }
  // Phase 2: 8 WP, 7 HP
  else if (phase === 2) {
    const targetY = boss.y + 45; // 175
    const targetX = boss.x;
    if (player.y > targetY + 2) input.keys['KeyW'] = true;
    else if (player.y < targetY - 2) input.keys['KeyS'] = true;
    if (player.x < targetX - 2) input.keys['KeyD'] = true;
    else if (player.x > targetX + 2) input.keys['KeyA'] = true;
  }
  // Phase 3: 4 WP, 9 HP
  // Starts inside circle! After knockback, rush forward to break 4 WP and walk in to targetY = 175!
  else if (phase === 3) {
    const p3Time = elapsed - p3StartTime;
    if (p3Time >= 0.40) {
      // Rush W to break 4 WP and move towards inside target (400, 175)
      const targetY = boss.y + 45;
      const targetX = boss.x;
      if (player.y > targetY + 2) input.keys['KeyW'] = true;
      else if (player.y < targetY - 2) input.keys['KeyS'] = true;
      if (player.x < targetX - 2) input.keys['KeyD'] = true;
      else if (player.x > targetX + 2) input.keys['KeyA'] = true;
    }
  }
  // Phase 4: 9 WP, 11 HP
  // Starts inside circle!
  else if (phase === 4) {
    const p4Time = elapsed - p4StartTime;
    // Before punch, shoot inside.
    // After punch knockback (0.35s), rush W forward to break 9 WP!
    if (p4Time >= 0.40) {
      // If shield is not broken, push forward with W to break 9 WP
      if (!boss.shield.isBroken && !boss.shield.isShattering) {
        input.keys['KeyW'] = true;
      } else {
        // Shield broken! Pour damage into core!
        input.keys['KeyW'] = true;
        // If Boss is still alive and blink is ready, blink inside core to finish it off!
        if (boss.hp > 0 && player.blinkCdTimer <= 0 && !p4Blinked && p4Time > 2.0) {
          // dirX=0, dirY=0: clear keys and trigger skill2
          input.keys['KeyW'] = false;
          input.actions.push('skill2');
          p4Blinked = true;
        }
      }
    }
  }

  player.update(dt, input, w, h, boss.bullets);
  boss.update(dt, elapsed, player, { recordHit() {}, getFrequency() { return 4.0; } });
  handleBullets();
}

console.log(`\nEnd State: elapsed=${elapsed.toFixed(3)}s, boss.isDead=${boss.isDead}, boss.hp=${boss.hp}, player.hp=${player.hp}/3, player.pos=(${player.x.toFixed(1)}, ${player.y.toFixed(1)})`);
