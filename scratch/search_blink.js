const { SimShield } = (() => {
  class SimShield {
    constructor(bossX, bossY, count = 8, radius = 88) {
      this.bossX = bossX;
      this.bossY = bossY;
      this.count = count;
      this.radius = radius;
      this.omega = (Math.PI / 3) / 0.22;
      this.angleStep = (Math.PI * 2) / count;
      this.tolerance = Math.max(0.22, Math.min(0.38, this.angleStep * 0.42));
      this.reset();
    }

    reset() {
      this.currentAngle = 0;
      this.isRotating = false;
      this.weakpoints = new Array(this.count).fill(true);
      this.firstHitRegistered = false;
      this.firstHitTime = null;
      this.broken = false;
      this.breakTime = null;
      this.hitLog = [];
    }

    update(dt) {
      if (this.broken) return;
      if (this.isRotating) {
        this.currentAngle = (this.currentAngle + this.omega * dt) % (Math.PI * 2);
      }
    }

    checkHit(bullet, time) {
      if (this.broken) return false;
      const dx = bullet.x - this.bossX;
      const dy = bullet.y - this.bossY;
      const dist = Math.hypot(dx, dy);

      if (dist <= this.radius + 8 && dist >= this.radius - 16) {
        const hitAngle = Math.atan2(dy, dx);
        this.onHit(hitAngle, bullet, time);
        return true;
      }
      return false;
    }

    onHit(hitAngle, bullet, time) {
      bullet.alive = false;
      if (!this.firstHitRegistered) {
        this.firstHitRegistered = true;
        this.firstHitTime = time;
        this.currentAngle = hitAngle;
        this.weakpoints[0] = false;
        this.isRotating = true;
        this.hitLog.push({ time, wp: 0, hitAngle, diff: 0 });
        return;
      }

      let hitIndex = -1;
      let minDiff = 999;
      for (let i = 0; i < this.count; i++) {
        if (!this.weakpoints[i]) continue;
        const wpAngle = (this.currentAngle + i * this.angleStep) % (Math.PI * 2);
        let diff = Math.abs(hitAngle - wpAngle);
        if (diff > Math.PI) diff = Math.PI * 2 - diff;
        if (diff < minDiff) minDiff = diff;
        if (diff <= this.tolerance) {
          hitIndex = i;
          break;
        }
      }

      if (hitIndex !== -1) {
        this.weakpoints[hitIndex] = false;
        this.hitLog.push({ time, wp: hitIndex, hitAngle, diff: minDiff });
        if (this.weakpoints.every(wp => !wp)) {
          this.broken = true;
          this.breakTime = time;
        }
      } else {
        this.hitLog.push({ time, wp: -1, hitAngle, minDiff });
      }
    }
  }
  return { SimShield };
})();

