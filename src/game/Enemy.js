import { audio } from '../engine/Audio.js';
import { Shield } from './Shield.js';

// 敌人核心（第一关守卫者）
export class Enemy {
  constructor(x, y) {
    this.x = x;
    this.y = y;
    // 数值校准：基准周期 0.30s，破盾虚弱 2.4s
    // 静止射击：2.4s 内打 6 发 = 60 点伤害，剩余 10 点血，护盾强制恢复，保证教学意义；
    // 推进射击：多普勒压缩间隔至 0.18s，打 8~10 发 = 80~100 点伤害，即便走到底停住也能稳稳一轮击杀！
    this.maxHp = 70;
    this.hp = this.maxHp;
    this.radius = 28;
    this.isDead = false;

    // 旋转护盾 (统一采用 6 弱点静止同步基准，破盾暴露 2.0s)
    this.shield = new Shield(this, 6, 78, 0.22);
    this.shield.rechargeDuration = 2.0;

    // 视觉动画参数
    this.rotation = 0;
    this.hitFlashTimer = 0;
    this.deathExplosion = [];

    // 护盾内部入侵弹簧拳机制
    this.invadeTimer = 0;
    this.invadeThreshold = 0.35;
    this.springPunchActive = false;
    this.springPunchTimer = 0;
    this.springPunchDuration = 0.28;
    this.springPunchStart = { x: x, y: y };
    this.springPunchTarget = { x: x, y: y };
  }

  update(dt, now, player, frequencyMeter) {
    // 更新护盾 (支持未受击前雷达锁定玩家方向)
    this.shield.update(dt, player);

    if (this.springPunchActive) {
      this.springPunchTimer += dt;
      if (this.springPunchTimer >= this.springPunchDuration) {
        this.springPunchActive = false;
        this.springPunchTimer = 0;
      }
    }

    // 护盾内部入侵判定：若护盾未破，且玩家进入护盾内部，触发弹簧拳轰飞
    if (this.shield && !this.shield.isBroken && player && !player.isDead) {
      const distToPlayer = Math.hypot(player.x - this.x, player.y - this.y);
      if (distToPlayer <= this.shield.radius) {
        this.invadeTimer += dt;
        if (this.invadeTimer >= this.invadeThreshold && !this.springPunchActive) {
          this.invadeTimer = 0;
          this.springPunchActive = true;
          this.springPunchTimer = 0;
          this.springPunchStart = { x: this.x, y: this.y };
          this.springPunchTarget = { x: player.x, y: player.y };

          audio.playSpringPunch();
          player.takeDamage(1);
          const dx = player.x - this.x;
          const dy = player.y - this.y;
          player.applyKnockback(dx, dy, 850, 0.35);
        }
      } else {
        this.invadeTimer = Math.max(0, this.invadeTimer - dt * 2.5);
      }
    } else {
      this.invadeTimer = 0;
    }

    if (this.isDead) {
      for (let i = this.deathExplosion.length - 1; i >= 0; i--) {
        const p = this.deathExplosion[i];
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.life -= dt;
        if (p.life <= 0) {
          this.deathExplosion.splice(i, 1);
        }
      }
      return;
    }

    // 自身核心缓慢旋转
    this.rotation += 0.8 * dt;

    if (this.hitFlashTimer > 0) {
      this.hitFlashTimer -= dt;
    }
  }

  // 承受本体伤害
  takeDamage(amount, frequencyMeter, now) {
    if (this.isDead) return;

    this.hp = Math.max(0, this.hp - amount);
    this.hitFlashTimer = 0.08;

    // 记录多普勒受击频率
    frequencyMeter.recordHit(now);
    const currentFreq = frequencyMeter.getFrequency();

    // 动态变频受击音效
    audio.playTargetHit(currentFreq);

    if (this.hp <= 0) {
      this.die();
    }
  }

  die() {
    this.isDead = true;
    audio.playVictoryExplosion();

    // 终极爆炸粒子
    for (let i = 0; i < 60; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 80 + Math.random() * 260;
      this.deathExplosion.push({
        x: this.x,
        y: this.y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life: 0.8 + Math.random() * 0.6,
        color: Math.random() > 0.4 ? '#00f0ff' : '#ff2a6d',
        size: 2 + Math.random() * 4
      });
    }
  }

