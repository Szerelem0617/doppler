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

      // 护盾击破后（或进入时停阶段）：W 全速前冲斩杀！
      if (enemy.shield.isBroken) {
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

      // 护盾击破后：W 全速前冲斩杀
      if (enemy.shield.isBroken) {
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

      if (!enemy.shield.isBroken) {
        inputs.keys['KeyS'] = true;
        inputs.keys['KeyA'] = true;
      } else {
        inputs.keys['KeyW'] = true;
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

  // 6. 2-s8: 8 弱点 (45° 极频蓝移突破)
  // 策略：开启 J 射击 -> 全速 W 前推进利用多普勒蓝移紧凑波前破 8 盾斩杀
  '2-s8': {
    name: 'STAGE 2-s8 (8弱点 · 45° 极频蓝移突破)',
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
  // 策略：
  // Phase 0 (7 弱点): W 缓慢前推进
  // Phase 1 (5 弱点): S 倒退 + A 环绕
  // Phase 2 (8 弱点): W 全速极频前推
  // Phase 3 (4 弱点): K 闪现入盾诱骗弹簧拳借力匀速滑退
  // Phase 4 (9 弱点): W 极限蓝移压制
  '2-boss': {
    name: 'STAGE 2-BOSS (五阶段全连携终极战: 7->5->8->4->9)',
    init() {
      return {
        phase3Blinked: false,
        phase2Shielded: false,
        lastReportedPhase: -1
      };
    },
    update(ctx, elapsed, state) {
      const { player, enemy } = ctx;
      const inputs = { keys: {}, actions: [] };

      if (!player.autoFire && elapsed >= 0.05) {
        inputs.actions.push('toggleFire');
      }

      // 护盾击破虚弱受创窗口：全速 W 前冲利用多普勒蓝移极速融化当前轮次阶段血量！
      if (enemy.shield.isBroken) {
        inputs.keys['KeyW'] = true;
        return inputs;
      }

      const phase = enemy.currentPhaseIndex;
      if (phase !== state.lastReportedPhase) {
        state.lastReportedPhase = phase;
      }

      // 护盾防护状态：根据各阶段弱点数执行理论最优解破盾机动
      // Phase 0 (7 弱点)
      if (phase === 0) {
        inputs.keys['KeyW'] = true;
      }
      // Phase 1 (5 弱点)
      else if (phase === 1) {
        inputs.keys['KeyS'] = true;
        inputs.keys['KeyA'] = true;
      }
      // Phase 2 (8 弱点)
      else if (phase === 2) {
        inputs.keys['KeyW'] = true;
      }
      // Phase 3 (4 弱点)
      else if (phase === 3) {
        if (!state.phase3Blinked) {
          inputs.actions.push('skill2'); // K 闪现进盾诱骗弹簧拳
          state.phase3Blinked = true;
        }
      }
      // Phase 4 (9 弱点)
      else if (phase === 4) {
        inputs.keys['KeyW'] = true;
      }

      return inputs;
    }
  }
};
