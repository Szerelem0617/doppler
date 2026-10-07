import { Boss } from '../src/game/Boss.js';
import { Player } from '../src/game/Player.js';

console.log('==============================================');
console.log(' SECTION 4 TRIAL (Phase 3: 4 WP, 9 HP)');
console.log(' Plan: 圈内弹簧拳击飞-1血 -> 550px/s滑退破4盾 -> W前推+前闪(W+K)清空9血');
console.log('==============================================');

const w = 800;
const h = 800;
const dt = 1 / 60;

// Setup Boss at Phase 3 (4 WP, 9 HP) with player starting inside the circle (400, 175)
function runSection4Attempt(attemptNum, params = {}) {
  const boss = new Boss(w / 2, 130, {
    phaseSequence: [7, 5, 8, 4, 9],
    phaseHps: [7, 7, 8, 9, 11],
    enableBullets: true
  });
  boss.currentPhaseIndex = 3;
  boss.currentPhaseHp = 9;
  boss.shield.setConfiguration(4, 2.8);

  const player = new Player(400, 175, boss);
  player.autoFire = true;
  player.skill1CdTimer = 0;
  player.skill2CdTimer = 0;

  let elapsed = 0;
  let hasForwardBlinked = false;
  let p3Completed = false;

  console.log(`[Attempt ${attemptNum} Start] Player starting inside circle: (${player.x.toFixed(1)}, ${player.y.toFixed(1)}), Boss Phase: ${boss.currentPhaseIndex}, Boss HP: ${boss.currentPhaseHp}`);

  while (elapsed < 6.0) {
    elapsed += dt;

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
      getMovementVector() {
        let x = 0, y = 0;
        if (this.keys['KeyW']) y -= 1;
        if (this.keys['KeyS']) y += 1;
        if (this.keys['KeyA']) x -= 1;
        if (this.keys['KeyD']) x += 1;
        return { x, y };
      }
    };

    // 1. 破盾期：处于被弹簧拳击飞滑退中，保持自动射击破 4 盾
    if (!boss.shield.isBroken && !boss.shield.isShattering) {
      // 滑退中保持射击
    }
    // 2. 碎盾阶段
    else if (boss.shield.isShattering) {
      input.keys['KeyW'] = true;
    }
    // 3. 暴露虚弱伤害阶段：向前推进 (KeyW) + 前闪 (KeyW + skill2)！
    else {
      input.keys['KeyW'] = true;
      if (!hasForwardBlinked && elapsed > 1.8) {
        input.actions.push('skill2');
        hasForwardBlinked = true;
        console.log(`Forward blinked at t=${elapsed.toFixed(3)}s! Player pos: (${player.x.toFixed(1)}, ${player.y.toFixed(1)})`);
      }
    }

    player.update(dt, input, w, h, boss.bullets);
    boss.update(dt, elapsed, player, { recordHit() {}, getFrequency() { return 4.0; } });

    for (const b of player.bullets) {
      if (!b.alive) continue;
      if (!boss.shield.isBroken) {
        if (boss.shield.checkBulletCollision(b, null, Date.now())) continue;
        if (!boss.shield.isShattering) {
          if (Math.hypot(b.x - boss.x, b.y - boss.y) <= boss.radius + 6) {
            b.alive = false;
            boss.takeDamage(1, null, Date.now());
          }
        }
      } else {
        if (Math.hypot(b.x - boss.x, b.y - boss.y) <= boss.radius + 6) {
          b.alive = false;
          boss.takeDamage(1, null, Date.now());
        }
      }
    }

    if (boss.currentPhaseIndex >= 4) {
      p3Completed = true;
      break;
    }
  }

  const success = p3Completed && player.hp === 2;
  console.log(`[Attempt ${attemptNum} Result] Success: ${success}, Time: ${elapsed.toFixed(3)}s, Player HP: ${player.hp} (Took -1: ${player.hp === 2}), Boss Phase: ${boss.currentPhaseIndex}`);
  return { success, player, boss, elapsed };
}

runSection4Attempt(1, {});
