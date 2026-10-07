// Check every possible mid-fight blink angle and timing
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

function testMidBlink(moveName, moveFn, blinkAngleDeg, blinkTime) {
  const bossX = 600, bossY = 130;
  const shield = new SimShield(bossX, bossY, 8, 88);
  let px = 600, py = 750;
  const speed = 220, c = 1100, fireInterval = 0.22;
  let fireTimer = 0, autoFire = true;
  let bullets = [];
  const dt = 1 / 120;
  let hasBlinked = false;
  const rad = blinkAngleDeg * Math.PI / 180;
  const bx = Math.cos(rad);
  const by = Math.sin(rad);

  for (let t = 0; t <= 3.5; t += dt) {
    if (t >= blinkTime && !hasBlinked) {
      hasBlinked = true;
      px += bx * 300;
      py += by * 300;
      px = Math.max(36, Math.min(1200 - 36, px));
      py = Math.max(36, Math.min(800 - 36, py));
    }

    const m = moveFn(t, px, py);
    let mlen = Math.hypot(m.x, m.y);
    if (mlen > 0) {
      px += (m.x / mlen) * speed * dt;
      py += (m.y / mlen) * speed * dt;
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
    duration: 999,
    oneRev: false,
    hitLog: shield.hitLog
  };
}

// Sweep blink angles: 0 to 360 in 15 degree steps
// Sweep blink times: 0.3 to 1.5 in 0.05s steps
let found = [];
for (let deg = 0; deg < 360; deg += 15) {
  for (let bt = 0.2; bt <= 1.5; bt += 0.05) {
    // Test with W move
    const resW = testMidBlink('W', () => ({ x: 0, y: -1 }), deg, bt);
    if (resW.oneRev) {
      found.push({ move: 'W', deg, bt, duration: resW.duration, hitLog: resW.hitLog });
    }
    // Test with WD move
    const resWD = testMidBlink('WD', () => ({ x: 1, y: -1 }), deg, bt);
    if (resWD.oneRev) {
      found.push({ move: 'WD', deg, bt, duration: resWD.duration, hitLog: resWD.hitLog });
    }
  }
}

console.log(`Found ${found.length} mid-fight angled blink solutions!`);
if (found.length > 0) {
  found.sort((a, b) => a.duration - b.duration);
  found.slice(0, 5).forEach((f, i) => {
    console.log(`\n#${i+1}: Move: ${f.move} | Blink Angle: ${f.deg}° | Blink Time: ${f.bt.toFixed(2)}s | Duration: ${f.duration.toFixed(3)}s`);
    f.hitLog.forEach(h => {
      console.log(`  t=${h.time.toFixed(3)}s: WP ${h.wp} (diff=${(h.diff*180/Math.PI).toFixed(1)}°)`);
    });
  });
}
