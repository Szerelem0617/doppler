import { Boss } from '../src/game/Boss.js';
import { Player } from '../src/game/Player.js';

const dt = 1 / 60;
const w = 800;
const h = 800;

function simulateSweep(weakpointCount, radius, speedMultiplier, initialDelay = 0) {
  const boss = new Boss(400, 130, {
    phaseSequence: [weakpointCount],
    phaseHps: [999],
    enableBullets: false
  });
  boss.shield.setConfiguration(weakpointCount, 1.45);

  // Start at bottom of circle: (400, 130 + radius)
  const player = new Player(400, 130 + radius, boss);
  player.autoFire = true;
  // If initialDelay > 0, don't fire yet
  if (initialDelay > 0) {
    player.autoFire = false;
  }

  let elapsed = 0;
  let firstHitTime = null;
  const hitTimes = [];
  const oneRevTime = (Math.PI * 2) / boss.shield.rotationSpeed; // 1.32s

  while (elapsed < 3.0) {
    elapsed += dt;

    if (!player.autoFire && elapsed >= initialDelay) {
      player.autoFire = true;
    }

    // Tangential clockwise movement
    const dx = player.x - boss.x;
    const dy = player.y - boss.y;
    const currentAngle = Math.atan2(dy, dx);
    const currentDist = Math.hypot(dx, dy);

    // Clockwise tangent
    let tx = -Math.sin(currentAngle);
    let ty = Math.cos(currentAngle);
    // Radial correction
    const rErr = currentDist - radius;
    let rx = -Math.cos(currentAngle) * (rErr * 0.1);
    let ry = -Math.sin(currentAngle) * (rErr * 0.1);

    let vx = (tx + rx) * speedMultiplier;
    let vy = (ty + ry) * speedMultiplier;
    const len = Math.hypot(vx, vy);

    const input = {
      keys: {}, actions: [],
      consumeSkill2() { return false; },
      consumeSkill3() { return false; },
      getMovementVector() {
        return len > 0 ? { x: vx / len, y: vy / len } : { x: 0, y: 0 };
      }
    };

    player.update(dt, input, w, h, boss.bullets);
    boss.update(dt, elapsed, player, { recordHit() {}, getFrequency() { return 4.0; } });

    for (const b of player.bullets) {
      if (!b.alive) continue;
      if (!boss.shield.isBroken && !boss.shield.isShattering) {
        const countBefore = boss.shield.weakpoints.filter(wp => !wp).length;
        boss.shield.checkBulletCollision(b, null, Date.now());
        const countAfter = boss.shield.weakpoints.filter(wp => !wp).length;

        if (countAfter > countBefore) {
          if (firstHitTime === null) firstHitTime = elapsed;
          hitTimes.push(elapsed);
        }
      }
    }

    if (boss.shield.isBroken || boss.shield.isShattering) break;
  }

  const hitsIn1Rev = firstHitTime !== null
    ? hitTimes.filter(t => t <= firstHitTime + oneRevTime).length
    : 0;

  return {
    hitsIn1Rev,
    totalHits: hitTimes.length,
    allBroken: boss.shield.isBroken || boss.shield.isShattering,
    time: firstHitTime !== null && hitTimes.length > 0 ? (hitTimes[hitTimes.length - 1] - firstHitTime).toFixed(3) : 'N/A'
  };
}

console.log('=== PARAMETER SWEEP FOR CLOCKWISE CIRCLING ===');
for (const count of [7, 8, 9]) {
  console.log(`\n>>> Testing for ${count} Weakpoints:`);
  let max1Rev = 0;
  let bestParams = null;

  // Test radius from 88px (touching shield wall) to 120px
  // Test speed from 0.1 to 1.0 (player speed 260 * multiplier)
  // Test initialDelay from 0 to 0.22 in steps of 0.02
  for (const r of [88, 92, 96, 100, 105, 110]) {
    for (const spd of [0.0, 0.2, 0.4, 0.6, 0.8, 1.0]) {
      for (let delay = 0; delay <= 0.22; delay += 0.04) {
        const res = simulateSweep(count, r, spd, delay);
        if (res.hitsIn1Rev > max1Rev) {
          max1Rev = res.hitsIn1Rev;
          bestParams = { r, spd, delay, res };
        }
      }
    }
  }

  console.log(`Max hits in 1 revolution (1.32s) for ${count} WP: ${max1Rev}/${count}`);
  if (bestParams) {
    console.log(`  Best Config: R=${bestParams.r}px, SpeedMult=${bestParams.spd}, Delay=${bestParams.delay.toFixed(2)}s`);
    console.log(`  Total Hits: ${bestParams.res.totalHits}/${count}, All Broken: ${bestParams.res.allBroken}, Time: ${bestParams.res.time}s`);
  }
}
