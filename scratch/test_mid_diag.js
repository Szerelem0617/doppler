// Check what happens when blinking during rotation (t >= 0.7)
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

function testSingle(moveDir, blinkDir, blinkTime) {
  const bossX = 600, bossY = 130;
  const shield = new SimShield(bossX, bossY, 8, 88);
  let px = 600, py = 750;
  const speed = 220, c = 1100, fireInterval = 0.22;
  let fireTimer = 0, autoFire = true;
  let bullets = [];
  const dt = 1 / 120;
  let hasBlinked = false;

  for (let t = 0; t <= 3.5; t += dt) {
    if (t >= blinkTime && !hasBlinked) {
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

    fireTimer += dt;
    if (fireTimer >= fireInterval) {
      fireTimer -= fireInterval;
      bullets.push({ x: px, y: py, alive: true, firedAt: t });
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
    hitLog: shield.hitLog
  };
}

console.log('Testing blinking during rotation (bt = 0.8s, 0.9s, 1.0s, 1.1s)...');
const dirs = [
  { name: 'W', x: 0, y: -1 },
  { name: 'D', x: 1, y: 0 },
  { name: 'A', x: -1, y: 0 },
  { name: 'WD', x: 1, y: -1 },
  { name: 'WA', x: -1, y: -1 }
];

[0.8, 0.9, 1.0, 1.1].forEach(bt => {
  dirs.forEach(d => {
    const res = testSingle({ x: 0, y: -1 }, d, bt);
    console.log(`bt=${bt}s, blink=${d.name} -> Broken=${res.brokenCount || (res.success?8:0)}, Success=${res.success}, Duration=${res.duration ? res.duration.toFixed(3) : 'N/A'}`);
    if (res.hitLog.length > 0) {
      console.log('  Hits: ' + res.hitLog.map(h => `${h.wp >= 0 ? 'WP'+h.wp : 'MISS'}(${(h.diff!==undefined?h.diff:h.minDiff)*180/Math.PI|0}°)`).join(' -> '));
    }
  });
});
