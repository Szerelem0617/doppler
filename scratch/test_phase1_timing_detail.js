import { Boss } from '../src/game/Boss.js';
import { Player } from '../src/game/Player.js';

const boss = new Boss(400, 130, {
  phaseSequence: [7, 5, 8, 4, 9],
  phaseHps: [7, 7, 8, 9, 11],
  enableBullets: true
});
boss.shield.rechargeDuration = 1.45;

const player = new Player(400, 710, boss);
player.autoFire = true;

let elapsed = 0;
const dt = 1/60;
let p0Blinked = false;
let p1StartTime = null;

while (elapsed < 8.0) {
  elapsed += dt;
  const phase = boss.currentPhaseIndex;
  if (phase === 1 && p1StartTime === null) {
    p1StartTime = elapsed;
  }

  const input = {
    keys: {},
    actions: [],
    consumeSkill2() { const i = this.actions.indexOf('skill2'); if (i !== -1) { this.actions.splice(i, 1); return true; } return false; },
    consumeSkill3() { const i = this.actions.indexOf('skill3'); if (i !== -1) { this.actions.splice(i, 1); return true; } return false; },
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
    else input.keys['KeyW'] = true;
  } else if (phase === 1) {
    const p1Time = elapsed - p1StartTime;
    if (!boss.shield.isBroken && !boss.shield.isShattering) {
      input.keys['KeyS'] = true;
      if (p1Time >= 0.15 && p1Time < 0.65) input.keys['KeyA'] = true;
      else if (p1Time >= 0.65 && player.x < 399) input.keys['KeyD'] = true;
    } else if (boss.shield.isShattering) {
      input.keys['KeyS'] = true;
      if (player.x < 399) input.keys['KeyD'] = true;
    } else {
      input.keys['KeyS'] = true;
      if (player.x < 399) input.keys['KeyD'] = true;
    }

    // Check boss bullets distance to player
    for (const b of boss.bullets) {
      const dist = Math.hypot(b.x - player.x, b.y - player.y);
      if (dist <= 60 && !b.isReflected) {
        console.log(`[BULLET NEAR PLAYER] t=${elapsed.toFixed(3)}s, p1Time=${p1Time.toFixed(3)}s, shieldBroken=${boss.shield.isBroken}, shieldShattering=${boss.shield.isShattering}, dist=${dist.toFixed(1)}, bPos=(${b.x.toFixed(1)},${b.y.toFixed(1)}), pPos=(${player.x.toFixed(1)},${player.y.toFixed(1)})`);
      }
    }
  }

  player.update(dt, input, 800, 800, boss.bullets);
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

  if (phase === 1 && boss.shield.justBroken) {
    console.log(`[SHIELD JUST BROKEN] t=${elapsed.toFixed(3)}s, p1Time=${(elapsed-p1StartTime).toFixed(3)}s`);
  }
}
