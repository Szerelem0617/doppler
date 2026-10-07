import { Boss } from '../src/game/Boss.js';
import { Player } from '../src/game/Player.js';

console.log('--- Testing Section 2 trajectory for optimal Section 3 entry ---');

const w = 800;
const h = 800;
const dt = 1 / 60;

// Test different Section 2 steering:
// In Phase 1 (5 弱点): S + A to break 5 WP, but during damage phase, move towards X = 400 (or D) to re-center!
function testP1Steering(recenter) {
  const boss = new Boss(w / 2, 130, {
    phaseSequence: [7, 5, 8, 4, 9],
    phaseHps: [7, 7, 8, 9, 11],
    enableBullets: true
  });
  const player = new Player(w / 2, h - 90, boss);
  player.autoFire = true;

  let elapsed = 0;
  let p0Blinked = false;
  let p1Shielded = false;

  while (elapsed < 10.0 && boss.currentPhaseIndex < 2) {
    elapsed += dt;
    const input = {
      keys: {},
      actions: [],
      consumeSkill2() { return this.actions.includes('skill2'); },
      consumeSkill3() { return this.actions.includes('skill3'); },
      getMovementVector() {
        let x = 0, y = 0;
        if (this.keys['KeyW']) y -= 1;
        if (this.keys['KeyS']) y += 1;
        if (this.keys['KeyA']) x -= 1;
        if (this.keys['KeyD']) x += 1;
        return { x, y };
      }
    };

    if (boss.currentPhaseIndex === 0) {
      if (!boss.shield.isBroken && !boss.shield.isShattering) {
        input.keys['KeyW'] = true;
      } else if (!p0Blinked) {
        input.keys['KeyS'] = true;
        input.actions.push('skill2');
        p0Blinked = true;
      } else {
        input.keys['KeyW'] = true;
      }
    } else if (boss.currentPhaseIndex === 1) {
      if (!boss.shield.isBroken && !boss.shield.isShattering) {
        input.keys['KeyS'] = true;
        input.keys['KeyA'] = true;
      } else if (boss.shield.isShattering) {
        input.keys['KeyS'] = true;
        if (recenter && player.x < 360) input.keys['KeyD'] = true;
      } else {
        if (!p1Shielded) {
          input.actions.push('skill3');
          p1Shielded = true;
        }
        if (recenter) {
          if (player.x < 380) input.keys['KeyD'] = true;
          else if (player.x > 420) input.keys['KeyA'] = true;
        }
      }
    }

    player.update(dt, input, w, h, boss.bullets);
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

  console.log(`Phase 1 complete! Player pos: (${player.x.toFixed(1)}, ${player.y.toFixed(1)}), HP: ${player.hp}, Elapsed: ${elapsed.toFixed(2)}s`);
  return { player, boss, elapsed };
}

testP1Steering(true);
