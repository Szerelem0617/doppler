// Compare all blink and postMove strategies for 4-before, 4-after
const { testBlinkAfter4 } = (() => {
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

  function testBlinkAfter4({
    startX = 600,
    startY = 750,
    blinkDir = { x: 0, y: -1 },
    blinkTime = 0.82,
    postBlinkMove = { x: 1, y: -1 },
    maxTime = 3.5
  }) {
    const bossX = 600, bossY = 130;
    const shield = new SimShield(bossX, bossY, 8, 88);
    let px = startX, py = startY;
    const speed = 220, c = 1100, fireInterval = 0.22;
    let fireTimer = 0, autoFire = false;
    let bullets = [];
    let bulletCounter = 0;
    const dt = 1 / 60;
    let hasBlinked = false;
    let blinkActualTime = null;

    for (let t = 0; t <= maxTime; t += dt) {
      if (t >= 0.05 && !autoFire) autoFire = true;

      let mx = 0, my = -1;
      if (hasBlinked) {
        mx = postBlinkMove.x;
        my = postBlinkMove.y;
      }

      if (t >= blinkTime && !hasBlinked) {
        hasBlinked = true;
        blinkActualTime = t;
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
          bulletCounter++;
          bullets.push({
            id: bulletCounter,
            x: px,
            y: py,
            alive: true,
            firedAt: t,
            firedAfterBlink: hasBlinked
          });
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
            hitLog: shield.hitLog,
            blinkTime: blinkActualTime
          };
        }
      }
    }

    return {
      success: false,
      brokenCount: shield.weakpoints.filter(w => !w).length,
      oneRev: false,
      hitLog: shield.hitLog
    };
  }
  return { testBlinkAfter4 };
})();

console.log('Comparing solutions for: 4 before blink, 4 after blink');
const options = [
  { name: 'Blink A, PostMove WD', blink: { x: -1, y: 0 }, post: { x: 1, y: -1 } },
  { name: 'Blink WA, PostMove WD', blink: { x: -1, y: -1 }, post: { x: 1, y: -1 } },
  { name: 'Blink SA, PostMove WD', blink: { x: -1, y: 1 }, post: { x: 1, y: -1 } },
  { name: 'Blink D, PostMove WA', blink: { x: 1, y: 0 }, post: { x: -1, y: -1 } },
  { name: 'Blink WD, PostMove A', blink: { x: 1, y: -1 }, post: { x: -1, y: 0 } },
  { name: 'Blink WD, PostMove WA', blink: { x: 1, y: -1 }, post: { x: -1, y: -1 } }
];

options.forEach(opt => {
  for (let bt = 0.76; bt <= 0.86; bt += 0.02) {
    const res = testBlinkAfter4({
      blinkDir: opt.blink,
      postBlinkMove: opt.post,
      blinkTime: bt
    });
    if (res.success && res.oneRev) {
      console.log(`[${opt.name}] bt=${bt.toFixed(2)}s: Duration=${res.duration.toFixed(3)}s, MaxDiff=${res.maxDiffDeg.toFixed(1)}°`);
      const bLog = res.hitLog.map(h => `B#${h.bulletId}->WP${h.wp}(${(h.diff*180/Math.PI).toFixed(1)}°)`).join(' ');
      console.log(`   ${bLog}`);
    }
  }
});
