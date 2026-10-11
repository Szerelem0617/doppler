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

while (elapsed < 14.0 && boss.currentPhaseIndex <= 2 && player.hp > 0) {
  elapsed += dt;
  const phase = boss.currentPhaseIndex;
  if (phase === 1 && p1StartTime === null) p1StartTime = elapsed;
  if (phase === 2 && p2StartTime === null) {
    p2StartTime = elapsed;
    console.log(`Phase 2 Started at t=${elapsed.toFixed(3)}s, Pos: (${player.x.toFixed(1)}, ${player.y.toFixed(1)}), HP: ${player.hp}/3`);
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
    // In Phase 2: 8 WP, 7 HP.
    // Target position: (400, 175) which is inside the circle!
    const targetY = boss.y + 45; // 175
    const targetX = boss.x; // 400
    if (player.y > targetY + 2) input.keys['KeyW'] = true;
    else if (player.y < targetY - 2) input.keys['KeyS'] = true;

    if (player.x < targetX - 2) input.keys['KeyD'] = true;
    else if (player.x > targetX + 2) input.keys['KeyA'] = true;
  }

  player.update(dt, input, w, h, boss.bullets);
  boss.update(dt, elapsed, player, { recordHit() {}, getFrequency() { return 4.0; } });
  handleBullets();
}

console.log(`Phase 2 Result: currentPhaseIndex=${boss.currentPhaseIndex}, HP=${player.hp}/3, isInside=${player.isInsideShield}, pos=(${player.x.toFixed(1)}, ${player.y.toFixed(1)}), t=${elapsed.toFixed(3)}s`);
