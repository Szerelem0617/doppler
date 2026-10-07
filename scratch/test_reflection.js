// Test whether a reflected bullet can fill the gap of missed weakpoint (WP 5 / WP 4)
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
    checkHit(bullet, time, source = 'player') {
      if (this.broken) return false;
      const dx = bullet.x - this.bossX;
      const dy = bullet.y - this.bossY;
      const dist = Math.hypot(dx, dy);
      if (dist <= this.radius + 8 && dist >= this.radius - 16) {
        const hitAngle = Math.atan2(dy, dx);
        this.onHit(hitAngle, bullet, time, source);
        return true;
      }
      return false;
    }
    onHit(hitAngle, bullet, time, source) {
      bullet.alive = false;
      if (!this.firstHitRegistered) {
        this.firstHitRegistered = true;
        this.firstHitTime = time;
        this.currentAngle = hitAngle;
        this.weakpoints[0] = false;
        this.isRotating = true;
        this.hitLog.push({ time, wp: 0, hitAngle, diff: 0, source });
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
        this.hitLog.push({ time, wp: hitIndex, hitAngle, diff: minDiff, source });
        if (this.weakpoints.every(wp => !wp)) {
          this.broken = true;
          this.breakTime = time;
        }
      } else {
        this.hitLog.push({ time, wp: -1, hitAngle, minDiff, source });
      }
    }
  }
  return { SimShield };
})();

// In the previous WD -> W strategy, player fires naturally.
// Now suppose Boss fires a bullet at t_boss_fire.
// Player reflects it at t_reflect when player is at (px, py).
// Let's test different reflect speeds (e.g. boss speed 230/360, or player bullet speed 1100, or 650).
function testReflectFill({ reflectSpeed = 360, bossFireTime = 0.2, bossBulletSpeed = 360 }) {
  const bossX = 600, bossY = 130;
  const shield = new SimShield(bossX, bossY, 8, 88);
  let px = 600, py = 750;
  const speed = 220, c = 1100, fireInterval = 0.22;
  let fireTimer = 0, autoFire = true;
  let playerBullets = [];
  const dt = 1 / 120;

  // Boss bullet
  let bossBullet = null;

  for (let t = 0; t <= 3.5; t += dt) {
    // Player move WD -> W
    let mx = 0, my = -1;
    if (t < 0.55) { mx = 1; my = -1; }
    let mlen = Math.hypot(mx, my);
    px += (mx / mlen) * speed * dt;
    py += (my / mlen) * speed * dt;

    // Boss fires bullet
    if (bossBullet === null && t >= bossFireTime) {
      // fires towards player
      const dx = px - bossX, dy = py - bossY;
      const dist = Math.hypot(dx, dy);
      bossBullet = {
        x: bossX,
        y: bossY,
        vx: (dx / dist) * bossBulletSpeed,
        vy: (dy / dist) * bossBulletSpeed,
        alive: true,
        reflected: false
      };
    }

    // Update boss bullet
    if (bossBullet && bossBullet.alive) {
      if (!bossBullet.reflected) {
        bossBullet.x += bossBullet.vx * dt;
        bossBullet.y += bossBullet.vy * dt;
        // Check if reaches player (L-shield range 36px)
        const dp = Math.hypot(bossBullet.x - px, bossBullet.y - py);
        if (dp <= 36) {
          // Reflect back towards boss!
          bossBullet.reflected = true;
          const rdx = bossX - bossBullet.x, rdy = bossY - bossBullet.y;
          const rdist = Math.hypot(rdx, rdy);
          bossBullet.vx = (rdx / rdist) * reflectSpeed;
          bossBullet.vy = (rdy / rdist) * reflectSpeed;
        }
      } else {
        bossBullet.x += bossBullet.vx * dt;
        bossBullet.y += bossBullet.vy * dt;
        // Check if hits shield
        shield.checkHit(bossBullet, t, 'reflected_boss_bullet');
      }
    }

    shield.update(dt);

    fireTimer += dt;
    if (fireTimer >= fireInterval) {
      fireTimer -= fireInterval;
      playerBullets.push({ x: px, y: py, alive: true, firedAt: t });
    }

    for (let b of playerBullets) {
      if (!b.alive) continue;
      const bdx = bossX - b.x, bdy = bossY - b.y;
      const dist = Math.hypot(bdx, bdy);
      if (dist < 1) { b.alive = false; continue; }
      b.x += (bdx / dist) * c * dt;
      b.y += (bdy / dist) * c * dt;
      shield.checkHit(b, t, 'player');
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
    hitLog: shield.hitLog
  };
}

console.log('Testing reflected bullet filling the gap...');
// Test various reflect speeds and fire times
const speeds = [230, 360, 480, 650, 800, 1100];
speeds.forEach(sp => {
  for (let bft = 0.0; bft <= 0.8; bft += 0.1) {
    const res = testReflectFill({ reflectSpeed: sp, bossFireTime: bft, bossBulletSpeed: 360 });
    if (res.success && res.oneRev) {
      console.log(`SUCCESS 1-REV! ReflectSpeed=${sp}, BossFireTime=${bft.toFixed(1)}s, Duration=${res.duration.toFixed(3)}s`);
      res.hitLog.forEach(h => {
        console.log(`  t=${h.time.toFixed(3)}s: [${h.source}] WP ${h.wp} (diff=${(h.diff*180/Math.PI).toFixed(1)}°)`);
      });
      return;
    }
  }
});
