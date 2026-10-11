// Boss 攻击弹幕（支持精准玩家受击判定与屏幕外边界销毁）
export class BossBullet {
  constructor(x, y, vx, vy, isHoming = false, targetPlayer = null) {
    this.x = x;
    this.y = y;
    this.vx = vx;
    this.vy = vy;
    this.speed = Math.hypot(vx, vy) || 280;
    this.radius = 5;
    this.alive = true;
    this.isHoming = false; // Boss子弹统一为普通直线子弹
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

    // 碰触玩家机体核心受击判定
    const player = playerRef || this.targetPlayer;
    if (player && !player.isDead) {
      const distToPlayer = Math.hypot(this.x - player.x, this.y - player.y);
      if (distToPlayer <= player.radius + this.radius) {
        this.alive = false; // 触碰瞬间立即销毁
        player.takeDamage(1); // 扣血并触发无敌时间
        return;
      }
    }

    this.x += this.vx * dt;
    this.y += this.vy * dt;

    // 虚拟 800x800 竞技场屏幕外销毁
    const boundW = 800;
    const boundH = 800;
    if (this.x < -60 || this.x > boundW + 60 || this.y < -60 || this.y > boundH + 60) {
      this.alive = false;
    }
  }

  render(ctx) {
    if (!this.alive) return;

    ctx.save();
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
    ctx.restore();
  }
}
