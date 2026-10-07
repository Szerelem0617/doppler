// Simulate TAS strategy for 2-s8 with W + Blink A
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

function testTasBlinkA(blinkT) {
  const bossX = 600, bossY = 130;
  const shield = new SimShield(bossX, bossY, 8, 88);
  let px = 600, py = 740;
  const speed = 220, c = 1100, fireInterval = 0.22;
  let fireTimer = 0, autoFire = false;
  let bullets = [];
  const dt = 1 / 60; // 60 FPS
  let hasBlinked = false;

  for (let t = 0; t <= 4.0; t += dt) {
    if (t >= 0.05 && !autoFire) autoFire = true;

    // Movement: default W
    let mx = 0, my = -1;

    // Blink at blinkT with A (dirX = -1, dirY = 0)
    if (t >= blinkT && !hasBlinked) {
      hasBlinked = true;
      px -= 300; // blink left
      px = Math.max(36, Math.min(1200 - 36, px));
    }

    let mlen = Math.hypot(mx, my);
    px += (mx / mlen) * speed * dt;
    py += (my / mlen) * speed * dt;

    shield.update(dt);

    if (autoFire) {
      fireTimer += dt;
      if (fireTimer >= fireInterval) {
        fireTimer -= fireInterval;
        bullets.push({ x: px, y: py, alive: true, firedAt: t });
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
        return {
          success: true,
          firstHitTime: shield.firstHitTime,
          breakTime: shield.breakTime,
          duration: shield.breakTime - shield.firstHitTime,
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

for (let bt = 0.70; bt <= 1.10; bt += 0.05) {
  const r = testTasBlinkA(bt);
  console.log(`BlinkTime=${bt.toFixed(2)}s: Success=${r.success}, Duration=${r.duration ? r.duration.toFixed(3)+'s' : 'N/A'}`);
  if (r.success) {
    console.log('  Hits: ' + r.hitLog.map(h => `${h.wp >= 0 ? 'WP'+h.wp : 'MISS'}(${(h.diff*180/Math.PI).toFixed(1)}°)`).join(' -> '));
  }
}
