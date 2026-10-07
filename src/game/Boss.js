import { Shield } from './Shield.js';
import { BossBullet } from './BossBullet.js';
import { audio } from '../engine/Audio.js';

// 第二关 BOSS：动能泰坦 (完全确定性运算，彻底移除 Math.random，冲锋目标严格关联角色位置与战术规则)
export class Boss {
  constructor(x, y, config = {}) {
    this.startX = x;
    this.startY = y;
    this.x = x;
    this.y = y;
    this.radius = 34;
    this.isDead = false;

    // 多阶段护盾顺序与各阶血量支持 (如 2-boss: [7, 5, 8, 4, 9]，各阶血量 [7, 7, 8, 9, 11])
    this.phaseWeakpoints = config.phaseSequence || null;
    this.phaseHps = config.phaseHps || (this.phaseWeakpoints ? [7, 7, 8, 9, 11] : null);
    this.phaseMaxHps = this.phaseHps ? [...this.phaseHps] : null;
    this.currentPhaseIndex = 0;
    this.currentPhaseHp = this.phaseHps ? this.phaseHps[0] : (config.hp || 200);

    // 总血量为各阶段血量之和 (42)
    if (this.phaseHps) {
      this.maxHp = this.phaseHps.reduce((a, b) => a + b, 0);
      this.hp = this.maxHp;
    } else {
      this.maxHp = config.hp || 200;
      this.hp = this.maxHp;
    }

    this.initialWeakpoints = this.phaseWeakpoints ? this.phaseWeakpoints[0] : (config.weakpoints || 4);
    this.shield = new Shield(this, this.initialWeakpoints, 88, 0.30);
    this.shield.rechargeDuration = 1.45; // 破盾后暴露虚弱攻击时间窗口 (静止严格限额 6 血)

    // 弹幕配置
    this.enableBullets = config.enableBullets !== false;
    this.radialTimer = 0;
    this.radialInterval = 2.6;
    this.burstCount = 0; // 确定性散射节拍计数器

    this.snipeTimer = 0;
    this.snipeInterval = 1.8;

    this.bullets = [];
    this.afterimages = [];

    // 护盾内部入侵惩罚机制 (机械弹簧拳 Spring Punch)
    this.invadeTimer = 0;
    this.invadeThreshold = 0.35; // 入侵 0.35s 后触发弹簧拳
    this.springPunchActive = false;
    this.springPunchTimer = 0;
    this.springPunchDuration = 0.28;
    this.springPunchTarget = { x: x, y: y };
    this.springPunchStart = { x: x, y: y };

    // 视觉特效
    this.rotation = 0;
    this.hitFlashTimer = 0;
    this.deathExplosion = [];
  }

  configure(config = {}) {
    if (config.phaseSequence) {
      this.phaseWeakpoints = config.phaseSequence;
      this.phaseHps = config.phaseHps || [7, 7, 8, 9, 11];
      this.phaseMaxHps = [...this.phaseHps];
      this.maxHp = this.phaseHps.reduce((a, b) => a + b, 0);
      this.hp = this.maxHp;
      this.currentPhaseIndex = 0;
      this.currentPhaseHp = this.phaseHps[0];
      this.initialWeakpoints = this.phaseWeakpoints[0];
      this.shield.setConfiguration(this.initialWeakpoints, 1.45);
    } else {
      if (config.hp) {
        this.maxHp = config.hp;
        this.hp = this.maxHp;
      }
      if (config.weakpoints) {
        this.initialWeakpoints = config.weakpoints;
        this.shield.setConfiguration(config.weakpoints, 1.45);
      }
    }
    this.enableBullets = config.enableBullets !== false;
    this.reset();
  }