function runSim({
  startX = 600,
  startY = 700,
  bossX = 600,
  bossY = 130,
  moveDir = { x: 0, y: -1 },
  blinkTime = null,
  blinkDir = { x: 0, y: -1 },
  fireStartTime = 0.05,
  maxTime = 3.0
}) {
  const shield = new SimShield(bossX, bossY, 8, 88);
  let px = startX;
  let py = startY;
  const speed = 220;
  const c = 1100;
  const fireInterval = 0.22;
  let fireTimer = 0;
  let autoFire = false;
  let bullets = [];
  const dt = 1 / 120;

  let hasBlinked = false;

  for (let t = 0; t <= maxTime; t += dt) {
    if (t >= fireStartTime && !autoFire) {
      autoFire = true;
    }

    if (blinkTime !== null && !hasBlinked && t >= blinkTime) {
      hasBlinked = true;
      let len = Math.hypot(blinkDir.x, blinkDir.y) || 1;
      px += (blinkDir.x / len) * 300;
      py += (blinkDir.y / len) * 300;
      px = Math.max(36, Math.min(1200 - 36, px));
      py = Math.max(36, Math.min(800 - 36, py));
    }

    let mlen = Math.hypot(moveDir.x, moveDir.y);
    if (mlen > 0) {
      px += (moveDir.x / mlen) * speed * dt;
      py += (moveDir.y / mlen) * speed * dt;
    }

    shield.update(dt);

    if (autoFire) {
      fireTimer += dt;
      if (fireTimer >= fireInterval) {
        fireTimer -= fireInterval;
        bullets.push({
          x: px,
          y: py,
          alive: true,
          firedAt: t
        });
      }
    }

    for (let b of bullets) {
      if (!b.alive) continue;
      const bdx = bossX - b.x;
      const bdy = bossY - b.y;
      const dist = Math.hypot(bdx, bdy);
      if (dist < 1) {
        b.alive = false;
        continue;
      }
      b.x += (bdx / dist) * c * dt;
      b.y += (bdy / dist) * c * dt;

      shield.checkHit(b, t);
      if (shield.broken) {
        return {
          success: true,
          duration: shield.breakTime - shield.firstHitTime,
          oneRev: (shield.breakTime - shield.firstHitTime) <= 1.32,
          hitLog: shield.hitLog
        };
      }
    }
  }

  return {
    success: false,
    brokenCount: shield.weakpoints.filter(w => !w).length,
    duration: 999,
    oneRev: false
  };
}

console.log('Searching parameter space for 1-revolution break with blink...');

const blinkDirs = [
  { name: 'W (Up)', x: 0, y: -1 },
  { name: 'WD (Up-Right)', x: 1, y: -1 },
  { name: 'D (Right)', x: 1, y: 0 },
  { name: 'SD (Down-Right)', x: 1, y: 1 },
  { name: 'S (Down)', x: 0, y: 1 },
  { name: 'SA (Down-Left)', x: -1, y: 1 },
  { name: 'A (Left)', x: -1, y: 0 },
  { name: 'WA (Up-Left)', x: -1, y: -1 }
];

const moveDirs = [
  { name: 'W', x: 0, y: -1 },
  { name: 'WD', x: 1, y: -1 },
  { name: 'WA', x: -1, y: -1 },
  { name: 'D', x: 1, y: 0 },
  { name: 'A', x: -1, y: 0 },
  { name: 'None', x: 0, y: 0 }
];

const startXs = [600, 450, 750, 300, 900];
const startYs = [700, 600, 500, 400];
let foundOneRev = [];

for (let startX of startXs) {
  for (let startY of startYs) {
    for (let m of moveDirs) {
      for (let b of blinkDirs) {
        // try blink times between 0.1s and 1.2s in 0.05s increments
        for (let bt = 0.1; bt <= 1.2; bt += 0.05) {
          const res = runSim({
            startX,
            startY,
            moveDir: m,
            blinkTime: bt,
            blinkDir: b,
            fireStartTime: 0.05
          });

          if (res.oneRev) {
            foundOneRev.push({
              startX,
              startY,
              move: m.name,
              blink: b.name,
              blinkTime: bt,
              duration: res.duration,
              hitLog: res.hitLog
            });
          }
        }
      }
    }
  }
}

console.log(`Found ${foundOneRev.length} 1-revolution configurations!`);
if (foundOneRev.length > 0) {
  foundOneRev.sort((a, b) => a.duration - b.duration);
  console.log('Top 5 fastest 1-revolution breaks:');
  foundOneRev.slice(0, 5).forEach((item, idx) => {
    console.log(`\n#${idx + 1}: Duration = ${item.duration.toFixed(3)}s`);
    console.log(`Start: (${item.startX}, ${item.startY}), Move: ${item.move}, Blink: ${item.blink} at t=${item.blinkTime.toFixed(2)}s`);
    console.log('Hit log:');
    item.hitLog.forEach(h => {
      console.log(`  t=${h.time.toFixed(3)}s: WP ${h.wp} (diff=${(h.diff*180/Math.PI).toFixed(1)}°)`);
    });
  });
} else {
  console.log('No 1-revolution breaks found in basic grid. Checking max broken weakpoints in <= 1.32s...');
}
