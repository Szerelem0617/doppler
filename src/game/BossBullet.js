import { audio } from '../engine/Audio.js';

// Boss 攻击弹幕（支持被反射力场反弹、精准玩家受击判定与销毁）
export class BossBullet {
  constructor(x, y, vx, vy, isHoming = false, targetPlayer = null) {
    this.x = x;
    this.y = y;
    this.vx = vx;
    this.vy = vy;
    this.speed = Math.hypot(vx, vy) || 280;
    this.radius = 5;
    this.alive = true;
    this.isReflected = false; // 是否已被反射反弹
    this.isHoming = false; // Boss子弹统一为普通直线子弹，取消追踪
    this.targetPlayer = targetPlayer;
    this.damage = 15;
    this.history = [];
  }

  update(dt, bossRef, playerRef) {
    if (!this.alive) return;

    this.history.push({ x: this.x, y: this.y });
    if (this.history.length > 4) {
      this.history.shift();
    }

    if (this.isReflected) {
      // 反射后：自导追踪飞向 Boss
      if (bossRef) {
        const dx = bossRef.x - this.x;
        const dy = bossRef.y - this.y;
        const dist = Math.hypot(dx, dy);
        if (dist > 1) {
          const reflectSpeed = 650;
          this.vx = (dx / dist) * reflectSpeed;
          this.vy = (dy / dist) * reflectSpeed;
        }
      }
    } else {
      // 未反射状态：作为普通直线子弹飞行，进行受击与护盾反射判定
      const player = playerRef || this.targetPlayer;
      if (player && !player.isDead) {
        const distToPlayer = Math.hypot(this.x - player.x, this.y - player.y);
        
        // 如果玩家开启了 J 键反射护盾，并在护盾范围 (34px) 内，执行反弹
        if (player.skill1Active && distToPlayer <= 36 + this.radius) {
          this.reflect();
          audio.playReflectClang();
          return;
        }

        // 碰触玩家机体核心 (16px)
        if (distToPlayer <= player.radius + this.radius) {
          this.alive = false; // 触碰瞬间立即销毁！
          player.takeDamage(1); // 扣血并触发无敌时间
          return;
        }
      }
    }

    this.x += this.vx * dt;
    this.y += this.vy * dt;

    // 屏幕外销毁
    if (this.x < -60 || this.x > window.innerWidth + 60 || this.y < -60 || this.y > window.innerHeight + 60) {
      this.alive = false;
    }
  }

  // 被玩家反弹
  reflect() {
    this.isReflected = true;
    this.isHoming = false;
  }

  render(ctx) {
    if (!this.alive) return;

    ctx.save();
    if (this.isReflected) {
      // 反弹后的青色高能弹
      ctx.shadowColor = '#00ffff';
      ctx.shadowBlur = 12;
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(this.x, this.y, this.radius + 1, 0, Math.PI * 2);
      ctx.fill();

      ctx.strokeStyle = '#00f0ff';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(this.x, this.y, this.radius + 3, 0, Math.PI * 2);
      ctx.stroke();
    } else {
      // 敌方危险猩红弹
      ctx.shadowColor = '#ff2a6d';
      ctx.shadowBlur = 10;
      ctx.fillStyle = '#ff7597';
      ctx.beginPath();
      ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
      ctx.fill();

      ctx.strokeStyle = '#ff2a6d';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(this.x, this.y, this.radius + 2, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.restore();
  }
}
