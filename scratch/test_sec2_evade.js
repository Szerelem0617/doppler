import { Boss } from '../src/game/Boss.js';
import { Player } from '../src/game/Player.js';

for (const dodgeDuration of [0.4, 0.5, 0.6, 0.7, 0.8]) {
  for (const dodgeStart of [0.0, 0.1, 0.15, 0.2, 0.25]) {
    const boss = new Boss(400, 130, { phaseSequence: [7, 5, 8, 4, 9], phaseHps: [7, 7, 8, 9, 11], enableBullets: true });
    boss.currentPhaseIndex = 1;
    boss.currentPhaseHp = 7;
    boss.shield.setConfiguration(5, 2.8);
    boss.snipeTimer = 1.583; // as carried over from sec 1
    boss.radialTimer = 0.783;

    const player = new Player(400, 273, boss);
    player.autoFire = true;
    player.hp = 3;

    let elapsed = 3.383;
    const startElapsed = elapsed;
    const dt = 1/60;
    let hasUsedShield = false;

    while (elapsed < startElapsed + 5.0 && boss.currentPhaseIndex === 1) {
      elapsed += dt;
      const phaseTime = elapsed - startElapsed;
      const input = {
        keys: {},
        actions: [],
        consumeSkill2() { return false; },
        consumeSkill3() {
          const idx = this.actions.indexOf('skill3');
          if (idx !== -1) { this.actions.splice(idx, 1); return true; }
          return false;
        },
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

      if (!boss.shield.isBroken && !boss.shield.isShattering) {
        input.keys['KeyS'] = true;
        if (phaseTime >= dodgeStart && phaseTime < dodgeStart + dodgeDuration) {
          input.keys['KeyA'] = true;
        } else if (phaseTime >= dodgeStart + dodgeDuration && player.x < 399) {
          input.keys['KeyD'] = true;
        }
      } else if (boss.shield.isShattering) {
        input.keys['KeyS'] = true;
        if (player.x < 399) input.keys['KeyD'] = true;
      } else {
        if (!hasUsedShield) {
          input.actions.push('skill3');
          hasUsedShield = true;
        }
        input.keys['KeyS'] = true;
        if (player.x < 399) input.keys['KeyD'] = true;
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
    }

    if (boss.currentPhaseIndex >= 2 && player.hp === 3) {
      console.log(`SUCCESS! dodgeStart=${dodgeStart}, dur=${dodgeDuration}, endPos=(${player.x.toFixed(1)}, ${player.y.toFixed(1)}), time=${(elapsed-startElapsed).toFixed(3)}s`);
    }
  }
}
