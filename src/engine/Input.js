// 输入管理器 (支持离散 8 向移动、自动/按键射击与 J/K 战术技能监听)
export class InputManager {
  constructor(canvas) {
    this.keys = {};
    this.isShooting = false;
    this.mousePos = { x: 0, y: 0 };
    this.canvas = canvas;

    // 技能触发标记 (单次按下触发)
    this.skill1Triggered = false; // J
    this.skill2Triggered = false; // K
    this.skill3Triggered = false; // L

    this.initEvents();
  }

  initEvents() {
    window.addEventListener('keydown', (e) => {
      this.keys[e.code] = true;
      if (e.code === 'KeyJ') {
        this.skill1Triggered = true;
      }
      if (e.code === 'KeyK') {
        this.skill2Triggered = true;
      }
      if (e.code === 'KeyL') {
        this.skill3Triggered = true;
      }
    });

    window.addEventListener('keyup', (e) => {
      this.keys[e.code] = false;
    });

    window.addEventListener('mousedown', (e) => {
      if (e.button === 0) {
        this.isShooting = true;
      }
    });

    window.addEventListener('mouseup', (e) => {
      if (e.button === 0) {
        this.isShooting = false;
      }
    });

    window.addEventListener('mousemove', (e) => {
      const rect = this.canvas.getBoundingClientRect();
      this.mousePos.x = e.clientX - rect.left;
      this.mousePos.y = e.clientY - rect.top;
    });
  }

  // 获取离散 8 向移动矢量 (精确归一化)
  getMovementVector() {
    let dx = 0;
    let dy = 0;

    if (this.keys['KeyW'] || this.keys['ArrowUp']) dy -= 1;
    if (this.keys['KeyS'] || this.keys['ArrowDown']) dy += 1;
    if (this.keys['KeyA'] || this.keys['ArrowLeft']) dx -= 1;
    if (this.keys['KeyD'] || this.keys['ArrowRight']) dx += 1;

    // 离散 8 向处理：单向或对角线
    if (dx !== 0 && dy !== 0) {
      const invSqrt2 = 0.70710678;
      return { x: dx * invSqrt2, y: dy * invSqrt2 };
    } else if (dx !== 0 || dy !== 0) {
      return { x: dx, y: dy };
    }
    return { x: 0, y: 0 };
  }

  // 消费一次 J 键射击模式切换触发
  consumeToggleFire() {
    if (this.skill1Triggered) {
      this.skill1Triggered = false;
      return true;
    }
    return false;
  }

  // 兼容别名
  consumeSkill1() {
    return this.consumeToggleFire();
  }

  // 消费一次 K 技能触发
  consumeSkill2() {
    if (this.skill2Triggered) {
      this.skill2Triggered = false;
      return true;
    }
    return false;
  }

  // 消费一次 L 技能 (反射力场盾) 触发
  consumeSkill3() {
    if (this.skill3Triggered) {
      this.skill3Triggered = false;
      return true;
    }
    return false;
  }
}
