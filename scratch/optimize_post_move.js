// Sweep post-blink movements and blink directions to minimize max deviation
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
        this.hitLog.push({ time, wp: 0, hitAngle, diff: 0, bulletId: bullet.id });
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
        this.hitLog.push({ time, wp: hitIndex, hitAngle, diff: minDiff, bulletId: bullet.id });
        if (this.weakpoints.every(wp => !wp)) {
          this.broken = true;
          this.breakTime = time;
        }
      } else {
        this.hitLog.push({ time, wp: -1, hitAngle, minDiff, bulletId: bullet.id });
      }
    }
  }
  return { SimShield };
})();

function testConfig(blinkDir, postMoveFn, blinkT = 0.82) {
  const bossX = 600, bossY = 130;
  const shield = new SimShield(bossX, bossY, 8, 88);
  let px = 600, py = 750;
  const speed = 220, c = 1100, fireInterval = 0.22;
  let fireTimer = 0, autoFire = false;
  let bullets = [];
  let bulletId = 0;
  const dt = 1 / 60;
  let hasBlinked = false;

  for (let t = 0; t <= 4.0; t += dt) {
    if (!autoFire && t >= 0.05) autoFire = true;

    let mx = 0, my = -1;
    if (hasBlinked) {
      const m = postMoveFn(t - blinkT);
      mx = m.x; my = m.y;
    }

    if (t >= blinkT && !hasBlinked) {
      hasBlinked = true;
      let len = Math.hypot(blinkDir.x, blinkDir.y) || 1;
      px += (blinkDir.x / len) * 300;
      py += (blinkDir.y / len) * 300;
      px = Math.max(36, Math.min(1200 - 36, px));
      py = Math.max(36, Math.min(800 - 36, py));
    }

    let mlen = Math.hypot(mx, my);
    if (mlen > 0) {
      px += (mx / mlen) * speed * dt;
      py += (my / mlen) * speed * dt;
    }
    px = Math.max(36, Math.min(1200 - 36, px));
    py = Math.max(36, Math.min(800 - 36, py));

    shield.update(dt);

    if (autoFire) {
      fireTimer += dt;
      if (fireTimer >= fireInterval) {
        fireTimer -= fireInterval;
        bulletId++;
        bullets.push({ id: bulletId, x: px, y: py, alive: true, firedAt: t });
      }
    }

    for (let b of bullets) {
      if (!b.alive) continue;
      const bdx = bossX - b.x, bdy = bossY - b.y;
      const dist = Math.hypot(bdx, bdy);
      if (dist < 1) { b.alive = false; continue; }
      b.x += (bdx / dist) * c * dt;
      b.y += (bdy / dist) * c * dt;
      shield.checkHit(b, t);
      if (shield.broken) {
        const maxDiff = Math.max(...shield.hitLog.map(h => h.diff || 0));
        return {
          success: true,
          duration: shield.breakTime - shield.firstHitTime,
          oneRev: (shield.breakTime - shield.firstHitTime) <= 1.320,
          maxDiffDeg: maxDiff * 180 / Math.PI,
          hitLog: shield.hitLog
        };
      }
    }
  }

  return { success: false, brokenCount: shield.weakpoints.filter(w => !w).length, hitLog: shield.hitLog };
}

// Test variations of postMove
const moveOptions = [
  { name: 'Pure WD', fn: () => ({ x: 1, y: -1 }) },
  { name: 'D 0.3s then WD', fn: (t) => t < 0.3 ? ({ x: 1, y: 0 }) : ({ x: 1, y: -1 }) },
  { name: 'D 0.4s then WD', fn: (t) => t < 0.4 ? ({ x: 1, y: 0 }) : ({ x: 1, y: -1 }) },
  { name: 'D 0.5s then W', fn: (t) => t < 0.5 ? ({ x: 1, y: 0 }) : ({ x: 0, y: -1 }) },
  { name: 'D 0.6s then W', fn: (t) => t < 0.6 ? ({ x: 1, y: 0 }) : ({ x: 0, y: -1 }) },
];

const blinkOptions = [
  { name: 'A (pure left)', dir: { x: -1, y: 0 } },
  { name: 'WA (up-left)', dir: { x: -1, y: -1 } },
  { name: 'SA (down-left)', dir: { x: -1, y: 1 } },
  { name: 'Angle 165°', dir: { x: Math.cos(165*Math.PI/180), y: Math.sin(165*Math.PI/180) } },
  { name: 'Angle 170°', dir: { x: Math.cos(170*Math.PI/180), y: Math.sin(170*Math.PI/180) } }
];

let candidates = [];
for (let b of blinkOptions) {
  for (let m of moveOptions) {
    for (let bt of [0.80, 0.82, 0.84]) {
      const res = testConfig(b.dir, m.fn, bt);
      if (res.success && res.oneRev) {
        candidates.push({
          blink: b.name,
          move: m.name,
          bt,
          duration: res.duration,
          maxDiff: res.maxDiffDeg,
          hitLog: res.hitLog
        });
      }
    }
  }
}

candidates.sort((a, b) => a.maxDiff - b.maxDiff);
console.log(`Found ${candidates.length} 1-rev candidates. Top 5 with lowest max deviation:`);
candidates.slice(0, 5).forEach((c, i) => {
  console.log(`\n#${i+1}: MaxDiff = ${c.maxDiff.toFixed(1)}° | Duration = ${c.duration.toFixed(3)}s | Blink: ${c.blink} @ ${c.bt}s | Move: ${c.move}`);
  c.hitLog.forEach(h => {
    console.log(`  B#${h.bulletId} -> WP ${h.wp} (diff=${(h.diff*180/Math.PI).toFixed(1)}°, t=${h.time.toFixed(2)}s)`);
  });
});
