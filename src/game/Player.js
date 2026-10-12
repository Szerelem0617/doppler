import { Bullet } from './Bullet.js';
import { audio } from '../engine/Audio.js';

// 玩家战机 (集成反弹力场 J 与折跃闪现 K 战术技能)
export class Player {
  constructor(x, y, enemy) {
    this.x = x;
    this.y = y;
    this.enemy = enemy;

    this.vx = 0;
    this.vy = 0;
    this.speed = 220; // 战机推进速度 220px/s (限制普通移动最高达 7 频率，杜绝无技能达到 8 频率)
    this.angle = -Math.PI / 2;
    this.radius = 16; // 碰撞判定半径

    // 玩家生命值系统 (三滴血)
    this.maxHp = 3;
    this.hp = this.maxHp;
    this.isDead = false;

    // 受击短暂无敌时间 (1.2 秒无敌帧)
    this.invincibleTimer = 0;
    this.invincibleDuration = 1.2;
    this.hitSparks = []; // 受击火花

    // 基准发射周期 0.22s (固有射频 4.55 Hz，严格对应静止 6 弱点同步)
    this.fireInterval = 0.22;
    this.fireTimer = 0;

    this.bullets = [];
    this.wavefronts = []; // 多普勒波前扩散环
    this.thrusterParticles = []; // 尾喷粒子
    this.afterimages = []; // 闪现瞬移残影

    // 战机自动火控模式：全程常驻开启，固有射频 4.55 Hz (每 0.22s 一发自导激光)
    this.autoFire = true;

    // 强力击飞物理系统 (Boss 机械弹簧拳与移动冲撞等速击退)
    this.isKnockedBack = false;
    this.knockbackVx = 0;
    this.knockbackVy = 0;
    this.knockbackTimer = 0;
    this.knockbackDuration = 0.35;

    // 战术技能: 折跃闪现 (J 键触发，5.0s 充能周期，契合全阶段多波次折跃机动)
    this.blinkCooldown = 5.0;
    this.blinkCdTimer = 0;
    this.blinkDistance = 300;

    this.isInsideShield = false; // 是否显式通过折跃闪现进入了护盾内部 (严禁肉身挤盾穿透)
  }

  // 兼容别名属性
  get skill2CdTimer() { return this.blinkCdTimer; }
  set skill2CdTimer(v) { this.blinkCdTimer = v; }
  get skill2Cooldown() { return this.blinkCooldown; }

  setEnemy(enemy) {
    this.enemy = enemy;
  }

  // 受到伤害判定
  takeDamage(amount = 1) {
    if (this.isDead) return false;
    // 处于受击无敌时间内免疫伤害
    if (this.invincibleTimer > 0) return false;

    this.hp = Math.max(0, this.hp - amount);
    this.invincibleTimer = this.invincibleDuration;
    this.createHitSparks();

    if (this.hp <= 0) {
      this.isDead = true;
      audio.playGameOver();
    } else {
      audio.playPlayerHurt();
    }
    return true;
  }

  // 施加强力击飞位移 (支持阻尼衰减模式 DECAY 或 4 弱点破盾专用的匀速后滑模式 CONSTANT)
  applyKnockback(dirX, dirY, speed = 850, duration = 0.35, mode = 'DECAY') {
    let len = Math.hypot(dirX, dirY);
    if (len < 0.001) {
      dirX = 0;
      dirY = 1; // 默认向下击退
      len = 1;
    }
    this.knockbackVx = (dirX / len) * speed;
    this.knockbackVy = (dirY / len) * speed;
    this.knockbackDuration = duration;
    this.knockbackTimer = duration;
    this.knockbackMode = mode;
    this.isKnockedBack = true;
    this.isInsideShield = false; // 被弹簧拳击飞，重置内部状态
    this.createHitSparks();
  }

  // 回复生命值 (用于第二关阶段回复)
  heal(amount = 3) {
    this.hp = Math.min(this.maxHp, this.hp + amount);
    this.isDead = false;
  }

  createHitSparks() {
    for (let i = 0; i < 15; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 60 + Math.random() * 120;
      this.hitSparks.push({
        x: this.x,
        y: this.y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life: 0.3 + Math.random() * 0.2,
        color: '#ff2a6d'
      });
    }
  }

