import { STAGE_STRATEGIES } from './strategies.js';

// 多普勒战机 TAS (Tool-Assisted Speedrun) 引擎核心
// 职责：驱动理论最优输入状态机、控制自动按键注入、全关卡自动巡航测试与耗时统计
export class TASEngine {
  constructor(gameContext) {
    this.ctx = gameContext; // { input, player, enemy, switchStage, startGame, getStage, onVictoryNotification }
    this.active = false;
    this.currentStage = '';
    this.currentStrategy = null;
    this.strategyState = {};
    this.elapsedTime = 0;
    this.onComplete = null;
    this.logs = [];

    // 全关卡自动巡航状态
    this.isTourRunning = false;
    this.tourStages = ['1', '2-s7', '2-s5', '2-s8', '2-s4', '2-s9', '2-boss'];
    this.tourIndex = 0;
    this.tourResults = {};
    this.onTourComplete = null;
  }

  // 启动单个关卡的 TAS 理论最优解测试
  start(stageName, onComplete = null) {
    const strat = STAGE_STRATEGIES[stageName];
    if (!strat) {
      console.warn(`[TAS] 未找到关卡 ${stageName} 的最优解策略`);
      return false;
    }

    this.currentStage = stageName;
    this.currentStrategy = strat;
    this.strategyState = strat.init ? strat.init() : {};
    this.elapsedTime = 0;
    this.active = true;
    this.onComplete = onComplete;
    this.logs = [];

    console.log(`%c[TAS START] 开始执行 【${strat.name}】 理论最优解脚本`, 'color:#00ffff;font-weight:bold;');
    return true;
  }

  // 停止 TAS 运行
  stop() {
    this.active = false;
    this.currentStrategy = null;
    this.strategyState = {};
    if (this.ctx && this.ctx.input) {
      this.ctx.input.keys = {};
    }
  }

  // 每一帧更新与输入注入 (在 gameLoop 中 player.update 之前调用)
  update(dt) {
    if (!this.active || !this.currentStrategy) return;

    this.elapsedTime += dt;

    // 运行当前关卡的最优解状态机，计算本帧输入
    const inputs = this.currentStrategy.update(this.ctx, this.elapsedTime, this.strategyState);

    const inputManager = this.ctx.input;
    if (!inputManager) return;

    // 1. 触发瞬时动作 (J/K/L 技能)
    if (inputs.actions && inputs.actions.length > 0) {
      for (const act of inputs.actions) {
        if (act === 'toggleFire') {
          inputManager.skill1Triggered = true;
          this.logAction('切换战术射击 (J)');
        } else if (act === 'skill2') {
          inputManager.skill2Triggered = true;
          this.logAction('释放折跃闪现 (K)');
        } else if (act === 'skill3') {
          inputManager.skill3Triggered = true;
          this.logAction('展开反射力场盾 (L)');
        }
      }
    }

    // 2. 注入持续按键状态
    inputManager.keys = inputs.keys || {};
  }

  // 开始全关卡自动巡航测试 (自动逐个关卡运行最优解并统计时间)
  startTour(stages = null, onTourComplete = null) {
    this.tourStages = stages || ['1', '2-s7', '2-s5', '2-s8', '2-s4', '2-s9', '2-boss'];
    this.tourIndex = 0;
    this.tourResults = {};
    this.isTourRunning = true;
    this.onTourComplete = onTourComplete;

    console.log('%c[TAS TOUR] 启动全关卡理论最优解连续巡航测试！', 'color:#00ff88;font-size:14px;font-weight:bold;');
    this.runNextTourStage();
  }

  // 巡航步进到下一个关卡
  runNextTourStage() {
    if (this.tourIndex >= this.tourStages.length) {
      this.isTourRunning = false;
      this.stop();
      console.log('%c[TAS TOUR COMPLETE] 全关卡理论最优解巡航测试全部通过！实测最优解如下：', 'color:#00ff88;font-size:15px;font-weight:bold;', this.tourResults);
      if (this.onTourComplete) {
        this.onTourComplete(this.tourResults);
      }
      return;
    }

    const stg = this.tourStages[this.tourIndex];
    this.tourIndex++;

    if (this.ctx.switchStage) {
      this.ctx.switchStage(stg);
    }
    if (this.ctx.startGame) {
      this.ctx.startGame();
    }

    this.start(stg, (timeStr) => {
      this.tourResults[stg] = timeStr;
      console.log(`%c[TAS TOUR] 关卡 ${stg} 达成最优通关耗时: ${timeStr}`, 'color:#00ffff;font-weight:bold;');
    });
  }

  // 当关卡胜利时通知 TAS (由 main.js showVictory 调用)
  handleVictory(timeStr) {
    if (this.active) {
      if (this.onComplete) {
        this.onComplete(timeStr);
      }
      this.stop();
    }

    if (this.isTourRunning) {
      // 间隔 1.0s 自动无缝进入下一关
      setTimeout(() => {
        this.runNextTourStage();
      }, 1000);
      return true; // 告知外部正处于巡航模式
    }
    return false;
  }

  // 当关卡失败时通知 TAS (由 main.js showGameOver 调用)
  handleGameOver() {
    if (this.active) {
      console.warn(`[TAS] 关卡 ${this.currentStage} 测试未成功`);
      this.stop();
    }
    this.isTourRunning = false;
  }

  logAction(actionName) {
    const timeSec = this.elapsedTime.toFixed(2);
    const msg = `[TAS ${timeSec}s] ${actionName}`;
    this.logs.push(msg);
    console.log(`%c${msg}`, 'color:#ffaa00;');
  }
}
