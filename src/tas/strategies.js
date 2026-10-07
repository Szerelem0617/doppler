// 多普勒战机 TAS (Tool-Assisted Speedrun) 各关卡理论最优解状态机策略
// 遵循纯物理机制与按键注入，实现高内聚状态驱动

export const STAGE_STRATEGIES = {
  // 1. 第一关：基础机制教学
  // 策略：开局双手脱离键盘完全静止 (vs = 0) -> 6 发子弹严格以 60° 间隔离散连碎 6 弱点 -> 破盾/时停瞬间 W 全速前冲利用多普勒蓝移一波融化 70 血
  '1': {
    name: 'STAGE 1 (6弱点 · 基准静止破盾 + 蓝移冲锋斩杀)',
    init() {
      return {};
    },
    update(ctx, elapsed, state) {
      const { player, enemy } = ctx;
      const inputs = { keys: {}, actions: [] };

      // 0.05s 开启自动射击
      if (!player.autoFire && elapsed >= 0.05) {
        inputs.actions.push('toggleFire');
      }

      // 碎盾过载顿挫期间：S 键后撤降频蓄势；护盾彻底崩解虚弱期：W 全速前冲斩杀！
      if (enemy.shield.isShattering) {
        inputs.keys['KeyS'] = true;
      } else if (enemy.shield.isBroken) {
        inputs.keys['KeyW'] = true;
      }
      // 护盾未破时：保持静止，子弹间隔 0.22s 刚好对应护盾旋转 60°

      return inputs;
    }
  },

  // 2. 2-s4: 4 弱点 (90° 借力打力)
  // 策略：0.05s 释放 K 折跃直插护盾核心 -> 0.35s 诱发机械弹簧拳 -> 550px/s 恒速滑退中开 J 射击 -> 4 发 90° 连碎 4 盾 -> W 前冲斩杀
  '2-s4': {
    name: 'STAGE 2-s4 (4弱点 · 借力弹簧拳 550px/s 恒速滑退 90°)',
    init() {
      return { hasBlinked: false };
    },
    update(ctx, elapsed, state) {
      const { player, enemy } = ctx;
      const inputs = { keys: {}, actions: [] };

      // 0.05s 闪现入盾
      if (!state.hasBlinked && elapsed >= 0.05) {
        inputs.actions.push('skill2');
        state.hasBlinked = true;
      }

      // 触发弹簧拳击飞进入 550px/s 匀速后退状态后开启射击
      if (player.isKnockedBack && !player.autoFire) {
        inputs.actions.push('toggleFire');
      }

      // 碎盾过载期 S 后撤蓄势，破盾后 W 前冲斩杀
      if (enemy.shield.isShattering) {
        inputs.keys['KeyS'] = true;
      } else if (enemy.shield.isBroken) {
        inputs.keys['KeyW'] = true;
      }

      return inputs;
    }
  },

  // 3. 2-s5: 5 弱点 (72° 回环机动)
  // 策略：开局开启 J 射击 -> S 后退拉大到达间隔 + A 逆时针环绕抵消多余角位移 -> 5 发依次连破 -> 破盾后 W 前冲斩杀
  '2-s5': {
    name: 'STAGE 2-s5 (5弱点 · S后退+A环绕 72°)',
    init() {
      return {};
    },
    update(ctx, elapsed, state) {
      const { player, enemy } = ctx;
      const inputs = { keys: {}, actions: [] };

      if (!player.autoFire && elapsed >= 0.05) {
        inputs.actions.push('toggleFire');
      }

      if (enemy.shield.isShattering) {
        inputs.keys['KeyS'] = true;
      } else if (enemy.shield.isBroken) {
        inputs.keys['KeyW'] = true;
      } else {
        inputs.keys['KeyS'] = true;
        inputs.keys['KeyA'] = true;
      }

      return inputs;
    }
  },

  // 5. 2-s7: 7 弱点 (51.4° 缓慢轻推)
  // 策略：开局开启 J 射击 -> 全程按住 W 缓慢前推进压缩到达周期至 0.188s -> 7 发 51.4° 连破 -> 破盾后前冲斩杀
  '2-s7': {
    name: 'STAGE 2-s7 (7弱点 · W轻推蓝移 51.4°)',
    init() {
      return {};
    },
    update(ctx, elapsed, state) {
      const { player, enemy } = ctx;
      const inputs = { keys: {}, actions: [] };

      if (!player.autoFire && elapsed >= 0.05) {
        inputs.actions.push('toggleFire');
      }

      inputs.keys['KeyW'] = true;

      return inputs;
    }
  },

  // 6. 2-s8: 8 弱点 (前4发W前推 + A左闪 + 后4发W+D斜切回正，一圈严格连碎8盾)
  // 策略：开局 W 前推 -> 前 4 发稳吃前 4 弱点 (WP 0, 7, 6, 5) -> 0.82s A 键左折跃瞬移跳角位移 -> 闪现后 W+D 斜向右上切入回正瞄准轴线 -> 后 4 发稳吃后 4 弱点 (WP 4, 3, 2, 1) -> 1.317s 第一圈 8 盾全破 -> W 前冲融化本体
  '2-s8': {
    name: 'STAGE 2-s8 (8弱点 · 前4发W+A左闪+后4发WD一圈连破)',
    init() {
      return { hasBlinked: false };
    },
    update(ctx, elapsed, state) {
      const { player, enemy } = ctx;
      const inputs = { keys: {}, actions: [] };

      if (!player.autoFire && elapsed >= 0.05) {
        inputs.actions.push('toggleFire');
      }

      // 碎盾过载期：S 后撤降频蓄势
      if (enemy.shield.isShattering) {
        inputs.keys['KeyS'] = true;
        return inputs;
      }
      // 护盾击破后：W 全速前冲斩杀
      if (enemy.shield.isBroken) {
        inputs.keys['KeyW'] = true;
        return inputs;
      }

      // 破盾前战术走位：
      // 1. 闪现前 (0 ~ 0.82s)：W 持续正向前推，前 4 发依次击破前 4 个弱点 (WP 0, 7, 6, 5)
      // 2. 0.82s 节点：按下 A 键向左折跃瞬移，顺应顺时针旋转跳跃
      // 3. 闪现后：W+D 斜向右上推进回正瞄准轴线，后 4 发依次击破后 4 个弱点 (WP 4, 3, 2, 1)！
      if (!state.hasBlinked && elapsed >= 0.82) {
        inputs.keys['KeyA'] = true;
        inputs.actions.push('skill2');
        state.hasBlinked = true;
      } else if (state.hasBlinked) {
        inputs.keys['KeyW'] = true;
        inputs.keys['KeyD'] = true;
      } else {
        inputs.keys['KeyW'] = true;
      }

      return inputs;
    }
  },

  // 6. 2-s9: 9 弱点 (40° 密位极限多普勒击穿)
  // 策略：开局开启 J 射击 -> 全速 W 前推进利用持续强大多普勒蓝移击穿 9 盾 -> 破盾后前冲斩杀
  '2-s9': {
    name: 'STAGE 2-s9 (9弱点 · 40° 极限多普勒击穿)',
    init() {
      return {};
    },
    update(ctx, elapsed, state) {
      const { player } = ctx;
      const inputs = { keys: {}, actions: [] };

      if (!player.autoFire && elapsed >= 0.05) {
        inputs.actions.push('toggleFire');
      }

      inputs.keys['KeyW'] = true;

      return inputs;
    }
  },

  // 7. 2-boss: 五阶段连击大考 (7 -> 5 -> 8 -> 4 -> 9)
  // 严格依据阶段速通规划实现：
  // Phase 0 (7 弱点, 7 血): W 前推破盾 -> 破盾后闪 (S+K) -> W 前推清空血量 (0 受伤，结束于前置位)
  // Phase 1 (5 弱点, 7 血): 从前置位 S 后撤破盾 -> 破盾开 L 护盾 + S 后撤补齐输出 (0 受伤)
  // Phase 2 (8 弱点, 8 血): W 前推(4WP) + A+K 左闪(4WP) -> 破盾后冲刺进 Boss 内圈 (0 受伤，结束于圈内)
  // Phase 3 (4 弱点, 9 血): 圈内弹簧拳击飞 (-1 血) -> 550px/s 恒速滑退破 4 盾 -> W 前推 + W+K 前闪清空 9 血 (-1 受伤，结束于前置位)
  // Phase 4 (9 弱点, 11 血): Boss 密集弹幕雨 -> W 前冲硬吃子弹 (-1 血触发无敌) -> 瞬移闪现入圈 + 开 L 护盾反弹 -> 反弹弹幕+极频激光斩杀 Boss (HP=1 存活)
  '2-boss': {
    name: 'STAGE 2-BOSS (五阶段全连携终极战: 7->5->8->4->9)',
    init() {
      return {
        p0Blinked: false,
        p1ShieldUsed: false,
        p1StartTime: null,
        p2Blinked: false,
        p2StartTime: null,
        p3Blinked: false,
        p3StartTime: null,
        p4Blinked: false,
        p4ShieldUsed: false,
        p4StartTime: null,
        lastReportedPhase: -1
      };
    },
    update(ctx, elapsed, state) {
      const { player, enemy } = ctx;
      const inputs = { keys: {}, actions: [] };

      // 开局开启自动射击
      if (!player.autoFire && elapsed >= 0.05) {
        inputs.actions.push('toggleFire');
      }

      const phase = enemy.currentPhaseIndex;
      if (phase !== state.lastReportedPhase) {
        state.lastReportedPhase = phase;
        if (phase === 1) state.p1StartTime = elapsed;
        if (phase === 2) state.p2StartTime = elapsed;
        if (phase === 3) state.p3StartTime = elapsed;
        if (phase === 4) state.p4StartTime = elapsed;
      }

      // Phase 0: 7 弱点, 7 血 (W 前推破盾 -> S+J 后闪 -> W 前冲微移规避狙击斩杀)
      if (phase === 0) {
        if (!enemy.shield.isBroken && !enemy.shield.isShattering) {
          inputs.keys['KeyW'] = true;
        } else if ((enemy.shield.isShattering || enemy.shield.isBroken) && !state.p0Blinked) {
          inputs.keys['KeyS'] = true;
          inputs.actions.push('skill2');
          state.p0Blinked = true;
        } else {
          inputs.keys['KeyW'] = true;
          if (elapsed >= 2.4 && elapsed <= 2.85) {
            inputs.keys['KeyD'] = true;
          } else if (elapsed > 2.85 && player.x > 401) {
            inputs.keys['KeyA'] = true;
          }
        }
      }
      // Phase 1: 5 弱点, 7 血 (S 后撤连碎 5 盾，1.15s 展开反射力场反弹双发狙击造成 2 核心伤害 + 5 发激光灌满 7 血，定格后置位)
      else if (phase === 1) {
        const p1Time = state.p1StartTime ? elapsed - state.p1StartTime : 0;
        if (!enemy.shield.isBroken && !enemy.shield.isShattering) {
          inputs.keys['KeyS'] = true;
        }
        if (!state.p1ShieldUsed && p1Time >= 1.15) {
          inputs.actions.push('skill3');
          state.p1ShieldUsed = true;
        }
      }
      // Phase 2: 8 弱点, 8 血 (严格无护盾纯走位大考：从后置位 400, 560 出发，W 前推切入 targetY = 185 冲破 8 盾并射杀 8 血，最终停在 Boss 内圈 <=88px，0 伤)
      else if (phase === 2) {
        const targetY = enemy.y + 55;
        if (player.y > targetY + 2) inputs.keys['KeyW'] = true;
        else if (player.y < targetY - 2) inputs.keys['KeyS'] = true;
      }
      // Phase 3: 4 弱点, 9 血 (内圈受机械弹簧拳击退 -1 血 -> 550px/s 恒速滑退多普勒 90° 连碎 4 盾 -> 破盾后 W 前推切入 targetY = 185 融化 9 血)
      else if (phase === 3) {
        if (!enemy.shield.isBroken && !enemy.shield.isShattering) {
          // 匀速滑退中自动射击连碎 4 盾
        } else {
          const targetY = enemy.y + 55;
          if (player.y > targetY + 2) inputs.keys['KeyW'] = true;
          else if (player.y < targetY - 2) inputs.keys['KeyS'] = true;
        }
      }
      // Phase 4: 9 弱点, 11 血 (0.1s 键位放空折跃瞬移直插护盾内圈 39px -> 零距离激光暴击贯穿核心斩杀 Boss，HP=1 存活大通关！)
      else if (phase === 4) {
        const p4Time = state.p4StartTime ? elapsed - state.p4StartTime : 0;
        if (!state.p4Blinked && p4Time >= 0.1) {
          // 不按方向键触发折跃入盾
          inputs.actions.push('skill2');
          state.p4Blinked = true;
        }
        if (state.p4Blinked && player.shieldCdTimer <= 0) {
          inputs.actions.push('skill3');
        }
      }

      return inputs;
    }
  }
};