  update(dt, input, canvasWidth, canvasHeight, bossBullets = null) {
    // 技能冷却更新
    if (this.blinkCdTimer > 0) this.blinkCdTimer = Math.max(0, this.blinkCdTimer - dt);
    if (this.invincibleTimer > 0) this.invincibleTimer = Math.max(0, this.invincibleTimer - dt);

    // 受击火花粒子更新
    for (let i = this.hitSparks.length - 1; i >= 0; i--) {
      const p = this.hitSparks[i];
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.life -= dt;
      if (p.life <= 0) {
        this.hitSparks.splice(i, 1);
      }
    }

    // 强力击飞物理位移 (支持 CONSTANT 匀速击退与 DECAY 阻尼衰减)
    if (this.knockbackTimer > 0) {
      this.knockbackTimer -= dt;
      const factor = this.knockbackMode === 'CONSTANT' ? 1.0 : Math.max(0, this.knockbackTimer / this.knockbackDuration);
      this.x += this.knockbackVx * factor * dt;
      this.y += this.knockbackVy * factor * dt;
      if (Math.random() < 0.6) {
        this.createAfterimage('rgba(255, 0, 85, 0.7)');
      }
      // 触达显示边缘时立即终止击飞物理状态，恢复完全操控
      const pad = 36;
      if (
        (this.knockbackVx > 0 && this.x >= canvasWidth - pad) ||
        (this.knockbackVx < 0 && this.x <= pad) ||
        (this.knockbackVy > 0 && this.y >= canvasHeight - pad) ||
        (this.knockbackVy < 0 && this.y <= pad)
      ) {
        this.isKnockedBack = false;
        this.knockbackVx = 0;
        this.knockbackVy = 0;
        this.knockbackTimer = 0;
      } else if (this.knockbackTimer <= 0) {
        this.isKnockedBack = false;
        this.knockbackVx = 0;
        this.knockbackVy = 0;
      }
    }

    // 离散 8 向常规移动 (击飞高动量阶段仍允许微幅阻尼操控)
    const move = input.getMovementVector();
    this.vx = move.x * this.speed;
    this.vy = move.y * this.speed;

    // 战术技能: J 键触发折跃闪现 (直插护盾或战术位移)
    if (
      (input.consumeBlink && input.consumeBlink()) ||
      (input.consumeSkill1 && input.consumeSkill1()) ||
      (!input.consumeBlink && !input.consumeSkill1 && input.consumeSkill2 && input.consumeSkill2())
    ) {
      if (this.blinkCdTimer <= 0) {
        this.executeBlink(move, canvasWidth, canvasHeight);
      }
    }

    this.x += this.vx * dt;
    this.y += this.vy * dt;

    // 护盾物理阻挡机制：护盾未破损时，作为一个实体力场环严格阻挡玩家常规推进，严禁直接肉身怼盾穿透！
    if (this.enemy && this.enemy.shield && !this.enemy.shield.isBroken) {
      const shieldCenter = { x: this.enemy.x, y: this.enemy.y };
      const dx = this.x - shieldCenter.x;
      const dy = this.y - shieldCenter.y;
      const dist = Math.hypot(dx, dy);
      const minDistance = this.enemy.shield.radius + this.radius; // 护盾外壁 + 战机判定半径

      // 若战机已经在护盾内圈内部 (例如在破盾虚弱期走进圈内，或者通过折跃瞬移进入)
      if (dist < this.enemy.shield.radius) {
        this.isInsideShield = true;
      } else {
        this.isInsideShield = false;
      }

      // 未处于护盾内部的战机，从外侧推进时一律严格阻挡在外壁，绝不允许从外侧肉身怼盾穿透！
      if (!this.isInsideShield && dist < minDistance) {
        const d = dist || 1;
        this.x = shieldCenter.x + (dx / d) * minDistance;
        this.y = shieldCenter.y + (dy / d) * minDistance;
      }
    } else {
      // 护盾已破损消散时：战机完全自由移动，若已进入内圈则保持内部标记
      if (this.enemy && this.enemy.shield) {
        const dist = Math.hypot(this.x - this.enemy.x, this.y - this.enemy.y);
        this.isInsideShield = (dist < this.enemy.shield.radius);
      } else {
        this.isInsideShield = false;
      }
    }

    // 全局边界约束 (放开下半区死锁，允许闪现至全屏幕战区)
    const pad = 36;
    this.x = Math.max(pad, Math.min(canvasWidth - pad, this.x));
    this.y = Math.max(pad, Math.min(canvasHeight - pad, this.y));

    // 战机机头自动对准敌人
    if (this.enemy) {
      this.angle = Math.atan2(this.enemy.y - this.y, this.enemy.x - this.x);
    }

    // 尾喷粒子
    if (move.x !== 0 || move.y !== 0) {
      this.createThrusterParticle();
    }

    // 更新尾喷粒子
    for (let i = this.thrusterParticles.length - 1; i >= 0; i--) {
      const p = this.thrusterParticles[i];
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.life -= dt;
      if (p.life <= 0) {
        this.thrusterParticles.splice(i, 1);
      }
    }

    // 更新瞬移残影
    for (let i = this.afterimages.length - 1; i >= 0; i--) {
      const img = this.afterimages[i];
      img.alpha -= 2.2 * dt;
      if (img.alpha <= 0) {
        this.afterimages.splice(i, 1);
      }
    }

    // 更新多普勒波前
    for (let i = this.wavefronts.length - 1; i >= 0; i--) {
      const wf = this.wavefronts[i];
      wf.radius += wf.speed * dt;
      wf.alpha -= 0.6 * dt;
      if (wf.alpha <= 0) {
        this.wavefronts.splice(i, 1);
      }
    }

    // 射击控制系统：完全由 J 键开启自动射击控制，绝不提供空格键离散射击！
    const shouldShoot = this.autoFire;
    const currentInterval = this.fireInterval;

    if (shouldShoot) {
      this.fireTimer += dt;
      if (this.fireTimer >= currentInterval) {
        this.shoot();
        this.fireTimer = 0;
      }
    } else {
      // 停火观察时保留预热，重新开火瞬间几乎零延迟发射
      this.fireTimer = Math.min(this.fireTimer, currentInterval * 0.95);
    }

    // 更新自导子弹
    for (let i = this.bullets.length - 1; i >= 0; i--) {
      const b = this.bullets[i];
      b.update(dt);
      if (!b.alive) {
        this.bullets.splice(i, 1);
      }
    }
  }

