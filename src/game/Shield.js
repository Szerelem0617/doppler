import { audio } from '../engine/Audio.js';

// 旋转护盾类 (支持 2/4/6 等弱点配置，且始终保持恒定 300度/秒 旋转)
export class Shield {
  constructor(enemy, count = 4, radius = 78, baseFireInterval = 0.30) {
    this.enemy = enemy;
    this.radius = radius;
    this.count = count; // 弱点数量 (支持 2 / 4 / 6)
    this.baseInterval = baseFireInterval;

    // 始终保持护盾转速一致：严格对应 6 弱点基准静止射速 (发射周期 0.22s，每周期刚好旋转 60度 = π/3)
    this.rotationSpeed = (Math.PI / 3) / 0.22; // ≈ 4.759985 rad/s ≈ 272.727 deg/s
    this.currentAngle = 0;
    this.isRotating = false;

    // 弱点状态数组: true 为存在，false 为已破坏
    this.weakpoints = new Array(this.count).fill(true);

    this.isBroken = false;
    this.rechargeDuration = 2.4; // 破盾后暴露时间
    this.rechargeTimer = 0;

    this.firstHitRegistered = false;
    this.sparks = []; // 受击击破粒子
  }

  // 动态切换弱点配置 (如第二关 6 弱点冲锋护盾或 2 弱点环绕护盾)
  setConfiguration(count, rechargeDuration = 2.4) {
    this.count = count;
    this.rechargeDuration = rechargeDuration;
    this.weakpoints = new Array(this.count).fill(true);
    this.isBroken = false;
    this.rechargeTimer = 0;
    this.firstHitRegistered = false;
    this.currentAngle = 0;
  }

  update(dt, player) {
    // 粒子更新
    for (let i = this.sparks.length - 1; i >= 0; i--) {
      const p = this.sparks[i];
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.life -= dt;
      if (p.life <= 0) {
        this.sparks.splice(i, 1);
      }
    }

    if (this.isBroken) {
      this.rechargeTimer += dt;
      if (this.rechargeTimer >= this.rechargeDuration) {
        this.restore();
      }
      return;
    }

    // 护盾未激活时：0 号弱点如警戒瞄准镜般始终正对战机方位，首发命中 100% 自然平滑
    if (!this.isRotating && !this.firstHitRegistered && player) {
      const dx = player.x - this.enemy.x;
      const dy = player.y - this.enemy.y;
      this.currentAngle = Math.atan2(dy, dx);
    } else if (this.isRotating) {
      // 护盾激活后恒速旋转
      this.currentAngle = (this.currentAngle + this.rotationSpeed * dt) % (Math.PI * 2);
    }
  }

  // 检测子弹与护盾碰撞（同时记录受击频率）
  checkBulletCollision(bullet, frequencyMeter, now) {
    if (this.isBroken) return false;

    const dx = bullet.x - this.enemy.x;
    const dy = bullet.y - this.enemy.y;
    const dist = Math.hypot(dx, dy);

    if (dist <= this.radius + 8 && dist >= this.radius - 16) {
      const hitAngle = Math.atan2(dy, dx);
      this.onBulletHitShield(hitAngle, bullet, frequencyMeter, now);
      return true;
    }

    return false;
  }

  onBulletHitShield(hitAngle, bullet, frequencyMeter, now) {
    bullet.alive = false;

    if (frequencyMeter) {
      frequencyMeter.recordHit(now);
    }
    const currentFreq = frequencyMeter ? frequencyMeter.getFrequency() : 3.33;

    // 规则 1：第一次攻击到护盾，一定会击中第一个弱点并开启旋转
    if (!this.firstHitRegistered) {
      this.firstHitRegistered = true;
      this.currentAngle = hitAngle;
      this.weakpoints[0] = false;
      this.isRotating = true;
      audio.playWeakpointHit();
      this.createSparks(bullet.x, bullet.y, '#ffaa00');
      this.checkAllWeakpoints();
      return;
    }

    const angleStep = (Math.PI * 2) / this.count;
    let hitIndex = -1;
    // 弱点判定容差：动态自适应弱点数量 (基础占比 0.42，最小不低于 0.22 rad，最大不超过 0.38 rad)
    const tolerance = Math.max(0.22, Math.min(0.38, ((Math.PI * 2) / this.count) * 0.42));

    for (let i = 0; i < this.count; i++) {
      if (!this.weakpoints[i]) continue;
      const wpAngle = (this.currentAngle + i * angleStep) % (Math.PI * 2);
      
      let diff = Math.abs(hitAngle - wpAngle);
      if (diff > Math.PI) diff = Math.PI * 2 - diff;

      if (diff <= tolerance) {
        hitIndex = i;
        break;
      }
    }

    if (hitIndex !== -1) {
      this.weakpoints[hitIndex] = false;
      audio.playWeakpointHit();
      this.createSparks(bullet.x, bullet.y, '#ffaa00');
      this.checkAllWeakpoints();
    } else {
      audio.playTargetHit(currentFreq * 0.8);
      this.createSparks(bullet.x, bullet.y, 'rgba(0, 240, 255, 0.8)');
    }
  }

