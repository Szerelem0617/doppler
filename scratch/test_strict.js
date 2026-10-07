// Fine-grained test for strict <= 1.320s duration with Blink A/WA
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

function testRun({ startX, startY, movePlan, blinkDir, blinkTime }) {
  const bossX = 600, bossY = 130;
  const shield = new SimShield(bossX, bossY, 8, 88);
  let px = startX, py = startY;
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

    const m = movePlan(t, px, py);
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
          oneRev: (shield.breakTime - shield.firstHitTime) <= 1.320,
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

let strictOneRev = [];

// Test different move plans and blink angles
for (let blinkAngle = 100; blinkAngle <= 260; blinkAngle += 5) {
  const rad = blinkAngle * Math.PI / 180;
  const bdir = { x: Math.cos(rad), y: Math.sin(rad) };

  for (let bt = 0.3; bt <= 1.3; bt += 0.05) {
    // Plan A: W push
    const resA = testRun({
      startX: 600,
      startY: 750,
      movePlan: () => ({ x: 0, y: -1 }),
      blinkDir: bdir,
      blinkTime: bt
    });
    if (resA.oneRev) {
      strictOneRev.push({ plan: 'W', angle: blinkAngle, bt, duration: resA.duration, hitLog: resA.hitLog });
    }

    // Plan B: W+A push
    const resB = testRun({
      startX: 600,
      startY: 750,
      movePlan: () => ({ x: -1, y: -1 }),
      blinkDir: bdir,
      blinkTime: bt
    });
    if (resB.oneRev) {
      strictOneRev.push({ plan: 'WA', angle: blinkAngle, bt, duration: resB.duration, hitLog: resB.hitLog });
    }
  }
}

console.log(`Found ${strictOneRev.length} strict <= 1.320s solutions!`);
if (strictOneRev.length > 0) {
  strictOneRev.sort((a, b) => a.duration - b.duration);
  strictOneRev.slice(0, 5).forEach((s, i) => {
    console.log(`\n#${i+1}: Duration = ${s.duration.toFixed(3)}s | Plan: ${s.plan} | Blink: ${s.angle}° @ t=${s.bt.toFixed(2)}s`);
    s.hitLog.forEach(h => {
      console.log(`  t=${h.time.toFixed(3)}s: WP ${h.wp} (diff=${(h.diff*180/Math.PI).toFixed(1)}°)`);
    });
  });
}