  // 执行瞬移闪现
  executeBlink(move, canvasWidth, canvasHeight) {
    audio.playBlink();
    this.blinkCdTimer = this.blinkCooldown;

    // 记录起点残影
    this.createAfterimage();

    const startX = this.x;
    const startY = this.y;

    // 瞬移方向：优先移动方向，若静止且敌方有护盾则直接折跃至敌方护盾内侧 (诱骗弹簧拳借力破盾核心机制)
    let dirX = move.x;
    let dirY = move.y;
    if (dirX === 0 && dirY === 0) {
      if (this.enemy && this.enemy.shield && !this.enemy.shield.isBroken) {
        this.x = this.enemy.x;
        this.y = this.enemy.y + Math.max(24, this.enemy.shield.radius * 0.45);
        this.isInsideShield = true; // 瞬移进入护盾内部
        this.afterimages.push({
          x: (startX + this.x) / 2,
          y: (startY + this.y) / 2,
          angle: this.angle,
          alpha: 0.6,
          color: '#00f0ff'
        });
        return;
      }
      dirX = Math.cos(this.angle);
      dirY = Math.sin(this.angle);
    }

    this.x += dirX * this.blinkDistance;
    this.y += dirY * this.blinkDistance;

    // 全局边界约束 (允许闪现至全屏幕战区，包括护盾内部)
    const pad = 36;
    this.x = Math.max(pad, Math.min(canvasWidth - pad, this.x));
    this.y = Math.max(pad, Math.min(canvasHeight - pad, this.y));

    // 生成中途过渡残影
    this.afterimages.push({
      x: (startX + this.x) / 2,
      y: (startY + this.y) / 2,
      angle: this.angle,
      alpha: 0.6,
      color: '#00f0ff'
    });
  }

  createAfterimage(color = '#00f0ff') {
    this.afterimages.push({
      x: this.x,
      y: this.y,
      angle: this.angle,
      alpha: 0.8,
      color
    });
  }

