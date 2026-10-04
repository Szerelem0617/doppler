// 追踪自导光束子弹
export class Bullet {
  constructor(x, y, target, speed = 480) {
    this.x = x;
    this.y = y;
    this.speed = speed;
    this.target = target;
    this.alive = true;
    this.radius = 4;
    this.damage = 10;
    this.history = []; // 拖尾光效
  }

  update(dt) {
    if (!this.alive) return;

    // 记录拖尾
    this.history.push({ x: this.x, y: this.y });
    if (this.history.length > 5) {
      this.history.shift();
    }

    // 飞向敌人目标
    const tx = this.target.x;
    const ty = this.target.y;
    const dx = tx - this.x;
    const dy = ty - this.y;
    const dist = Math.hypot(dx, dy);

    if (dist < 1) {
      this.alive = false;
      return;
    }

    const vx = (dx / dist) * this.speed;
    const vy = (dy / dist) * this.speed;

    this.x += vx * dt;
    this.y += vy * dt;
  }

  render(ctx) {
    if (!this.alive) return;

    // 绘制发光拖尾
    if (this.history.length > 1) {
      ctx.beginPath();
      ctx.moveTo(this.history[0].x, this.history[0].y);
      for (let i = 1; i < this.history.length; i++) {
        ctx.lineTo(this.history[i].x, this.history[i].y);
      }
      ctx.strokeStyle = 'rgba(0, 240, 255, 0.4)';
      ctx.lineWidth = 3;
      ctx.stroke();
    }

    // 子弹高光核心
    ctx.save();
    ctx.shadowColor = '#00f0ff';
    ctx.shadowBlur = 10;
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = '#00f0ff';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.radius + 2, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }
}
