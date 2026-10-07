// Test robustness across different startY (720 to 760) and blink times
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

function runRobustTest(startY, blinkT) {
  const bossX = 600, bossY = 130;
  const shield = new SimShield(bossX, bossY, 8, 88);
  let px = 600, py = startY;
  const speed = 220, c = 1100, fireInterval = 0.22;
  let fireTimer = 0, autoFire = false;
  let bullets = [];
  let bulletId = 0;
  const dt = 1 / 60;
  let state = { hasBlinked: false };

  for (let t = 0; t <= 4.0; t += dt) {
    const inputs = { keys: {}, actions: [] };
    if (!autoFire && t >= 0.05) {
      inputs.actions.push('toggleFire');
      autoFire = true;
    }

    if (shield.broken) {
      inputs.keys['KeyW'] = true;
    } else {
      if (!state.hasBlinked && t >= blinkT) {
        inputs.keys['KeyA'] = true;
        inputs.actions.push('skill2');
        state.hasBlinked = true;
      } else if (state.hasBlinked) {
        inputs.keys['KeyW'] = true;
        inputs.keys['KeyD'] = true;
      } else {
        inputs.keys['KeyW'] = true;
      }
    }

    let mx = 0, my = 0;
    if (inputs.keys['KeyW']) my -= 1;
    if (inputs.keys['KeyS']) my += 1;
    if (inputs.keys['KeyA']) mx -= 1;
    if (inputs.keys['KeyD']) mx += 1;
    if (mx !== 0 && my !== 0) {
      const s = 0.70710678;
      mx *= s;
      my *= s;
    }

    if (inputs.actions.includes('skill2')) {
      let dirX = mx, dirY = my;
      let len = Math.hypot(dirX, dirY) || 1;
      px += (dirX / len) * 300;
      py += (dirY / len) * 300;
      px = Math.max(36, Math.min(1200 - 36, px));
      py = Math.max(36, Math.min(800 - 36, py));
    }

    px += mx * speed * dt;
    py += my * speed * dt;
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
        return {
          success: true,
          duration: shield.breakTime - shield.firstHitTime,
          oneRev: (shield.breakTime - shield.firstHitTime) <= 1.320,
          hitLog: shield.hitLog
        };
      }
    }
  }

  return { success: false, brokenCount: shield.weakpoints.filter(w => !w).length, hitLog: shield.hitLog };
}

[720, 730, 740, 750, 760].forEach(sy => {
  [0.80, 0.82, 0.84].forEach(bt => {
    const res = runRobustTest(sy, bt);
    console.log(`startY=${sy}, bt=${bt.toFixed(2)}s: success=${res.success}, 1-rev=${res.oneRev}, duration=${res.duration ? res.duration.toFixed(3) : 'N/A'}`);
    if (!res.success) {
      console.log('  Misses: ' + res.hitLog.map(h => `B#${h.bulletId}->WP${h.wp}`).join(', '));
    }
  });
});