  shoot() {
    if (!this.enemy) return;
    audio.playLaser();

    // 标准激光发射
    const bullet = new Bullet(this.x, this.y, this.enemy, 1100);
    this.bullets.push(bullet);

    if (typeof window !== 'undefined' && window.tas && window.tas.active) {
      const phase = this.enemy.currentPhaseIndex ?? 0;
      window.tas.recordBulletShot(phase);
    }

    this.wavefronts.push({
      x: this.x,
      y: this.y,
      radius: 8,
      speed: 600,
      alpha: 0.6
    });
  }

  createThrusterParticle() {
    const backAngle = this.angle + Math.PI + (Math.random() - 0.5) * 0.4;
    const speed = 40 + Math.random() * 60;
    this.thrusterParticles.push({
      x: this.x - Math.cos(this.angle) * 14,
      y: this.y - Math.sin(this.angle) * 14,
      vx: Math.cos(backAngle) * speed,
      vy: Math.sin(backAngle) * speed,
      life: 0.2 + Math.random() * 0.15,
      size: 2 + Math.random() * 2,
      color: 'rgba(0, 240, 255, 0.7)'
    });
  }

  render(ctx) {
    // 1. 渲染多普勒波前
    ctx.save();
    for (const wf of this.wavefronts) {
      ctx.strokeStyle = `rgba(0, 240, 255, ${wf.alpha * 0.4})`;
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.arc(wf.x, wf.y, wf.radius, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.restore();

    // 2. 渲染闪现与击飞残影
    for (const img of this.afterimages) {
      ctx.save();
      ctx.translate(img.x, img.y);
      ctx.rotate(img.angle);
      const c = img.color || '#00f0ff';
      ctx.strokeStyle = c.startsWith('#') ? `${c}${Math.floor(img.alpha * 255).toString(16).padStart(2, '0')}` : c;
      ctx.lineWidth = 1.5;
      this.drawShipOutline(ctx);
      ctx.restore();
    }

    // 3. 渲染尾喷发光粒子
    ctx.save();
    for (const p of this.thrusterParticles) {
      ctx.fillStyle = p.color || 'rgba(0, 240, 255, 0.7)';
      ctx.shadowColor = p.color || '#00f0ff';
      ctx.shadowBlur = 6;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();

    // 5. 渲染子弹
    for (const b of this.bullets) {
      b.render(ctx);
    }

    // 6. 渲染受击火花粒子
    for (const p of this.hitSparks) {
      ctx.fillStyle = p.color;
      ctx.shadowColor = p.color;
      ctx.shadowBlur = 8;
      ctx.beginPath();
      ctx.arc(p.x, p.y, 2, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.shadowBlur = 0;

    // 8. 渲染战机自身 (受击无敌期间高频闪烁保护)
    if (this.invincibleTimer > 0 && Math.floor(this.invincibleTimer * 16) % 2 === 0) {
      // 闪烁跳过一帧绘制以示无敌
      return;
    }

    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.rotate(this.angle);

    ctx.strokeStyle = '#00f0ff';
    ctx.lineWidth = 2;
    ctx.shadowColor = '#00f0ff';
    ctx.shadowBlur = 12;

    this.drawShipOutline(ctx);

    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(2, 0, 3, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  }

  drawShipOutline(ctx) {
    ctx.beginPath();
    ctx.moveTo(18, 0);
    ctx.lineTo(-14, -12);
    ctx.lineTo(-8, -4);
    ctx.lineTo(-12, 0);
    ctx.lineTo(-8, 4);
    ctx.lineTo(-14, 12);
    ctx.closePath();
    ctx.stroke();
  }

  reset(x, y) {
    this.x = x;
    this.y = y;
    this.vx = 0;
    this.vy = 0;
    this.hp = this.maxHp;
    this.isDead = false;
    this.invincibleTimer = 0;
    this.hitSparks = [];
    this.bullets = [];
    this.wavefronts = [];
    this.thrusterParticles = [];
    this.afterimages = [];
    this.blinkCdTimer = 0;
    this.isInsideShield = false;
    this.isKnockedBack = false;
    this.knockbackVx = 0;
    this.knockbackVy = 0;
    this.knockbackTimer = 0;
    this.autoFire = true;
    this.fireTimer = 0;
  }
}
