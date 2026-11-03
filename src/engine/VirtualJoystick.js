/**
 * VirtualJoystick.js - 移动端高响应度赛博跟手虚拟摇杆 (Dynamic Follow Virtual Joystick)
 * 特性：
 * 1. 动态跟手 (Dynamic Follow): 任意位置触控即在手指落点唤出摇杆底座；
 * 2. 动量滑动追踪: 手指超出最大半径时，底座平滑跟随手指位移，转向响应零延迟；
 * 3. 独立 Touch Identifier 多点触控追踪（移动与折跃双拇指互不干扰）；
 * 4. 灵敏死区缓冲与平滑无级归一化输出；
 * 5. 松手优雅回弹: 释放后底座平滑复位至舒适静息位置，透明度渐变；
 * 6. 兼容桌面端鼠标与无头自动化测试。
 */

export class VirtualJoystick {
  constructor(zoneEl, baseEl, knobEl, options = {}) {
    this.zone = zoneEl;
    this.base = baseEl;
    this.knob = knobEl;

    this.maxRadius = options.maxRadius || 46;
    this.deadzone = options.deadzone || 6;
    this.onMove = options.onMove || (() => {});
    this.onStart = options.onStart || (() => {});
    this.onEnd = options.onEnd || (() => {});

    this.activeTouchId = null;
    this.isMouseDown = false;
    this.centerX = 0;
    this.centerY = 0;
    this.isTracking = false;

    this.initEvents();
    this.resetToRestingPosition(false);
  }

  /**
   * 计算底座在未触控时的静息默认锚点
   */
  getRestingAnchor() {
    if (!this.zone) return { x: 75, y: 75 };
    const rect = this.zone.getBoundingClientRect();
    const isLandscape = window.innerWidth > window.innerHeight && window.innerWidth <= 900;
    const x = isLandscape ? Math.max(60, rect.width * 0.28) : Math.max(65, rect.width * 0.32);
    const y = isLandscape ? Math.max(60, rect.height - 65) : Math.max(70, rect.height - 75);
    return { x, y };
  }

  /**
   * 将摇杆重置到静息位置
   */
  resetToRestingPosition(animate = true) {
    if (!this.base || !this.knob) return;
    this.isTracking = false;
    this.knob.style.transform = 'translate(0px, 0px)';
    this.base.classList.remove('active');
    this.knob.classList.remove('active');

    const anchor = this.getRestingAnchor();
    this.base.style.transition = animate ? 'all 0.3s cubic-bezier(0.2, 0.9, 0.3, 1)' : 'none';
    this.base.style.left = `${anchor.x}px`;
    this.base.style.top = `${anchor.y}px`;
    this.base.style.transform = 'translate(-50%, -50%)';

    this.updateCenter();
  }

  updateCenter() {
    if (!this.base) return;
    const rect = this.base.getBoundingClientRect();
    this.centerX = rect.left + rect.width / 2;
    this.centerY = rect.top + rect.height / 2;
  }

  /**
   * 在手指落点动态唤出摇杆
   */
  activateAt(clientX, clientY) {
    if (!this.zone || !this.base) return;
    const zRect = this.zone.getBoundingClientRect();
    
    this.centerX = clientX;
    this.centerY = clientY;
    this.isTracking = true;

    // 禁用过渡动画以实现 60fps 零延迟跟手
    this.base.style.transition = 'opacity 0.15s ease, box-shadow 0.15s ease';
    this.base.style.left = `${clientX - zRect.left}px`;
    this.base.style.top = `${clientY - zRect.top}px`;
    this.base.style.transform = 'translate(-50%, -50%)';

    this.base.classList.add('active');
    this.knob.classList.add('active');
    this.knob.style.transform = 'translate(0px, 0px)';

    if (this.onStart) this.onStart();
  }

  initEvents() {
    if (!this.zone || !this.base || !this.knob) return;

    // === Touch 事件监听 ===
    this.zone.addEventListener('touchstart', (e) => {
      e.preventDefault();
      if (this.activeTouchId !== null) return;

      const touch = e.changedTouches[0];
      this.activeTouchId = touch.identifier;
      this.activateAt(touch.clientX, touch.clientY);
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
          this.resetToRestingPosition(true);
          this.onMove({ x: 0, y: 0 });
          if (this.onEnd) this.onEnd();
          break;
        }
      }
    };

    window.addEventListener('touchend', handleTouchEnd);
    window.addEventListener('touchcancel', handleTouchEnd);

    // === Mouse 事件兼容 (支持桌面端测试与调试) ===
    this.zone.addEventListener('mousedown', (e) => {
      if (e.button !== 0) return;
      this.isMouseDown = true;
      this.activateAt(e.clientX, e.clientY);
      this.processMovement(e.clientX, e.clientY);
    });

    window.addEventListener('mousemove', (e) => {
      if (!this.isMouseDown) return;
      this.processMovement(e.clientX, e.clientY);
    });

    const handleMouseUp = () => {
      if (!this.isMouseDown) return;
      this.isMouseDown = false;
      this.resetToRestingPosition(true);
      this.onMove({ x: 0, y: 0 });
      if (this.onEnd) this.onEnd();
    };

    window.addEventListener('mouseup', handleMouseUp);

    window.addEventListener('resize', () => {
      if (!this.isTracking) {
        this.resetToRestingPosition(false);
      }
    });
  }

  processMovement(clientX, clientY) {
    let dx = clientX - this.centerX;
    let dy = clientY - this.centerY;
    let dist = Math.hypot(dx, dy);
    const angle = Math.atan2(dy, dx);

    // 跟手核心逻辑 (Dynamic Follow Drag)：
    // 当手指拖拽位移超出最大半径时，底座平滑跟随手指位移，确保转向时绝无行程死区
    if (dist > this.maxRadius) {
      this.centerX = clientX - Math.cos(angle) * this.maxRadius;
      this.centerY = clientY - Math.sin(angle) * this.maxRadius;

      const zRect = this.zone.getBoundingClientRect();
      this.base.style.left = `${this.centerX - zRect.left}px`;
      this.base.style.top = `${this.centerY - zRect.top}px`;

      dx = Math.cos(angle) * this.maxRadius;
      dy = Math.sin(angle) * this.maxRadius;
      dist = this.maxRadius;
    }

    this.knob.style.transform = `translate(${dx.toFixed(1)}px, ${dy.toFixed(1)}px)`;

    if (dist < this.deadzone) {
      this.onMove({ x: 0, y: 0 });
    } else {
      const power = Math.min(1.0, (dist - this.deadzone) / (this.maxRadius - this.deadzone));
      this.onMove({
        x: Math.cos(angle) * power,
        y: Math.sin(angle) * power
      });
    }
  }

  destroy() {
    this.resetToRestingPosition(false);
    this.activeTouchId = null;
    this.isMouseDown = false;
  }
}