  update(dt, now, player, frequencyMeter) {
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

    this.rotation += 1.2 * dt;
    if (this.hitFlashTimer > 0) {
      this.hitFlashTimer -= dt;
    }

    for (let i = this.afterimages.length - 1; i >= 0; i--) {
      const img = this.afterimages[i];
      img.alpha -= 2.8 * dt;
      if (img.alpha <= 0) {
        this.afterimages.splice(i, 1);
      }
    }

    const wasBroken = this.shield.isBroken;
    this.shield.update(dt, player);

    // 护盾自然过载超时恢复：保持当前阶段的盾数！
    if (wasBroken && !this.shield.isBroken) {
      const currentShieldCount = this.phaseWeakpoints ? this.phaseWeakpoints[this.currentPhaseIndex] : this.initialWeakpoints;
      const rechargeDur = (this.currentPhaseIndex === 2) ? 1.85 : 1.45;
      this.shield.setConfiguration(currentShieldCount, rechargeDur);
    }

    // 更新敌方子弹 (同时进行玩家受击碰撞判定)
    for (let i = this.bullets.length - 1; i >= 0; i--) {
      if (this.isDead) break;
      const b = this.bullets[i];
      if (!b) continue;
      b.update(dt, this, player);

      if (b.isReflected && b.alive) {
        const dx = b.x - this.x;
        const dy = b.y - this.y;
        const dist = Math.hypot(dx, dy);

        // 如果护盾尚未击破，护盾力场阻挡格挡反弹子弹
        if (this.shield && !this.shield.isBroken) {
          if (dist <= this.shield.radius + 8) {
            b.alive = false;
            this.shield.createSparks(b.x, b.y, '#00ffff');
            audio.playShieldDeflect();
          }
        } else {
          // 护盾击破后：反弹子弹直接命中核心造成伤害！
          if (dist <= this.radius + 8) {
            b.alive = false;
            const dmg = (this.phaseHps) ? 1 : b.damage;
            this.takeDamage(dmg, frequencyMeter, now);
            if (this.isDead) break;
          }
        }
      }

      if (!b.alive) {
        this.bullets.splice(i, 1);
      }
    }

    // 弹簧拳动画与位移更新
    if (this.springPunchActive) {
      this.springPunchTimer += dt;
      if (this.springPunchTimer >= this.springPunchDuration) {
        this.springPunchActive = false;
        this.springPunchTimer = 0;
      }
    }

    // 护盾内部入侵判定：若护盾未破且未处于碎裂顿挫中，玩家闪现或移动进入护盾内部，0.35s 后触发机械弹簧拳重击与击飞
    if (this.shield && !this.shield.isBroken && !this.shield.isShattering && player && !player.isDead) {
      const distToPlayer = Math.hypot(player.x - this.x, player.y - this.y);
      if (distToPlayer <= this.shield.radius) {
        this.invadeTimer += dt;
        if (this.invadeTimer >= this.invadeThreshold && !this.springPunchActive) {
          // 触发机械弹簧拳攻击！
          this.invadeTimer = 0;
          this.springPunchActive = true;
          this.springPunchTimer = 0;
          this.springPunchStart = { x: this.x, y: this.y };
          this.springPunchTarget = { x: player.x, y: player.y };

          audio.playSpringPunch();
          player.takeDamage(1);

          // 4 弱点专属机制：以严格恒定的 550px/s 速度匀速滑退 1.05s，确保连续 4 发子弹多普勒到达周期严格锁定为 0.33s (90度)！
          const dx = player.x - this.x;
          const dy = player.y - this.y;
          const currentWp = (this.shield && !this.shield.isBroken) ? this.shield.count : this.initialWeakpoints;
          if (currentWp === 4) {
            player.applyKnockback(dx, dy, 550, 1.05, 'CONSTANT');
          } else {
            player.applyKnockback(dx, dy, 850, 0.35, 'DECAY');
          }
        }
      } else {
        // 离开护盾内部，平滑衰减入侵计时
        this.invadeTimer = Math.max(0, this.invadeTimer - dt * 2.5);
      }
    } else {
      this.invadeTimer = 0;
    }

    // 确定性弹幕发射 (破盾期间攻击能力不受任何影响)
    if (this.enableBullets) {
      // 攻击节拍支持各阶段深度调谐：第二阶段 (8 弱点纯走位大考) 与第五阶段 (9 弱点终局大狂暴) 专用攻击节奏
      const curRadialInterval = (this.currentPhaseIndex === 4) ? 0.12 : (this.currentPhaseIndex === 2) ? 4.8 : this.radialInterval;
      const curSnipeInterval = (this.currentPhaseIndex === 4) ? 0.25 : (this.currentPhaseIndex === 2) ? 4.8 : (this.currentPhaseIndex === 1) ? 2.5 : this.snipeInterval;

      this.radialTimer += dt;
      if (this.radialTimer >= curRadialInterval) {
        this.fireRadialBurst();
        this.radialTimer = 0;
      }

      this.snipeTimer += dt;
      if (this.snipeTimer >= curSnipeInterval) {
        this.fireSnipeLance(player);
        this.snipeTimer = 0;
      }
    }
  }