  render(ctx) {
    // 渲染侵入红色预警圈
    if (this.invadeTimer > 0 && !this.shield.isBroken) {
      const alpha = Math.min(1, this.invadeTimer / this.invadeThreshold);
      ctx.save();
      ctx.strokeStyle = `rgba(255, 42, 109, ${0.4 + 0.6 * alpha})`;
      ctx.lineWidth = 2.5;
      ctx.setLineDash([6, 6]);
      ctx.shadowColor = '#ff2a6d';
      ctx.shadowBlur = 12;
      ctx.beginPath();
      ctx.arc(this.x, this.y, this.shield.radius, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }

    // 机械弹簧拳动画
    if (this.springPunchActive) {
      this.renderSpringPunch(ctx);
    }

    // 渲染护盾
    this.shield.render(ctx);

    if (this.isDead) {
      // 爆炸残骸粒子
      for (const p of this.deathExplosion) {
        ctx.fillStyle = p.color;
        ctx.shadowColor = p.color;
        ctx.shadowBlur = 10;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.shadowBlur = 0;
      return;
    }

    // 渲染第一关圆形血条与内部血量
    const healthRadius = 33;
    const hpRatio = Math.max(0, this.hp / this.maxHp);
    const isFlashing = this.hitFlashTimer > 0;

    ctx.save();
    ctx.translate(this.x, this.y);

    // 1. 底槽环 (深色轨道)
    ctx.beginPath();
    ctx.arc(0, 0, healthRadius, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.12)';
    ctx.lineWidth = 3;
    ctx.stroke();

    // 2. 动态弧形血条 (从 12 点钟方向顺时针展开)
    if (hpRatio > 0) {
      const startAngle = -Math.PI / 2;
      const endAngle = startAngle + hpRatio * Math.PI * 2;
      ctx.beginPath();
      ctx.arc(0, 0, healthRadius, startAngle, endAngle);
      ctx.strokeStyle = isFlashing ? '#ffffff' : (this.shield.isBroken ? '#00f0ff' : '#ff2a6d');
      ctx.lineWidth = 4;
      ctx.shadowColor = ctx.strokeStyle;
      ctx.shadowBlur = isFlashing ? 18 : 12;
      ctx.stroke();

      // 血条端点高亮粒子珠
      const beadX = Math.cos(endAngle) * healthRadius;
      const beadY = Math.sin(endAngle) * healthRadius;
      ctx.fillStyle = '#ffffff';
      ctx.shadowBlur = 8;
      ctx.beginPath();
      ctx.arc(beadX, beadY, 2.5, 0, Math.PI * 2);
      ctx.fill();
    }

    // 3. 核心几何多边形 (随时间旋转)
    ctx.save();
    ctx.rotate(this.rotation);
    ctx.strokeStyle = isFlashing ? '#ffffff' : '#ff2a6d';
    ctx.lineWidth = 2;
    ctx.shadowColor = isFlashing ? '#ffffff' : '#ff2a6d';
    ctx.shadowBlur = isFlashing ? 16 : 8;
    this.drawPolygon(ctx, 0, 0, this.radius, 6);

    ctx.rotate(-this.rotation * 2.2);
    ctx.fillStyle = isFlashing ? '#ffffff' : 'rgba(255, 42, 109, 0.25)';
    this.drawPolygon(ctx, 0, 0, this.radius * 0.5, 3, true);
    ctx.restore();

    // 4. 核心内部数字血量显示 (保持正向不随多边形旋转，清晰易读)
    ctx.fillStyle = 'rgba(10, 15, 28, 0.82)';
    ctx.beginPath();
    ctx.arc(0, 0, 14, 0, Math.PI * 2);
    ctx.fill();

    ctx.font = 'bold 12px "Courier New", monospace, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = isFlashing ? '#ffffff' : '#00f0ff';
    ctx.shadowColor = ctx.fillStyle;
    ctx.shadowBlur = 8;
    ctx.fillText(Math.max(0, Math.round(this.hp)), 0, 0);

    ctx.restore();
  }

  drawPolygon(ctx, x, y, radius, sides, fill = false) {
    ctx.beginPath();
    for (let i = 0; i < sides; i++) {
      const angle = (i * 2 * Math.PI) / sides;
      const px = x + radius * Math.cos(angle);
      const py = y + radius * Math.sin(angle);
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.closePath();
    if (fill) ctx.fill();
    ctx.stroke();
  }

  renderSpringPunch(ctx) {
    const progress = Math.min(1, this.springPunchTimer / this.springPunchDuration);
    let reach;
    if (progress < 0.35) {
      reach = progress / 0.35;
    } else {
      reach = 1 - (progress - 0.35) / 0.65;
    }

    const sx = this.springPunchStart.x;
    const sy = this.springPunchStart.y;
    const tx = this.springPunchTarget.x;
    const ty = this.springPunchTarget.y;

    const dx = tx - sx;
    const dy = ty - sy;
    const totalDist = Math.hypot(dx, dy);
    const angle = Math.atan2(dy, dx);
    const punchDist = Math.max(30, totalDist * reach);

    ctx.save();
    ctx.translate(sx, sy);
    ctx.rotate(angle);

    ctx.strokeStyle = '#ffea00';
    ctx.lineWidth = 3.5;
    ctx.shadowColor = '#ffea00';
    ctx.shadowBlur = 12;

    const coils = 6;
    const step = punchDist / (coils * 2);
    ctx.beginPath();
    ctx.moveTo(0, 0);
    for (let i = 0; i < coils * 2; i++) {
      const x = i * step;
      const y = (i % 2 === 0 ? 1 : -1) * 14 * Math.min(1, punchDist / 50);
      ctx.lineTo(x, y);
    }
    ctx.lineTo(punchDist, 0);
    ctx.stroke();

    ctx.translate(punchDist, 0);
    ctx.fillStyle = '#ff2a6d';
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2.5;
    ctx.shadowColor = '#ff2a6d';
    ctx.shadowBlur = 18;

    ctx.fillRect(-10, -16, 20, 32);
    ctx.strokeRect(-10, -16, 20, 32);

    ctx.fillStyle = '#ffea00';
    ctx.beginPath();
    ctx.arc(10, -9, 8, 0, Math.PI * 2);
    ctx.arc(12, 0, 9, 0, Math.PI * 2);
    ctx.arc(10, 9, 8, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    if (progress > 0.25 && progress < 0.65) {
      const ringAlpha = 1 - (progress - 0.25) / 0.4;
      const ringR = (progress - 0.25) * 140;
      ctx.strokeStyle = `rgba(255, 234, 0, ${ringAlpha})`;
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.arc(0, 0, ringR, 0, Math.PI * 2);
      ctx.stroke();
    }

    ctx.restore();
  }

  reset() {
    this.hp = this.maxHp;
    this.isDead = false;
    this.hitFlashTimer = 0;
    this.invadeTimer = 0;
    this.springPunchActive = false;
    this.springPunchTimer = 0;
    this.deathExplosion = [];
    this.shield.restore();
  }
}
