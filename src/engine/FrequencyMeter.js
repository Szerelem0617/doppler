// 敌人受击频率监测器与示波器
export class FrequencyMeter {
  constructor(canvasWaveform, baseFrequency = 2.0) {
    this.canvas = canvasWaveform;
    this.ctx = canvasWaveform.getContext('2d');
    this.baseFreq = baseFrequency;
    this.hitTimestamps = [];
    this.currentFreq = 0.0;
    this.waveformBuffer = new Array(50).fill(0); // 示波器脉冲历史
    this.lastHitTime = 0;
  }

  // 记录一次受击
  recordHit(timestamp) {
    this.hitTimestamps.push(timestamp);
    if (this.lastHitTime > 0) {
      const dt = (timestamp - this.lastHitTime) / 1000;
      if (dt > 0.05 && dt < 2.0) {
        // 瞬时频率
        const instantFreq = 1.0 / dt;
        // 缓动平滑
        this.currentFreq = this.currentFreq === 0 ? instantFreq : (this.currentFreq * 0.4 + instantFreq * 0.6);
      }
    } else {
      this.currentFreq = this.baseFreq;
    }
    this.lastHitTime = timestamp;

    // 示波器添加一个脉冲峰值
    this.waveformBuffer.push(1.0);
    if (this.waveformBuffer.length > 50) {
      this.waveformBuffer.shift();
    }
  }

  update(now) {
    // 超过 1.2 秒没有受击，频率逐步衰减归零
    if (now - this.lastHitTime > 1200) {
      this.currentFreq = Math.max(0, this.currentFreq - 0.05);
    }

    // 清理较早的历史记录
    this.hitTimestamps = this.hitTimestamps.filter(t => now - t < 3000);

    // 平滑示波器历史
    this.waveformBuffer.push(0.0);
    if (this.waveformBuffer.length > 50) {
      this.waveformBuffer.shift();
    }

    this.renderWaveform();
  }

  getFrequency() {
    return this.currentFreq;
  }

  getMultiplier() {
    if (this.currentFreq <= 0.1) return 1.0;
    return this.currentFreq / this.baseFreq;
  }

  renderWaveform() {
    const w = this.canvas.width;
    const h = this.canvas.height;
    const ctx = this.ctx;

    ctx.clearRect(0, 0, w, h);

    // 网格参考线
    ctx.strokeStyle = 'rgba(0, 240, 255, 0.1)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, h / 2);
    ctx.lineTo(w, h / 2);
    ctx.stroke();

    // 绘制脉冲柱
    const count = this.waveformBuffer.length;
    const step = w / count;

    ctx.beginPath();
    let waveColor = '#00f0ff';
    let glowColor = 'rgba(0, 240, 255, 0.6)';

    if (this.currentFreq > 4.8) {
      waveColor = '#39ff14'; // 极高频压缩亮绿提示
      glowColor = 'rgba(57, 255, 20, 0.8)';
    } else if (this.currentFreq > 3.0) {
      waveColor = '#00ffff';
      glowColor = 'rgba(0, 255, 255, 0.8)';
    }

    ctx.strokeStyle = waveColor;
    ctx.lineWidth = 2;
    ctx.shadowBlur = 10;
    ctx.shadowColor = glowColor;

    for (let i = 0; i < count; i++) {
      const val = this.waveformBuffer[i];
      const x = i * step;
      const y = h / 2 - val * (h / 2 - 4);
      if (i === 0) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }
    }
    ctx.stroke();
    ctx.shadowBlur = 0;
  }

  reset() {
    this.hitTimestamps = [];
    this.currentFreq = 0.0;
    this.lastHitTime = 0;
    this.waveformBuffer.fill(0);
  }
}
