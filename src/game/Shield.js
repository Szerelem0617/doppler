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
    this.rechargeDuration = 2.0; // 破盾后暴露时间 (2.0s 充裕输出窗口)
    this.rechargeTimer = 0;

    // 碎裂顿挫无敌机制 (0.35s 碎盾顿挫无敌帧，提供破盾与斩杀间的战略喘息与走位容错窗口)
    this.isShattering = false;
    this.shatterDuration = 0.35; 
    this.shatterTimer = 0;
    this.justBroken = false;
    this.shatterShockwaves = [];
    this.shatterShards = [];

    this.firstHitRegistered = false;
    this.sparks = []; // 受击击破粒子
  }

  // 动态切换弱点配置
  setConfiguration(count, rechargeDuration = 2.0) {
    this.count = count;
    this.rechargeDuration = rechargeDuration;
    this.weakpoints = new Array(this.count).fill(true);
    this.isBroken = false;
    this.isShattering = false;
    this.shatterTimer = 0;
    this.shatterDuration = 0.35;
    this.justBroken = false;
    this.shatterShockwaves = [];
    this.shatterShards = [];
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

    // 冲击波更新
    for (let i = this.shatterShockwaves.length - 1; i >= 0; i--) {
      const sw = this.shatterShockwaves[i];
      sw.radius += sw.speed * dt;
      sw.alpha -= dt / sw.maxLife;
      if (sw.alpha <= 0) {
        this.shatterShockwaves.splice(i, 1);
      }
    }

    // 碎裂外壳碎片更新
    for (let i = this.shatterShards.length - 1; i >= 0; i--) {
      const sh = this.shatterShards[i];
      sh.dist += 80 * dt;
      sh.rot += sh.rotSpeed * dt;
      sh.alpha = Math.max(0, sh.alpha - dt / 0.3);
      if (sh.alpha <= 0) {
        this.shatterShards.splice(i, 1);
      }
    }

    // 碎裂顿挫无敌过渡态更新
    if (this.isShattering) {
      this.shatterTimer += dt;
      if (this.shatterTimer >= this.shatterDuration) {
        this.isShattering = false;
        this.isBroken = true;
        this.rechargeTimer = 0;
      }
      return;
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

    // 碎裂顿挫无敌期间：拦截并弹飞子弹，保护核心并给玩家提供战术走位与喘息窗口
    if (this.isShattering) {
      const dx = bullet.x - this.enemy.x;
      const dy = bullet.y - this.enemy.y;
      const dist = Math.hypot(dx, dy);
      if (dist <= this.radius + 8) {
        bullet.alive = false;
        this.createSparks(bullet.x, bullet.y, 'rgba(255, 42, 109, 0.8)');
        audio.playTargetHit(2.5);
        if (typeof window !== 'undefined' && window.tas && window.tas.active) {
          const phase = this.enemy.currentPhaseIndex ?? 0;
          window.tas.recordBulletHit(phase, 'shatter', 1, 0);
        }
        return true;
      }
      return false;
    }

    const dx = bullet.x - this.enemy.x;
    const dy = bullet.y - this.enemy.y;
    const dist = Math.hypot(dx, dy);

    // 护盾未彻底破裂状态下：拦截所有到达或穿入护盾判定区的子弹，绝对禁止穿盾偷打核心！
    if (dist <= this.radius + 8) {
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
      if (typeof window !== 'undefined' && window.tas && window.tas.active) {
        const phase = this.enemy.currentPhaseIndex ?? 0;
        window.tas.recordBulletHit(phase, 'wp', 0, hitAngle);
      }
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
      if (typeof window !== 'undefined' && window.tas && window.tas.active) {
        const phase = this.enemy.currentPhaseIndex ?? 0;
        window.tas.recordBulletHit(phase, 'wp', hitIndex, hitAngle);
      }
      this.checkAllWeakpoints();
    } else {
      audio.playTargetHit(currentFreq * 0.8);
      this.createSparks(bullet.x, bullet.y, 'rgba(0, 240, 255, 0.8)');
      if (typeof window !== 'undefined' && window.tas && window.tas.active) {
        const phase = this.enemy.currentPhaseIndex ?? 0;
        window.tas.recordBulletHit(phase, 'deflect', 1, hitAngle);
      }
    }
  }

  checkAllWeakpoints() {
    const allDestroyed = this.weakpoints.every(wp => !wp);
    if (allDestroyed) {
      this.startShatter();
    }
  }

  startShatter() {
    this.isShattering = true;
    this.shatterTimer = 0;
    this.shatterDuration = 0.35; // 0.35s 碎裂顿挫无敌帧与战略喘息期
    this.isBroken = false;
    this.justBroken = true;
    this.rechargeTimer = 0;
    audio.playShieldBreak();
    this.createBreakExplosion();
    this.createFinalCollapseBurst();

    // 初始冲击波能量环
    this.shatterShockwaves = [{
      radius: this.radius * 0.85,
      maxRadius: this.radius * 1.5,
      speed: 180,
      alpha: 1.0,
      maxLife: 0.3
    }];

    // 生成碎裂外壳几何碎片
    this.shatterShards = [];
    const shardCount = Math.max(12, this.count * 3);
    for (let i = 0; i < shardCount; i++) {
      const a = (i * Math.PI * 2) / shardCount + (Math.random() - 0.5) * 0.2;
      const speed = 60 + Math.random() * 90;
      this.shatterShards.push({
        angle: a,
        dist: this.radius,
        vx: Math.cos(a) * speed,
        vy: Math.sin(a) * speed,
        rot: Math.random() * Math.PI * 2,
        rotSpeed: (Math.random() - 0.5) * 12,
        size: 5 + Math.random() * 5,
        alpha: 1.0
      });
    }
  }

  restore() {
    this.isBroken = false;
    this.isShattering = false;
    this.shatterTimer = 0;
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

  createFinalCollapseBurst() {
    for (let i = 0; i < 30; i++) {
      const angle = (i * Math.PI * 2) / 30;
      const speed = 140 + Math.random() * 160;
      this.sparks.push({
        x: this.enemy.x + Math.cos(angle) * this.radius,
        y: this.enemy.y + Math.sin(angle) * this.radius,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life: 0.4 + Math.random() * 0.2,
        color: '#ff2a6d'
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

    // 渲染碎盾冲击波
    for (const sw of this.shatterShockwaves) {
      ctx.save();
      ctx.strokeStyle = `rgba(255, 170, 0, ${sw.alpha * 0.8})`;
      ctx.lineWidth = 3;
      ctx.shadowColor = '#ffaa00';
      ctx.shadowBlur = 14;
      ctx.beginPath();
      ctx.arc(this.enemy.x, this.enemy.y, sw.radius, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }

    // 碎裂过渡态渲染
    if (this.isShattering) {
      const shatterRatio = this.shatterTimer / this.shatterDuration; // 0 -> 1
      const alpha = Math.max(0, 1 - shatterRatio * 0.6);
      ctx.save();

      // 1. 碎裂环与电弧抖动
      ctx.strokeStyle = `rgba(255, 42, 109, ${alpha})`;
      ctx.shadowColor = '#ffaa00';
      ctx.shadowBlur = 18;
      ctx.lineWidth = 3.5;

      const segments = this.count * 3;
      const angleStep = (Math.PI * 2) / segments;
      for (let i = 0; i < segments; i++) {
        // 抖动裂痕
        const jitterR = this.radius + (Math.sin(this.shatterTimer * 40 + i) * 4);
        const startA = this.currentAngle + i * angleStep + 0.08;
        const endA = this.currentAngle + (i + 1) * angleStep - 0.08;
        ctx.beginPath();
        ctx.arc(this.enemy.x, this.enemy.y, jitterR, startA, endA);
        ctx.stroke();
      }

      // 2. 绘制向外扩散崩解的晶格破片
      for (const sh of this.shatterShards) {
        const sx = this.enemy.x + Math.cos(sh.angle) * sh.dist;
        const sy = this.enemy.y + Math.sin(sh.angle) * sh.dist;
        ctx.save();
        ctx.translate(sx, sy);
        ctx.rotate(sh.rot);
        ctx.fillStyle = `rgba(255, 234, 112, ${sh.alpha})`;
        ctx.strokeStyle = `rgba(255, 42, 109, ${sh.alpha})`;
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(-sh.size, -sh.size / 2);
        ctx.lineTo(sh.size, 0);
        ctx.lineTo(-sh.size / 2, sh.size);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        ctx.restore();
      }

      // 3. 过载核心能量脉冲光晕
      const pulseSize = this.radius * (0.8 + 0.25 * Math.sin(this.shatterTimer * 30));
      ctx.strokeStyle = `rgba(255, 170, 0, ${0.4 * (1 - shatterRatio)})`;
      ctx.lineWidth = 2;
      ctx.setLineDash([4, 6]);
      ctx.beginPath();
      ctx.arc(this.enemy.x, this.enemy.y, pulseSize, 0, Math.PI * 2);
      ctx.stroke();

      ctx.restore();
      return;
    }

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
    this.isShattering = false;
    this.shatterTimer = 0;
    this.justBroken = false;
    this.shatterShockwaves = [];
    this.shatterShards = [];
    this.rechargeTimer = 0;
    this.isRotating = false;
    this.firstHitRegistered = false;
    this.currentAngle = 0;
    this.sparks = [];
  }
}
