/**
 * VirtualJoystick.js - 移动端高响应度赛博虚拟摇杆
 * 支持：
 * 1. 独立 Touch Identifier 多点触控追踪（移动与折跃双拇指互不干扰）；
 * 2. 动量阻尼死区与平滑无级归一化输出；
 * 3. 触摸反馈、发光环与精准物理复位；
 * 4. 兼容 PC 触控/鼠标模拟测试。
 */

export class VirtualJoystick {
  constructor(zoneEl, baseEl, knobEl, options = {}) {
    this.zone = zoneEl;
    this.base = baseEl;
    this.knob = knobEl;

    this.maxRadius = options.maxRadius || 42;
    this.deadzone = options.deadzone || 6;
    this.onMove = options.onMove || (() => {});
    this.onStart = options.onStart || (() => {});
    this.onEnd = options.onEnd || (() => {});

    this.activeTouchId = null;
    this.isMouseDown = false;
    this.centerX = 0;
    this.centerY = 0;

    this.initEvents();
  }

  updateCenter() {
    if (!this.base) return;
    const rect = this.base.getBoundingClientRect();
    this.centerX = rect.left + rect.width / 2;
    this.centerY = rect.top + rect.height / 2;
  }

  initEvents() {
    if (!this.zone || !this.base || !this.knob) return;

    // === Touch 事件监听 ===
    this.zone.addEventListener('touchstart', (e) => {
      e.preventDefault();
      if (this.activeTouchId !== null) return;

      const touch = e.changedTouches[0];
      this.activeTouchId = touch.identifier;
      this.updateCenter();

      this.base.classList.add('active');
      this.knob.classList.add('active');

      if (this.onStart) this.onStart();
      this.processMovement(touch.clientX, touch.clientY);
    }, { passive: false });

    window.addEventListener('touchmove', (e) => {
      if (this.activeTouchId === null) return;

      for (let i = 0; i < e.changedTouches.length; i++) {
        const touch = e.changedTouches[i];
        if (touch.identifier === this.activeTouchId) {
          e.preventDefault();
          this.processMovement(touch.clientX, touch.clientY);
          break;
        }
      }
    }, { passive: false });

    const handleTouchEnd = (e) => {
      if (this.activeTouchId === null) return;

      for (let i = 0; i < e.changedTouches.length; i++) {
        const touch = e.changedTouches[i];
        if (touch.identifier === this.activeTouchId) {
          this.activeTouchId = null;
          this.resetKnob();
          if (this.onEnd) this.onEnd();
          break;
        }
      }
    };

    window.addEventListener('touchend', handleTouchEnd);
    window.addEventListener('touchcancel', handleTouchEnd);

    // === Mouse 事件兼容 (支持桌面端测试与鼠标点击拖拽) ===
    this.zone.addEventListener('mousedown', (e) => {
      if (e.button !== 0) return;
      this.isMouseDown = true;
      this.updateCenter();
      this.base.classList.add('active');
      this.knob.classList.add('active');
      if (this.onStart) this.onStart();
      this.processMovement(e.clientX, e.clientY);
    });

    window.addEventListener('mousemove', (e) => {
      if (!this.isMouseDown) return;
      this.processMovement(e.clientX, e.clientY);
    });

    window.addEventListener('mouseup', () => {
      if (!this.isMouseDown) return;
      this.isMouseDown = false;
      this.resetKnob();
      if (this.onEnd) this.onEnd();
    });
  }

  processMovement(clientX, clientY) {
    const dx = clientX - this.centerX;
    const dy = clientY - this.centerY;
    const dist = Math.hypot(dx, dy);
    const angle = Math.atan2(dy, dx);

    const clampDist = Math.min(dist, this.maxRadius);
    const knobX = Math.cos(angle) * clampDist;
    const knobY = Math.sin(angle) * clampDist;

    this.knob.style.transform = `translate(${knobX.toFixed(1)}px, ${knobY.toFixed(1)}px)`;

    if (dist < this.deadzone) {
      this.onMove({ x: 0, y: 0 });
    } else {
      const power = Math.min(1.0, (clampDist - this.deadzone) / (this.maxRadius - this.deadzone));
      this.onMove({
        x: Math.cos(angle) * power,
        y: Math.sin(angle) * power
      });
    }
  }

  resetKnob() {
    this.knob.style.transform = 'translate(0px, 0px)';
    this.base.classList.remove('active');
    this.knob.classList.remove('active');
    this.onMove({ x: 0, y: 0 });
  }

  destroy() {
    this.resetKnob();
    this.activeTouchId = null;
    this.isMouseDown = false;
  }
}
