import { Boss } from '../src/game/Boss.js';
import { Player } from '../src/game/Player.js';

// Test backward (S) hits across 1.45s:
{
  const boss = new Boss(400, 130, { hp: 100, weakpoints: 1, enableBullets: false });
  boss.shield.rechargeDuration = 1.45;
  const player = new Player(400, 500, boss);
  player.autoFire = true;

  let elapsed = 0;
  const dt = 1/60;
  let hits = 0;
  let breakTime = null;

  while (elapsed < 4.0) {
    elapsed += dt;
    player.update(dt, { getMovementVector: () => ({ x: 0, y: 1 }) }, 800, 800, []);
    boss.shield.update(dt, player);

    for (const b of player.bullets) {
      if (!b.alive) continue;
      if (!boss.shield.isBroken) {
        if (boss.shield.checkBulletCollision(b, null, Date.now())) continue;
      } else {
        if (breakTime === null) breakTime = elapsed;
        if (Math.hypot(b.x - boss.x, b.y - boss.y) <= boss.radius + 6) {
          b.alive = false;
          hits++;
        }
      }
    }
    if (breakTime !== null && !boss.shield.isBroken) break;
  }
  console.log(`Backward (S) hits at rechargeDuration=1.45: ${hits} (Expect <= 6, specifically 5)`);
}
