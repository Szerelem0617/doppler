import { Boss } from '../src/game/Boss.js';
import { Player } from '../src/game/Player.js';

const dt = 1 / 60;
const w = 800;
const h = 800;

for (const targetX of [425, 435, 445]) {
  const boss = new Boss(w / 2, 130, { phaseSequence: [7, 5, 8, 4, 9], phaseHps: [7, 7, 7, 9, 11], enableBullets: true });
  const player = new Player(w / 2, 710, boss);
  player.autoFire = true;

  let elapsed = 0;
  let p0Blinked = false;
  let p1StartTime = null;

  function handleBullets() {
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

  while (elapsed < 8.0 && boss.currentPhaseIndex <= 1 && player.hp > 0) {
    elapsed += dt;
    const phase = boss.currentPhaseIndex;
    if (phase === 1 && p1StartTime === null) p1StartTime = elapsed;

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
        if (p1Time >= 1.05 && p1Time <= 1.40) {
          input.keys['KeyD'] = true;
        }
      } else {
        // Shattered or broken: rush W!
        input.keys['KeyW'] = true;
        // Keep at targetX until bullet is past (p1Time > 1.8), then re-center
        if (p1Time < 1.85) {
          if (player.x < targetX - 2) input.keys['KeyD'] = true;
          else if (player.x > targetX + 2) input.keys['KeyA'] = true;
        } else {
          // Re-center after bullet is safe
          if (player.x > 402) input.keys['KeyA'] = true;
          else if (player.x < 398) input.keys['KeyD'] = true;
        }
      }
    }

    player.update(dt, input, w, h, boss.bullets);
    boss.update(dt, elapsed, player, { recordHit() {}, getFrequency() { return 4.0; } });
    handleBullets();
  }

  console.log(`targetX=${targetX}: currentPhase=${boss.currentPhaseIndex}, HP=${player.hp}/3, Elapsed=${elapsed.toFixed(3)}s, PlayerPos=(${player.x.toFixed(1)}, ${player.y.toFixed(1)})`);
}
