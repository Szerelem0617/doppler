// Simulate: "Hit first 4 weakpoints, then blink, then hit remaining 4 weakpoints"
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
  blinkTime = 0.75, // right after firing bullet 4 (which fires at ~0.71s if autoFire at 0.05s)
  postBlinkMove = { x: 0, y: -1 },
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

    // Movement: before blink, move W
    let mx = 0, my = -1;
    if (hasBlinked) {
      mx = postBlinkMove.x;
      my = postBlinkMove.y;
    }

    // Blink check
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
        return {
          success: true,
          duration: shield.breakTime - shield.firstHitTime,
          oneRev: (shield.breakTime - shield.firstHitTime) <= 1.320,
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

console.log('Testing 4-before-blink, 4-after-blink strategies...');

// We want bullets 1..4 to be fired before blink.
// With fireStartTime = 0.05, fireInterval = 0.22:
// Bullet 1: 0.27s
// Bullet 2: 0.49s
// Bullet 3: 0.71s
// Bullet 4: 0.93s
// So blinkTime should be >= 0.94s (after Bullet 4 is fired!)
// Or if fireStartTime = 0.00:
// Bullet 1: 0.22s
// Bullet 2: 0.44s
// Bullet 3: 0.66s
// Bullet 4: 0.88s

const candidateBlinkDirs = [
  { name: 'W', x: 0, y: -1 },
  { name: 'WD', x: 1, y: -1 },
  { name: 'D', x: 1, y: 0 },
  { name: 'SD', x: 1, y: 1 },
  { name: 'S', x: 0, y: 1 },
  { name: 'SA', x: -1, y: 1 },
  { name: 'A', x: -1, y: 0 },
  { name: 'WA', x: -1, y: -1 }
];

const postBlinkMoves = [
  { name: 'W', x: 0, y: -1 },
  { name: 'WD', x: 1, y: -1 },
  { name: 'WA', x: -1, y: -1 },
  { name: 'D', x: 1, y: 0 },
  { name: 'A', x: -1, y: 0 },
  { name: 'None', x: 0, y: 0 }
];

let successfulSplits = [];

for (let bt = 0.70; bt <= 1.25; bt += 0.03) {
  for (let b of candidateBlinkDirs) {
    for (let pm of postBlinkMoves) {
      const res = testBlinkAfter4({
        startX: 600,
        startY: 750,
        blinkDir: b,
        blinkTime: bt,
        postBlinkMove: pm
      });

      if (res.success) {
        // Check if bullets 1..4 hit WP before blink, and bullets 5..8 hit WP after blink!
        const preBlinkHits = res.hitLog.filter(h => h.bulletId <= 4 && h.wp >= 0);
        const postBlinkHits = res.hitLog.filter(h => h.bulletId > 4 && h.wp >= 0);

        if (preBlinkHits.length === 4 && postBlinkHits.length === 4) {
          successfulSplits.push({
            bt,
            blinkDir: b.name,
            postMove: pm.name,
            duration: res.duration,
            oneRev: res.oneRev,
            hitLog: res.hitLog
          });
        }
      }
    }
  }
}

console.log(`Found ${successfulSplits.length} perfect 4-pre, 4-post split configurations!`);
if (successfulSplits.length > 0) {
  successfulSplits.sort((a, b) => a.duration - b.duration);
  console.log('Top 5 solutions:');
  successfulSplits.slice(0, 5).forEach((s, idx) => {
    console.log(`\n#${idx+1}: Duration=${s.duration.toFixed(3)}s (oneRev=${s.oneRev}) | Blink: ${s.blinkDir} @ t=${s.bt.toFixed(2)}s | PostMove: ${s.postMove}`);
    s.hitLog.forEach(h => {
      console.log(`  Bullet #${h.bulletId} -> WP ${h.wp} (diff=${(h.diff*180/Math.PI).toFixed(1)}°, t=${h.time.toFixed(3)}s)`);
    });
  });
}
