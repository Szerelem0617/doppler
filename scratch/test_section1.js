import { Boss } from '../src/game/Boss.js';
import { Player } from '../src/game/Player.js';
import { Bullet } from '../src/game/Bullet.js';

console.log('==============================================');
console.log(' SECTION 1 TRIAL (Phase 0: 7 WP, 7 HP)');
console.log(' Plan: W前推破7盾 -> 破盾后闪(S+K) -> W前推清空7血');
console.log('==============================================');

const w = 800;
const h = 800;
const dt = 1 / 60;

function runAttempt(attemptNum, params) {
  const boss = new Boss(w / 2, 130, {
    phaseSequence: [7, 5, 8, 4, 9],
    phaseHps: [7, 7, 8, 9, 11],
    enableBullets: true
  });

  const player = new Player(w / 2, h - 90, boss);
  player.autoFire = true;

  let elapsed = 0;
  let maxTime = 5.0;
  let hasBlinkedBack = false;
  let phase0Completed = false;
  let completeTime = 0;

  while (elapsed < maxTime) {
    elapsed += dt;

    // Tactical Inputs
    const input = {
      keys: {},
      actions: [],
      consumeSkill2() {
        const idx = this.actions.indexOf('skill2');
        if (idx !== -1) {
          this.actions.splice(idx, 1);
          return true;
        }
        return false;
      },
      consumeSkill3() { return false; },
      consumeToggleFire() { return false; },
      getMovementVector() {
        let x = 0, y = 0;
        if (this.keys['KeyW']) y -= 1;
        if (this.keys['KeyS']) y += 1;
        if (this.keys['KeyA']) x -= 1;
        if (this.keys['KeyD']) x += 1;
        return { x, y };
      }
    };

    // 1. 破盾阶段：W持续前推
    if (!boss.shield.isBroken && !boss.shield.isShattering) {
      input.keys['KeyW'] = true;
    }
    // 2. 破盾瞬间 (isShattering 或刚刚破盾)：执行 S + K 后闪！
    else if ((boss.shield.isShattering || boss.shield.isBroken) && !hasBlinkedBack) {
      input.keys['KeyS'] = true;
      input.actions.push('skill2');
      hasBlinkedBack = true;
    }
    // 3. 伤害阶段：全速按 W 前冲输出
    else {
      input.keys['KeyW'] = true;
    }

    // Update player
    player.update(dt, input, w, h, boss.bullets);

    // Update boss & boss bullets
    boss.update(dt, elapsed, player, {
      recordHit() {},
      getFrequency() { return 4.0; }
    });

    // Check collisions
    for (const b of player.bullets) {
      if (!b.alive) continue;

      if (!boss.shield.isBroken) {
        const hit = boss.shield.checkBulletCollision(b, null, Date.now());
        if (hit) continue;

        if (!boss.shield.isShattering) {
          const dist = Math.hypot(b.x - boss.x, b.y - boss.y);
          if (dist <= boss.radius + 6) {
            b.alive = false;
            boss.takeDamage(1, null, Date.now());
          }
        }
      } else {
        const dist = Math.hypot(b.x - boss.x, b.y - boss.y);
        if (dist <= boss.radius + 6) {
          b.alive = false;
          boss.takeDamage(1, null, Date.now());
        }
      }
    }

    // Check phase transition
    if (boss.currentPhaseIndex >= 1) {
      phase0Completed = true;
      completeTime = elapsed;
      break;
    }
  }

  const success = phase0Completed && player.hp === 3;
  console.log(`[Attempt ${attemptNum}] Success: ${success}, Time: ${completeTime.toFixed(3)}s, Player HP: ${player.hp}, Player Y: ${player.y.toFixed(1)}, Boss Phase: ${boss.currentPhaseIndex}`);
  return { success, completeTime, player, boss, elapsed };
}

// Run Attempt 1
const res = runAttempt(1, {});
if (res.success) {
  console.log('>>> Section 1 SUCCESS on Attempt 1! <<<');
} else {
  console.log('Section 1 needs tuning.');
}
