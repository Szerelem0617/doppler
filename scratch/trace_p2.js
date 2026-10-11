import { Boss } from '../src/game/Boss.js';
import { Player } from '../src/game/Player.js';

const dt = 1/60;
const boss = new Boss(400, 130, { phaseSequence: [7, 5, 8, 4, 9], phaseHps: [7, 7, 8, 9, 11], enableBullets: true });
boss.currentPhaseIndex = 2;
boss.currentPhaseHp = 8;
boss.shield.setConfiguration(8, 1.45);
const player = new Player(400, 602.3, boss);
player.autoFire = true;

let elapsed = 6.233;
for (let step = 0; step < 600; step++) {
  elapsed += dt;
  const inputs = {
    keys: {}, actions: [],
    consumeSkill2() { return false; },
    consumeSkill3() { return false; },
    getMovementVector() {
      let x = 0, y = 0;
      if (this.keys['KeyW']) y -= 1;
      if (this.keys['KeyS']) y += 1;
      if (this.keys['KeyA']) x -= 1;
      if (this.keys['KeyD']) x += 1;
      return { x, y };
    }
  };

  const targetY = boss.y + 45; // 175
  const targetX = boss.x;
  if (player.y > targetY + 2) inputs.keys['KeyW'] = true;
  else if (player.y < targetY - 2) inputs.keys['KeyS'] = true;
  if (player.x < targetX - 2) inputs.keys['KeyD'] = true;
  else if (player.x > targetX + 2) inputs.keys['KeyA'] = true;

  player.update(dt, inputs, 800, 800, boss.bullets);
  boss.update(dt, elapsed, player, { recordHit() {}, getFrequency() { return 4.0; } });

  for (const b of player.bullets) {
    if (!b.alive) continue;
    if (!boss.shield.isBroken) {
      if (!boss.shield.isShattering && player.isInsideShield) {
        const playerDist = Math.hypot(player.x - boss.x, player.y - boss.y);
        if (playerDist <= boss.shield.radius * 0.75) {
          const dx = b.x - boss.x;
          const dy = b.y - boss.y;
          if (Math.hypot(dx, dy) <= boss.radius + 6) {
            b.alive = false;
            boss.takeDamage(1, null, Date.now());
            console.log(`[t=${elapsed.toFixed(3)}] Inside core hit! Boss HP: ${boss.currentPhaseHp}`);
            continue;
          }
        }
      }
      if (boss.shield.checkBulletCollision(b, null, Date.now())) {
        console.log(`[t=${elapsed.toFixed(3)}] WP hit! Remaining WP: ${boss.shield.count}, broken: ${boss.shield.isBroken}`);
        continue;
      }
    } else {
      if (Math.hypot(b.x - boss.x, b.y - boss.y) <= boss.radius + 6) {
        b.alive = false;
        boss.takeDamage(1, null, Date.now());
        console.log(`[t=${elapsed.toFixed(3)}] Exposed core hit! Boss HP: ${boss.currentPhaseHp}`);
      }
    }
  }

  if (boss.currentPhaseIndex !== 2) {
    console.log(`Phase 2 complete at t=${elapsed.toFixed(3)}s, Boss Phase is now ${boss.currentPhaseIndex}! Player HP: ${player.hp}`);
    break;
  }
}
