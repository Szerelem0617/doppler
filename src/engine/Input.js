// 输入管理器 (支持离散 8 向移动、自动/按键射击与 J/K 战术技能监听)
export class InputManager {
  constructor(canvas) {
    this.keys = {};
    this.isShooting = false;
    this.mousePos = { x: 0, y: 0 };
    this.canvas = canvas;

    // 技能触发标记 (单次按下触发)
    this.skill1Triggered = false; // J: 折跃闪现
    this.skill2Triggered = false; // K: 反射力场
    this.skill3Triggered = false; // L: (备用兼容)

    this.initEvents();
  }

  initEvents() {
    window.addEventListener('keydown', (e) => {
      this.keys[e.code] = true;
      if (e.code === 'KeyJ') {
        this.skill1Triggered = true; // J 键: 折跃闪现
      }
      if (e.code === 'KeyK') {
        this.skill2Triggered = true; // K 键: 反射力场
      }
      if (e.code === 'KeyL') {
        this.skill2Triggered = true; // L 键兼容触发力场
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
      const scaleX = rect.width > 0 ? 800 / rect.width : 1;
      const scaleY = rect.height > 0 ? 800 / rect.height : 1;
      this.mousePos.x = (e.clientX - rect.left) * scaleX;
      this.mousePos.y = (e.clientY - rect.top) * scaleY;
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

  // 消费一次 J 键折跃闪现触发
  consumeSkill1() {
    if (this.skill1Triggered) {
      this.skill1Triggered = false;
      return true;
    }
    return false;
  }

  // 别名
  consumeBlink() {
    return this.consumeSkill1();
  }

  // 消费一次 K 键反射力场盾触发
  consumeSkill2() {
    if (this.skill2Triggered) {
      this.skill2Triggered = false;
      return true;
    }
    return false;
  }

  // 别名
  consumeShield() {
    return this.consumeSkill2();
  }

  // 兼容老调用
  consumeSkill3() {
    return this.consumeSkill2();
  }

  // 兼容老调用：火控切换已删除，战机常驻自动连射
  consumeToggleFire() {
    return false;
  }
}
