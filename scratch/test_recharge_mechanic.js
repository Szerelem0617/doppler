import { Boss } from '../src/game/Boss.js';
import { Player } from '../src/game/Player.js';

console.log('=== TEST 2: Realistic Break & Recharge Cycle ===');

for (const duration of [1.35, 1.40, 1.45, 1.50, 1.55]) {
  const boss = new Boss(400, 130, { hp: 100, weakpoints: 1, enableBullets: false });
  boss.shield.rechargeDuration = duration;

  const player = new Player(400, 500, boss);
  player.autoFire = true;

  let elapsed = 0;
  const dt = 1/60;
  let hits = 0;
  let breakTime = null;

  while (elapsed < 4.0) {
    elapsed += dt;
    player.update(dt, { getMovementVector: () => ({ x: 0, y: 0 }) }, 800, 800, []);
    boss.shield.update(dt, player);

    for (const b of player.bullets) {
      if (!b.alive) continue;
      if (!boss.shield.isBroken) {
        if (boss.shield.checkBulletCollision(b, null, Date.now())) {
          // If this hit broke the shield
          if (boss.shield.isBroken && breakTime === null) {
            breakTime = elapsed;
          }
          continue;
        }
      } else {
        if (Math.hypot(b.x - boss.x, b.y - boss.y) <= boss.radius + 6) {
          b.alive = false;
          hits++;
        }
      }
    }

    if (breakTime !== null && !boss.shield.isBroken) {
      // Shield has restored!
      break;
    }
  }

  console.log(`Duration ${duration.toFixed(2)}s: stationary damage hits = ${hits}`);
}