  // 第五阶段护盾生成时向玩家发射密集弹幕雨
  firePhase5SpawnBarrage() {
    audio.playBossShoot();
    const count = 18;
    const speed = 260;
    // 覆盖整个下半球战区 (从 15° 到 165°)
    for (let i = 0; i < count; i++) {
      const angle = (Math.PI * 0.1) + (i / (count - 1)) * (Math.PI * 0.8);
      const spawnX = this.x + Math.cos(angle) * (this.shield.radius + 8);
      const spawnY = this.y + Math.sin(angle) * (this.shield.radius + 8);
      const vx = Math.cos(angle) * speed;
      const vy = Math.sin(angle) * speed;
      this.bullets.push(new BossBullet(spawnX, spawnY, vx, vy));
    }
  }

  // 确定性环形散射：使用固定自增相位节拍，绝无随机偏移
  fireRadialBurst() {
    audio.playBossShoot();
    const count = 10;
    // 每次发射以固定 36° (π/5) 顺时针步进微旋，完全确定可复现
    const baseAngle = (this.burstCount * (Math.PI / 5)) % (Math.PI * 2);
    this.burstCount++;
    const speed = 230;

    for (let i = 0; i < count; i++) {
      const angle = baseAngle + (i * Math.PI * 2) / count;
      const vx = Math.cos(angle) * speed;
      const vy = Math.sin(angle) * speed;
      this.bullets.push(new BossBullet(this.x, this.y, vx, vy));
    }
  }

  // 确定性狙击光束：严格锁定玩家几何中心，三发扇形（±0.32 rad 及正中 0 rad），正中子弹强制要求玩家移动规避
  fireSnipeLance(player) {
    if (!player) return;
    audio.playBossShoot();

    const dx = player.x - this.x;
    const dy = player.y - this.y;
    const angle = Math.atan2(dy, dx);
    const speed = 360;

    // 阶段 1 专属双发收敛狙击：偏角紧致在 [-0.06, 0.06]，使玩家在后退开反弹盾时能同时反弹 2 枚子弹直击 Boss 核心
    const offsets = (this.currentPhaseIndex === 1) ? [-0.06, 0.06] : [-0.32, 0, 0.32];

    offsets.forEach(offset => {
      const a = angle + offset;
      const vx = Math.cos(a) * speed;
      const vy = Math.sin(a) * speed;
      this.bullets.push(new BossBullet(this.x, this.y, vx, vy));
    });
  }

  takeDamage(amount, frequencyMeter, now) {
    if (this.isDead) return;

    if (this.phaseHps) {
      this.currentPhaseHp = Math.max(0, this.currentPhaseHp - amount);
      this.hp = Math.max(0, this.hp - amount);
    } else {
      this.hp = Math.max(0, this.hp - amount);
    }

    this.hitFlashTimer = 0.08;

    if (frequencyMeter) {
      frequencyMeter.recordHit(now);
      audio.playTargetHit(frequencyMeter.getFrequency());
    }

    if (this.phaseHps) {
      // 检查当前阶段血量是否已打空
      if (this.currentPhaseHp <= 0) {
        const hasNext = this.advancePhase();
        if (!hasNext) {
          this.die();
        }
      }
    } else {
      if (this.hp <= 0) {
        this.die();
      }
    }
  }

  die() {
    this.isDead = true;
    audio.playVictoryExplosion();
    this.bullets = [];

    // 确定性对称爆破粒子
    for (let i = 0; i < 72; i++) {
      const angle = (i * Math.PI * 2) / 72;
      const speed = 80 + (i % 6) * 45;
      this.deathExplosion.push({
        x: this.x,
        y: this.y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life: 0.8 + (i % 4) * 0.2,
        color: i % 2 === 0 ? '#ff2a6d' : '#ffaa00',
        size: 3 + (i % 3) * 2
      });
    }
  }

