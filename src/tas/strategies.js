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

  // 3. 2-s5: 5 弱点 (72° 严格红移破盾)
  // 策略：0.05s W+J 前折跃至中场建立后撤纵深 -> S 全速恒退产生精确多普勒红移 (0.264s / 72°) -> 5 发 100% 连续连破 5 盾 -> 破盾后 W 前冲斩杀
  '2-s5': {
    name: 'STAGE 2-s5 (5弱点 · W前折跃 + S恒速后撤 72°)',
    init() {
      return { hasBlinked: false };
    },
    update(ctx, elapsed, state) {
      const { player, enemy } = ctx;
      const inputs = { keys: {}, actions: [] };

      if (!player.autoFire && elapsed >= 0.05) {
        inputs.actions.push('toggleFire');
      }

      // 开局 0.05s 向前瞬移折跃至中场，建立充分的向后滑退多普勒纵深
      if (!state.hasBlinked && elapsed >= 0.05) {
        inputs.keys['KeyW'] = true;
        inputs.actions.push('skill2');
        state.hasBlinked = true;
        return inputs;
      }

      if (enemy.shield.isShattering) {
        inputs.keys['KeyS'] = true;
      } else if (enemy.shield.isBroken) {
        inputs.keys['KeyW'] = true;
      } else {
        // 破盾阶段：保持严格正向 S 恒速滑退，实现 5 发 100% 连续破盾，0 偏转空弹！
        inputs.keys['KeyS'] = true;
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
  // Phase 0 (7 弱点, 7 血): W 前推破盾 -> 破盾后闪 (S+J) 避开狙击 -> W 前推清空血量 (0 伤，结束于前置位)
  // Phase 1 (5 弱点, 7 血): 从前置位 S 后撤破 5 盾 (220px/s 严格吻合 72° 红移，5 发 0 空弹) -> 破盾后 W 冲刺灌伤微移躲狙 (0 伤，结束于前置位)
  // Phase 2 (8 弱点, 7 血): 从前置位 A+W 贴盾逆时针绕行连碎前 4 盾 (WP 0, 7, 6, 5) -> 0.95s W 向上折跃瞬移 -> W+D 斜切顺应顺时针自转连碎后 4 盾 (WP 4, 3, 2, 1) -> 8 发全中 0 空弹！-> 碎盾后平滑走进内圈 targetY = 175 (0 伤，定格圈内)
  // Phase 3 (4 弱点, 9 血): 圈内弹簧拳击飞 (-1 血) -> 550px/s 恒速滑退破 4 盾 -> W 前推回 targetY = 175 灌入 7 伤，平滑停留在内圈 (-1 受伤，结束于前置位)
  // Phase 4 (9 弱点, 11 血): Boss 密集弹幕雨 -> W 前冲硬吃子弹 (-1 血触发无敌) -> 瞬移闪现入圈 + 开 L 护盾反弹 -> 反弹弹幕+极频激光斩杀 Boss (HP=1 存活)
  '2-boss': {
    name: 'STAGE 2-BOSS (五阶段全连携终极战: 7->5->8->4->9)',
    init() {
      return {
        p0Blinked: false,
        p1StartTime: null,
        p2StartTime: null,
        p2Blinked: false,
        p3StartTime: null,
        p4StartTime: null,
        p4ShieldWasBroken: false,
        p4ShieldRestoredTime: null,
        p4Blinked: false,
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

      // Phase 0: 7 弱点, 7 血 (W 前推破盾 -> S+J 后闪避狙 -> W 前冲微移规避斩杀, 0 伤)
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
      // Phase 1: 5 弱点, 7 血 (严格 72° 纯 S 红移连击 5 弱点零空弹 -> 破盾后 W 冲刺灌伤微移躲狙, 0 伤)
      else if (phase === 1) {
        const p1Time = state.p1StartTime ? elapsed - state.p1StartTime : 0;
        if (!enemy.shield.isBroken && !enemy.shield.isShattering) {
          // 破盾期：保持严格正向 S 恒速后退 (220px/s 红移拉大周期至 0.264s 严格吻合 72°)，5 发 100% 连续破 5 盾，绝不横移偏转导致空弹！
          inputs.keys['KeyS'] = true;
        } else {
          // 护盾击破后：W 全速前冲灌注多普勒高频伤害，并在 1.35s-1.70s 轻微右偏躲避狙击弹，随后回中
          inputs.keys['KeyW'] = true;
          if (p1Time >= 1.35 && p1Time <= 1.70) {
            inputs.keys['KeyD'] = true;
          } else if (p1Time > 1.70 && player.x > 401) {
            inputs.keys['KeyA'] = true;
          }
        }
      }
      // Phase 2: 8 弱点, 7 血 (前置位 W 前推 0.22s -> A+W 绕盾 0.88s 连碎前 4 盾 (WP 0, 7, 6, 5) -> 1.10s W 闪现 -> W 正冲连碎后 4 盾 (WP 4, 3, 2, 1)，8 发 100% 连击 0 偏转空弹！)
      else if (phase === 2) {
        const p2Time = state.p2StartTime ? elapsed - state.p2StartTime : 0;
        if (!enemy.shield.isBroken && !enemy.shield.isShattering) {
          if (p2Time < 0.22) {
            // 开局 0.22s：保持 W 前推对正，待 Phase 1 残余弹幕飞掠穿过
            inputs.keys['KeyW'] = true;
          } else if (p2Time < 0.22 + 0.88) {
            // 前 4 盾：A+W 贴盾绕行，连碎前 4 个弱点 (WP 0, 7, 6, 5)
            inputs.keys['KeyA'] = true;
            inputs.keys['KeyW'] = true;
          } else if (!state.p2Blinked && p2Time >= 0.22 + 0.88) {
            // 1.10s 节点：按下 W 向上折跃瞬移，顺应自转完成跳角位移
            inputs.keys['KeyW'] = true;
            inputs.actions.push('skill2');
            state.p2Blinked = true;
          } else {
            // 闪现后：W 前推连碎后 4 个弱点 (WP 4, 3, 2, 1)，发发全中 0 空弹！
            inputs.keys['KeyW'] = true;
          }
        } else if (enemy.shield.isShattering) {
          // 碎盾顿挫无敌期：平滑向敌机 x 轴对齐，保持在盾外
          if (player.x < enemy.x - 2) inputs.keys['KeyD'] = true;
          else if (player.x > enemy.x + 2) inputs.keys['KeyA'] = true;
        } else {
          // 破盾融化期：前段保持在安全区 y=36 持续输出核心血量 (绝不提前进入内圈触发弹簧拳)
          // 当血量打至剩余 <= 2 时，晚点再切入内圈 targetY = 175，阶段末顺利定格圈内迎接入侵准备
          const targetY = (enemy.currentPhaseHp <= 2) ? (enemy.y + 45) : 36;
          const targetX = enemy.x;
          if (player.y > targetY + 2) inputs.keys['KeyW'] = true;
          else if (player.y < targetY - 2) inputs.keys['KeyS'] = true;

          if (player.x < targetX - 2) inputs.keys['KeyD'] = true;
          else if (player.x > targetX + 2) inputs.keys['KeyA'] = true;
        }
      }
      // Phase 3: 4 弱点, 9 血 (圈内预打 2 伤 -> 弹簧拳击飞 -1 血至 2/3 -> 550px/s 恒速滑退连碎 4 盾 -> W 前推回 targetY = 175 灌入 7 伤，平滑停留在内圈)
      else if (phase === 3) {
        const p3Time = state.p3StartTime ? elapsed - state.p3StartTime : 0;
        if (p3Time >= 0.40) {
          const targetY = enemy.y + 45;
          const targetX = enemy.x;
          if (player.y > targetY + 2) inputs.keys['KeyW'] = true;
          else if (player.y < targetY - 2) inputs.keys['KeyS'] = true;

          if (player.x < targetX - 2) inputs.keys['KeyD'] = true;
          else if (player.x > targetX + 2) inputs.keys['KeyA'] = true;
        }
      }
      // Phase 4: 9 弱点, 11 血 (圈内打入 2 伤 -> 弹簧拳击飞 -1 血至 1/3 -> 保持 y=540 击破 9 盾 -> 破盾后 W 极速冲锋多普勒倾泻 7 伤 -> 盾恢复瞬间闪现直插核心补 2 伤斩杀 Boss，HP=1/3 存活！)
      else if (phase === 4) {
        const p4Time = state.p4StartTime ? elapsed - state.p4StartTime : 0;
        if (enemy.shield.isBroken) {
          state.p4ShieldWasBroken = true;
        }
        if (state.p4ShieldWasBroken && !enemy.shield.isBroken && !state.p4ShieldRestoredTime) {
          state.p4ShieldRestoredTime = elapsed;
        }

        const punchDelay = enemy.invadeThreshold || 0.44;
        if (p4Time < punchDelay) {
          inputs.keys['KeyW'] = true;
        } else if (p4Time >= punchDelay + 0.05) {
          if (!enemy.shield.isBroken && !enemy.shield.isShattering && !state.p4ShieldWasBroken) {
            const holdY = 540;
            if (player.y < holdY - 4) inputs.keys['KeyS'] = true;
            else if (player.y > holdY + 4) inputs.keys['KeyW'] = true;

            // 弹簧拳击飞落地后，维持在经过严格物理测算的黄金瞄准坐标 targetX = 350 (稳定区间 346~360)
            // 使得 9 弱点盾顺时针旋转 (40° 密位) 依次将每个存活弱点 (0->7->5->3->2->1->8->6->4) 严密送入弹道，实现 0 偏转空弹！
            const targetX = 350;
            if (player.x > targetX + 3) inputs.keys['KeyA'] = true;
            else if (player.x < targetX - 3) inputs.keys['KeyD'] = true;
          } else if (enemy.shield.isBroken || enemy.shield.isShattering) {
            inputs.keys['KeyW'] = true;
          } else if (state.p4ShieldRestoredTime) {
            if (!state.p4Blinked) {
              inputs.actions.push('skill2');
              state.p4Blinked = true;
            }
          }
        }
      }

      return inputs;
    }
  }
};
