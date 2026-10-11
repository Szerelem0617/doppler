import { Boss } from '../src/game/Boss.js';
import { Player } from '../src/game/Player.js';
import { Shield } from '../src/game/Shield.js';

const dt = 1 / 60;
const w = 800;
const h = 800;

console.log('================================================================');
console.log(' EXPERIMENT: TIGHT CIRCLING vs FORWARD DOPPLER ON WEAKPOINTS');
console.log('================================================================\n');

// Let's create a test function that measures weakpoints hit
function testStrategy({
  label,
  weakpointCount = 8,
  startPos = { x: 400, y: 226 }, // R = 96 (tight to shield R=80 + player R=16)
  movementFn,
  maxTime = 3.0
}) {
  const boss = new Boss(400, 130, {
    phaseSequence: [weakpointCount],
    phaseHps: [999],
    enableBullets: false
  });
  boss.shield.setConfiguration(weakpointCount, 1.45);

  const player = new Player(startPos.x, startPos.y, boss);
  player.autoFire = true;

  let elapsed = 0;
  let firstHitTime = null;
  const hitTimes = [];
  const hitIndices = [];

  // Track shield state
  const oneRevolutionTime = (Math.PI * 2) / boss.shield.rotationSpeed; // 1.32s

  while (elapsed < maxTime && player.hp > 0) {
    elapsed += dt;

    const input = {
      keys: {}, actions: [],
      consumeSkill2() { return false; },
      consumeSkill3() { return false; },
      getMovementVector() {
        return movementFn(elapsed, player, boss);
      }
    };

    player.update(dt, input, w, h, boss.bullets);
    boss.update(dt, elapsed, player, { recordHit() {}, getFrequency() { return 4.0; } });

    // Handle bullet collisions
    for (const b of player.bullets) {
      if (!b.alive) continue;
      const dx = b.x - boss.x;
      const dy = b.y - boss.y;
      const dist = Math.hypot(dx, dy);

      if (!boss.shield.isBroken && !boss.shield.isShattering) {
        // Check weakpoint hit
        const countBefore = boss.shield.weakpoints.filter(wp => !wp).length;
        const hit = boss.shield.checkBulletCollision(b, null, Date.now());
        const countAfter = boss.shield.weakpoints.filter(wp => !wp).length;

        if (countAfter > countBefore) {
          if (firstHitTime === null) firstHitTime = elapsed;
          hitTimes.push(elapsed);
          hitIndices.push(countAfter);
        }
      }
    }

    if (boss.shield.isBroken || boss.shield.isShattering) {
      break;
    }
  }

  // Count hits within 1 full shield revolution (1.32s) from first hit
  const hitsInOneRevolution = firstHitTime !== null
    ? hitTimes.filter(t => t <= firstHitTime + oneRevolutionTime).length
    : 0;

  const totalHits = hitTimes.length;
  const timeToBreak = (boss.shield.isBroken || boss.shield.isShattering)
    ? (hitTimes[hitTimes.length - 1] - (firstHitTime || 0))
    : null;

  return {
    label,
    weakpointCount,
    totalHits,
    hitsInOneRevolution,
    oneRevolutionTime,
    hitTimes: hitTimes.map(t => (t - (firstHitTime || 0)).toFixed(3)),
    timeToBreak: timeToBreak !== null ? timeToBreak.toFixed(3) : 'Not Broken',
    allBroken: boss.shield.isBroken || boss.shield.isShattering
  };
}

// 1. Circling Movement Function:
// Orbit at radius R around Boss (400, 130)
function makeCircleMove(radius, clockwise = true) {
  return function(elapsed, player, boss) {
    const dx = player.x - boss.x;
    const dy = player.y - boss.y;
    const currentAngle = Math.atan2(dy, dx);
    const currentDist = Math.hypot(dx, dy);

    // Tangential direction:
    // Clockwise tangent: (-sin(angle), cos(angle))
    const sign = clockwise ? 1 : -1;
    let tangentX = -Math.sin(currentAngle) * sign;
    let tangentY = Math.cos(currentAngle) * sign;

    // Radial correction to stay exactly at desired radius:
    const radialErr = currentDist - radius;
    // Radial inward vector: (-cos(angle), -sin(angle))
    const radialCorr = -radialErr * 0.05; // P controller

    let vx = tangentX + (-Math.cos(currentAngle)) * radialCorr;
    let vy = tangentY + (-Math.sin(currentAngle)) * radialCorr;
    const len = Math.hypot(vx, vy);
    return { x: vx / len, y: vy / len };
  };
}

// Forward Movement Function:
function moveForward(elapsed, player, boss) {
  return { x: 0, y: -1 };
}

// Stationary Function:
function moveStationary(elapsed, player, boss) {
  return { x: 0, y: 0 };
}

console.log('--- TEST 1: 8 WEAKPOINTS (Phase 2 setting) ---');
for (const count of [7, 8, 9]) {
  console.log(`\n=================== WEAKPOINTS: ${count} ===================`);

  // A. Stationary at bottom (400, 226) (R = 96)
  const resStat = testStrategy({
    label: `Stationary (R=96px)`,
    weakpointCount: count,
    startPos: { x: 400, y: 130 + 96 },
    movementFn: moveStationary
  });
  console.log(`[${resStat.label}] Hits in 1 Rev (1.32s): ${resStat.hitsInOneRevolution}/${count} | Total Hits: ${resStat.totalHits} | All Broken: ${resStat.allBroken} | Time to Break: ${resStat.timeToBreak}s`);
  console.log(`   Hit intervals: ${resStat.hitTimes.join(', ')}`);

  // B. Hugging Shield Clockwise (R = 96px, tight)
  const resCw = testStrategy({
    label: `Hugging Shield Clockwise (R=96px, speed=260)`,
    weakpointCount: count,
    startPos: { x: 400, y: 130 + 96 },
    movementFn: makeCircleMove(96, true)
  });
  console.log(`[${resCw.label}] Hits in 1 Rev (1.32s): ${resCw.hitsInOneRevolution}/${count} | Total Hits: ${resCw.totalHits} | All Broken: ${resCw.allBroken} | Time to Break: ${resCw.timeToBreak}s`);
  console.log(`   Hit intervals: ${resCw.hitTimes.join(', ')}`);

  // C. Hugging Shield Counter-Clockwise (R = 96px)
  const resCcw = testStrategy({
    label: `Hugging Shield Counter-Clockwise (R=96px, speed=260)`,
    weakpointCount: count,
    startPos: { x: 400, y: 130 + 96 },
    movementFn: makeCircleMove(96, false)
  });
  console.log(`[${resCcw.label}] Hits in 1 Rev (1.32s): ${resCcw.hitsInOneRevolution}/${count} | Total Hits: ${resCcw.totalHits} | All Broken: ${resCcw.allBroken} | Time to Break: ${resCcw.timeToBreak}s`);
  console.log(`   Hit intervals: ${resCcw.hitTimes.join(', ')}`);

  // D. Moving Forward (Straight W forward from y=560 towards Boss)
  const resForward = testStrategy({
    label: `Moving Forward (Straight W from y=560 to Boss)`,
    weakpointCount: count,
    startPos: { x: 400, y: 560 },
    movementFn: moveForward,
    maxTime: 4.0
  });
  console.log(`[${resForward.label}] Hits in 1 Rev (1.32s): ${resForward.hitsInOneRevolution}/${count} | Total Hits: ${resForward.totalHits} | All Broken: ${resForward.allBroken} | Time to Break: ${resForward.timeToBreak}s`);
  console.log(`   Hit intervals: ${resForward.hitTimes.join(', ')}`);
}
