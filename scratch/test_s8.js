// Exact simulation of Doppler Game Engine for STAGE 2-s8
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
      this.hitLog.push({ time, wp: 0, hitAngle, wpAngle: hitAngle, diff: 0 });
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

function runSim({
  startX = 600,
  startY = 700,
  bossX = 600,
  bossY = 130,
  movePlan = () => ({ x: 0, y: 0 }),
  blinkTime = null,
  blinkDir = { x: 0, y: -1 },
  fireStartTime = 0.05,
  maxTime = 5.0
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
  const dt = 1 / 120; // 120 fps for high precision

  let hasBlinked = false;

  for (let t = 0; t <= maxTime; t += dt) {
    if (t >= fireStartTime && !autoFire) {
      autoFire = true;
    }

    // Blink
    if (blinkTime !== null && !hasBlinked && t >= blinkTime) {
      hasBlinked = true;
      let len = Math.hypot(blinkDir.x, blinkDir.y) || 1;
      px += (blinkDir.x / len) * 300;
      py += (blinkDir.y / len) * 300;
      // boundary clamp
      px = Math.max(36, Math.min(1200 - 36, px));
      py = Math.max(36, Math.min(800 - 36, py));
    }

    // Movement
    const m = movePlan(t, px, py);
    let mlen = Math.hypot(m.x, m.y);
    if (mlen > 0) {
      px += (m.x / mlen) * speed * dt;
      py += (m.y / mlen) * speed * dt;
    }

    // Shield update
    shield.update(dt);

    // Shooting
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

    // Update bullets
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
          breakTime: shield.breakTime,
          firstHitTime: shield.firstHitTime,
          duration: shield.breakTime - shield.firstHitTime,
          oneRevolution: (shield.breakTime - shield.firstHitTime) <= 1.32,
          hitLog: shield.hitLog
        };
      }
    }
  }

  return {
    success: false,
    brokenCount: shield.weakpoints.filter(w => !w).length,
    remainingWeakpoints: shield.weakpoints.map((w, i) => w ? i : null).filter(x => x !== null),
    hitLog: shield.hitLog
  };
}

// 1. Test previous WD -> W strategy
console.log('--- 1. Testing Previous WD -> W Strategy ---');
const resWD = runSim({
  movePlan: (t) => t < 0.55 ? { x: 1, y: -1 } : { x: 0, y: -1 }
});
console.log({
  success: resWD.success,
  firstHitTime: resWD.firstHitTime?.toFixed(3),
  breakTime: resWD.breakTime?.toFixed(3),
  duration: resWD.duration?.toFixed(3),
  oneRevolution: resWD.oneRevolution
});
console.log('Hit log for WD -> W:');
resWD.hitLog.forEach(h => {
  console.log(`t=${h.time.toFixed(3)}s: WP ${h.wp} (diff=${h.diff !== undefined ? (h.diff*180/Math.PI).toFixed(1)+'°' : (h.minDiff*180/Math.PI).toFixed(1)+'°'})`);
});