  render(ctx) {
    // 护盾内部入侵红色警示圈
    if (this.invadeTimer > 0 && !this.shield.isBroken && !this.shield.isShattering) {
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

    // 机械弹簧拳出击特效
    if (this.springPunchActive) {
      this.renderSpringPunch(ctx);
    }

    for (const img of this.afterimages) {
      ctx.save();
      ctx.translate(img.x, img.y);
      ctx.rotate(img.rotation);
      ctx.strokeStyle = `rgba(255, 0, 85, ${img.alpha * 0.4})`;
      ctx.lineWidth = 2;
      this.drawPolygon(ctx, 0, 0, this.radius, 8);
      ctx.restore();
    }

    this.shield.render(ctx);

    for (const b of this.bullets) {
      b.render(ctx);
    }

    if (this.isDead) {
      for (const p of this.deathExplosion) {
        ctx.fillStyle = p.color;
        ctx.shadowColor = p.color;
        ctx.shadowBlur = 12;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.shadowBlur = 0;
      return;
    }

    // 渲染 Boss 本身：外层机甲多边形 + 5边形内框 (各边代表一阶段，受击点亮) + 核心数字血量
    ctx.save();
    ctx.translate(this.x, this.y);

    const isFlashing = this.hitFlashTimer > 0;

    // 1. 外层机械装甲轮廓 (随本体自旋)
    ctx.save();
    ctx.rotate(this.rotation);
    ctx.strokeStyle = isFlashing ? '#ffffff' : '#ff0055';
    ctx.lineWidth = 3;
    ctx.shadowColor = isFlashing ? '#ffffff' : '#ff0055';
    ctx.shadowBlur = 16;
    this.drawPolygon(ctx, 0, 0, this.radius, 8);

    // 外装甲辅助角刃
    ctx.rotate(-this.rotation * 2.0);
    ctx.strokeStyle = 'rgba(255, 0, 85, 0.4)';
    ctx.lineWidth = 1.5;
    this.drawPolygon(ctx, 0, 0, this.radius * 0.85, 4);
    ctx.restore();

    // 2. 五边形内框设计 (5边形，每条边代表一阶段，替代传统血条，保持稳定朝向)
    // 顶点数量由阶段数决定 (默认 5 阶段正五边形)，从正上方 12 点钟方向 (-PI/2) 顺时针排列
    const polySides = this.phaseWeakpoints ? this.phaseWeakpoints.length : 5;
    const polyRadius = 26;
    const vertices = [];
    for (let i = 0; i < polySides; i++) {
      const angle = -Math.PI / 2 + i * ((Math.PI * 2) / polySides);
      vertices.push({
        x: polyRadius * Math.cos(angle),
        y: polyRadius * Math.sin(angle)
      });
    }

    if (this.phaseHps && this.phaseMaxHps) {
      // 遍历各个阶段对应边
      for (let i = 0; i < polySides; i++) {
        const v1 = vertices[i];
        const v2 = vertices[(i + 1) % polySides];

        // 底色暗槽
        ctx.beginPath();
        ctx.moveTo(v1.x, v1.y);
        ctx.lineTo(v2.x, v2.y);
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.12)';
        ctx.lineWidth = 3;
        ctx.stroke();

        if (i < this.currentPhaseIndex) {
          // 已击破阶段：整条边完全高亮亮起！
          ctx.beginPath();
          ctx.moveTo(v1.x, v1.y);
          ctx.lineTo(v2.x, v2.y);
          ctx.strokeStyle = '#00f0ff';
          ctx.lineWidth = 3.5;
          ctx.shadowColor = '#00f0ff';
          ctx.shadowBlur = 10;
          ctx.stroke();
        } else if (i === this.currentPhaseIndex) {
          // 当前进行中阶段：受击时对应的边部分亮起，比例 = 已受伤害 / 当前阶段总血量
          const maxHp = this.phaseMaxHps[i];
          const curHp = this.currentPhaseHp;
          const damageRatio = Math.max(0, Math.min(1, (maxHp - curHp) / maxHp));

          if (damageRatio > 0) {
            const litX = v1.x + (v2.x - v1.x) * damageRatio;
            const litY = v1.y + (v2.y - v1.y) * damageRatio;

            ctx.beginPath();
            ctx.moveTo(v1.x, v1.y);
            ctx.lineTo(litX, litY);
            ctx.strokeStyle = isFlashing ? '#ffffff' : (this.shield.isBroken ? '#ff0055' : '#ffea00');
            ctx.lineWidth = 4;
            ctx.shadowColor = ctx.strokeStyle;
            ctx.shadowBlur = isFlashing ? 20 : 14;
            ctx.stroke();

            // 进度前沿高亮粒子
            ctx.fillStyle = '#ffffff';
            ctx.beginPath();
            ctx.arc(litX, litY, 2.5, 0, Math.PI * 2);
            ctx.fill();
          }

          // 破盾虚弱受创状态下：未点亮部分脉冲呼吸闪烁
          if (this.shield.isBroken) {
            const pulseAlpha = 0.3 + 0.3 * Math.sin(Date.now() * 0.008);
            ctx.beginPath();
            ctx.moveTo(v1.x, v1.y);
            ctx.lineTo(v2.x, v2.y);
            ctx.strokeStyle = `rgba(255, 0, 85, ${pulseAlpha})`;
            ctx.lineWidth = 2;
            ctx.stroke();
          }
        }
      }
    } else {
      // 普通非阶段 Boss 的内框五边形描边
      ctx.strokeStyle = isFlashing ? '#ffffff' : 'rgba(255, 0, 85, 0.4)';
      ctx.lineWidth = 2.5;
      this.drawPolygon(ctx, 0, 0, polyRadius, polySides);
    }

    // 3. 核心内部数字血量显示 (boss内部显示本阶段的剩余血量)
    ctx.fillStyle = 'rgba(10, 15, 28, 0.88)';
    ctx.beginPath();
    ctx.arc(0, 0, 16, 0, Math.PI * 2);
    ctx.fill();

    ctx.font = 'bold 13px "Courier New", monospace, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = isFlashing ? '#ffffff' : (this.shield.isBroken ? '#ff2a6d' : '#ffffff');
    ctx.shadowColor = ctx.fillStyle;
    ctx.shadowBlur = 10;
    const displayHp = (this.phaseHps && this.currentPhaseHp !== undefined) ? this.currentPhaseHp : this.hp;
    ctx.fillText(Math.max(0, Math.round(displayHp)), 0, 0);

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

  // 绘制机械弹簧拳出击动画
  renderSpringPunch(ctx) {
    const progress = Math.min(1, this.springPunchTimer / this.springPunchDuration);
    // 前 35% 极速向前出拳，后 65% 回缩
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

    // 1. 绘制伸缩机械弹簧 (折线波纹)
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

    // 2. 绘制机械重拳拳套
    ctx.translate(punchDist, 0);
    ctx.fillStyle = '#ff2a6d';
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2.5;
    ctx.shadowColor = '#ff2a6d';
    ctx.shadowBlur = 18;

    // 拳套底座
    ctx.fillRect(-10, -16, 20, 32);
    ctx.strokeRect(-10, -16, 20, 32);

    // 拳头指节圆弧
    ctx.fillStyle = '#ffea00';
    ctx.beginPath();
    ctx.arc(10, -9, 8, 0, Math.PI * 2);
    ctx.arc(12, 0, 9, 0, Math.PI * 2);
    ctx.arc(10, 9, 8, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // 冲击波爆发能量环
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

  // 转阶段：打完当前轮次血量后，立刻恢复下一阶段护盾
  advancePhase() {
    if (!this.phaseWeakpoints) return false;

    this.currentPhaseIndex++;
    if (this.currentPhaseIndex < this.phaseWeakpoints.length) {
      const nextShieldCount = this.phaseWeakpoints[this.currentPhaseIndex];
      this.currentPhaseHp = this.phaseHps[this.currentPhaseIndex];
      const rechargeDur = (this.currentPhaseIndex === 2) ? 1.85 : 1.45;
      // 立刻恢复下一个阶段盾！
      this.shield.setConfiguration(nextShieldCount, rechargeDur);
      this.shield.isBroken = false;
      audio.playShieldBreak(); // 转阶音效

      // 转阶时清零发射计时器，给予平滑预警窗口 (阶段 1 预热 1.95s，确保在 0.55s 准时发射双发收敛狙击)
      this.radialTimer = 0;
      this.snipeTimer = (this.currentPhaseIndex === 1) ? 1.95 : 0;

      // 第五阶段 (9 弱点)：护盾生成时向玩家发射密集散弹雨
      if (this.currentPhaseIndex === 4 && this.enableBullets) {
        this.firePhase5SpawnBarrage();
      }

      return true; // 成功切入下一阶段
    } else {
      // 五个阶段已全部击破！
      return false; // 触发 Boss 终极阵亡
    }
  }

  reset() {
    this.x = this.startX;
    this.y = this.startY;
    this.currentPhaseIndex = 0;
    if (this.phaseHps) {
      this.currentPhaseHp = this.phaseHps[0];
      this.hp = this.maxHp;
    } else {
      this.hp = this.maxHp;
    }
    this.isDead = false;
    this.initialWeakpoints = this.phaseWeakpoints ? this.phaseWeakpoints[0] : (this.initialWeakpoints || 4);
    this.shield.setConfiguration(this.initialWeakpoints, 1.45);
    this.radialTimer = 0;
    this.burstCount = 0;
    this.snipeTimer = 0;
    this.invadeTimer = 0;
    this.springPunchActive = false;
    this.springPunchTimer = 0;
    this.bullets = [];
    this.afterimages = [];
    this.deathExplosion = [];
  }
}