  checkAllWeakpoints() {
    const allDestroyed = this.weakpoints.every(wp => !wp);
    if (allDestroyed) {
      this.isBroken = true;
      this.rechargeTimer = 0;
      audio.playShieldBreak();
      this.createBreakExplosion();
    }
  }

  restore() {
    this.isBroken = false;
    this.rechargeTimer = 0;
    this.weakpoints.fill(true);
    this.isRotating = true;
  }

  createSparks(x, y, color) {
    for (let i = 0; i < 12; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 70 + Math.random() * 140;
      this.sparks.push({
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life: 0.25 + Math.random() * 0.2,
        color
      });
    }
  }

  createBreakExplosion() {
    for (let i = 0; i < 36; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 120 + Math.random() * 220;
      this.sparks.push({
        x: this.enemy.x + Math.cos(angle) * this.radius,
        y: this.enemy.y + Math.sin(angle) * this.radius,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life: 0.5 + Math.random() * 0.3,
        color: '#ffaa00'
      });
    }
  }

  render(ctx) {
    for (const p of this.sparks) {
      ctx.fillStyle = p.color;
      ctx.shadowColor = p.color;
      ctx.shadowBlur = 6;
      ctx.beginPath();
      ctx.arc(p.x, p.y, 2, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.shadowBlur = 0;

    if (this.isBroken) {
      const progress = this.rechargeTimer / this.rechargeDuration;
      ctx.save();
      ctx.strokeStyle = 'rgba(255, 170, 0, 0.25)';
      ctx.lineWidth = 2;
      ctx.setLineDash([4, 8]);
      ctx.beginPath();
      ctx.arc(this.enemy.x, this.enemy.y, this.radius, 0, Math.PI * 2);
      ctx.stroke();

      ctx.strokeStyle = '#ffaa00';
      ctx.lineWidth = 4;
      ctx.setLineDash([]);
      ctx.shadowColor = '#ffaa00';
      ctx.shadowBlur = 10;
      ctx.beginPath();
      ctx.arc(this.enemy.x, this.enemy.y, this.radius, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * progress);
      ctx.stroke();
      ctx.restore();
      return;
    }

    ctx.save();
    ctx.shadowColor = 'rgba(255, 170, 0, 0.4)';
    ctx.shadowBlur = 12;
    ctx.strokeStyle = 'rgba(255, 170, 0, 0.6)';
    ctx.lineWidth = 2.5;

    const angleStep = (Math.PI * 2) / this.count;
    for (let i = 0; i < this.count; i++) {
      const startA = this.currentAngle + i * angleStep + 0.16;
      const endA = this.currentAngle + (i + 1) * angleStep - 0.16;
      ctx.beginPath();
      ctx.arc(this.enemy.x, this.enemy.y, this.radius, startA, endA);
      ctx.stroke();
    }

    for (let i = 0; i < this.count; i++) {
      const wpAngle = this.currentAngle + i * angleStep;
      const wx = this.enemy.x + Math.cos(wpAngle) * this.radius;
      const wy = this.enemy.y + Math.sin(wpAngle) * this.radius;
      const isAlive = this.weakpoints[i];

      if (isAlive) {
        ctx.shadowColor = '#ffaa00';
        ctx.shadowBlur = 15;
        ctx.fillStyle = '#ffea70';
        ctx.beginPath();
        ctx.arc(wx, wy, 6.5, 0, Math.PI * 2);
        ctx.fill();

        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(wx, wy, 9.5, 0, Math.PI * 2);
        ctx.stroke();
      } else {
        ctx.shadowBlur = 0;
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(wx, wy, 4.5, 0, Math.PI * 2);
        ctx.stroke();
      }
    }

    ctx.restore();
  }

  reset() {
    this.weakpoints.fill(true);
    this.isBroken = false;
    this.rechargeTimer = 0;
    this.isRotating = false;
    this.firstHitRegistered = false;
    this.currentAngle = 0;
    this.sparks = [];
  }
}
