import { Boss } from '../src/game/Boss.js';
import { Player } from '../src/game/Player.js';

const dt = 1 / 60;
const w = 800;
const h = 800;

for (const holdY of [480, 500, 520]) {
  for (const freq of [12, 16, 20, 24]) {
    const boss = new Boss(w / 2, 130, { phaseSequence: [7, 5, 8, 4, 9], phaseHps: [7, 7, 7, 9, 11], enableBullets: true });
    const player = new Player(w / 2, 710, boss);
    player.autoFire = true;

    let elapsed = 0;
    let p0Blinked = false;
    let p1StartTime = null;
    let p2StartTime = null;
    let p3StartTime = null;
    let p4StartTime = null;
    let p4ShieldWasBroken = false;
    let p4ShieldRestoredTime = null;
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
      if (phase === 3 && p3StartTime === null) p3StartTime = elapsed;
      if (phase === 4 && p4StartTime === null) p4StartTime = elapsed;

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
        const p4Time = elapsed - p4StartTime;
        if (boss.shield.isBroken) p4ShieldWasBroken = true;
        if (p4ShieldWasBroken && !boss.shield.isBroken && !p4ShieldRestoredTime) {
          p4ShieldRestoredTime = elapsed;
        }

        if (p4Time >= 0.40) {
          if (!boss.shield.isBroken && !boss.shield.isShattering && !p4ShieldWasBroken) {
            if (player.y < holdY - 4) input.keys['KeyS'] = true;
            else if (player.y > holdY + 4) input.keys['KeyW'] = true;
          } else if (boss.shield.isBroken || boss.shield.isShattering) {
            input.keys['KeyW'] = true;
            if (Math.sin(elapsed * freq) > 0) input.keys['KeyA'] = true;
            else input.keys['KeyD'] = true;
          } else if (p4ShieldRestoredTime) {
            if (!p4Blinked) {
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

    console.log(`holdY=${holdY}, freq=${freq}: bossHP=${boss.hp}, playerHP=${player.hp}`);
  }
}
