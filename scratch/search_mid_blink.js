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
  startY = 750,
  bossX = 600,
  bossY = 130,
  movePlan = () => ({ x: 0, y: 0 }),
  blinkTime = null,
  blinkDir = { x: 0, y: -1 },
  fireStartTime = 0.05,
  maxTime = 3.5
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

    const m = movePlan(t, px, py);
    let mlen = Math.hypot(m.x, m.y);
    if (mlen > 0) {
      px += (m.x / mlen) * speed * dt;
      py += (m.y / mlen) * speed * dt;
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
    oneRev: false,
    hitLog: shield.hitLog
  };
}

const blinkDirs = [
  { name: 'W', x: 0, y: -1 },
  { name: 'WD', x: 1, y: -1 },
  { name: 'D', x: 1, y: 0 },
  { name: 'SD', x: 1, y: 1 },
  { name: 'S', x: 0, y: 1 },
  { name: 'SA', x: -1, y: 1 },
  { name: 'A', x: -1, y: 0 },
  { name: 'WA', x: -1, y: -1 }
];

const moveModes = [
  { name: 'W', fn: (t) => ({ x: 0, y: -1 }) },
  { name: 'WD', fn: (t) => ({ x: 1, y: -1 }) },
  { name: 'WA', fn: (t) => ({ x: -1, y: -1 }) },
  { name: 'D', fn: (t) => ({ x: 1, y: 0 }) },
  { name: 'A', fn: (t) => ({ x: -1, y: 0 }) },
  { name: 'WD then W (0.5s)', fn: (t) => t < 0.5 ? ({ x: 1, y: -1 }) : ({ x: 0, y: -1 }) }
];

console.log('Searching for mid-fight tactical blinks (bt >= 0.4s)...');
let midResults = [];

for (let m of moveModes) {
  for (let b of blinkDirs) {
    for (let bt = 0.40; bt <= 1.8; bt += 0.02) {
      const res = runSim({
        startX: 600,
        startY: 750,
        movePlan: m.fn,
        blinkTime: bt,
        blinkDir: b
      });

      if (res.oneRev) {
        midResults.push({
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

console.log(`Found ${midResults.length} mid-fight 1-rev solutions!`);
if (midResults.length > 0) {
  midResults.sort((a, b) => a.duration - b.duration);
  midResults.slice(0, 5).forEach((r, i) => {
    console.log(`\n#${i+1}: Duration = ${r.duration.toFixed(3)}s | Move: ${r.move} | Blink: ${r.blink} @ t=${r.blinkTime.toFixed(2)}s`);
    r.hitLog.forEach(h => {
      console.log(`  t=${h.time.toFixed(3)}s: WP ${h.wp} (diff=${(h.diff*180/Math.PI).toFixed(1)}°)`);
    });
  });
}
