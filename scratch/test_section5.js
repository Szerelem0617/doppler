import { Boss } from '../src/game/Boss.js';
import { Player } from '../src/game/Player.js';

console.log('==============================================');
console.log(' SECTION 5 TRIAL (Phase 4: 9 WP, 11 HP)');
console.log(' Plan: 前冲吃弹-1血(获1.2s无敌) -> 闪现进圈开L反弹 -> 击飞前清空11血通关');
console.log('==============================================');

const w = 800;
const h = 800;
const dt = 1 / 60;

function runSection5Attempt(attemptNum, params = {}) {
  const boss = new Boss(w / 2, 130, {
    phaseSequence: [7, 5, 8, 4, 9],
    phaseHps: [7, 7, 8, 9, 11],
    enableBullets: true
  });
  boss.currentPhaseIndex = 4;
  boss.currentPhaseHp = 11;
  boss.shield.setConfiguration(9, 2.8);
  // Trigger Phase 5 spawn barrage
  boss.firePhase5SpawnBarrage();

  // Player position from Section 4 finish (around 400, 480), HP = 2
  const player = new Player(400, 480, boss);
  player.hp = 2;
  player.autoFire = true;
  player.skill1CdTimer = 0;
  player.skill2CdTimer = 0;

  let elapsed = 0;
  let hasBlinkedIn = false;
  let hasUsedReflect = false;
  let bossKilled = false;

  console.log(`[Attempt ${attemptNum} Start] Player starting pos: (${player.x.toFixed(1)}, ${player.y.toFixed(1)}), HP: ${player.hp}, Boss Phase: ${boss.currentPhaseIndex}, Boss HP: ${boss.currentPhaseHp}`);

  while (elapsed < 5.0 && !boss.isDead) {
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
      consumeSkill3() {
        const idx = this.actions.indexOf('skill3');
        if (idx !== -1) {
          this.actions.splice(idx, 1);
          return true;
        }
        return false;
      },
      getMovementVector() {
        let x = 0, y = 0;
        if (this.keys['KeyW']) y -= 1;
        if (this.keys['KeyS']) y += 1;
        if (this.keys['KeyA']) x -= 1;
        if (this.keys['KeyD']) x += 1;
        return { x, y };
      }
    };

    // 1. 直冲穿弹吃 1 发伤害获得 1.2s 无敌
    input.keys['KeyW'] = true;

    // 2. 一旦受击（invincibleTimer > 0 且 HP 降至 1），或者到达安全时机，立刻按 K 闪现入圈！
    if (player.invincibleTimer > 0 && !hasBlinkedIn) {
      input.actions.push('skill2'); // 前闪进入护盾内圈
      hasBlinkedIn = true;
      console.log(`Blinked into circle at t=${elapsed.toFixed(3)}s! Player pos: (${player.x.toFixed(1)}, ${player.y.toFixed(1)}), invincibleTimer=${player.invincibleTimer.toFixed(2)}s`);
    }

    // 3. 闪现进圈后，立即开启 L 键力场盾反弹周围弹幕！
    if (hasBlinkedIn && !hasUsedReflect) {
      input.actions.push('skill3');
      hasUsedReflect = true;
      console.log(`Activated L Reflect Shield inside circle at t=${elapsed.toFixed(3)}s!`);
    }

    // 在圈内保持微距输出
    if (hasBlinkedIn) {
      const curDist = Math.hypot(player.x - boss.x, player.y - boss.y);
      if (curDist > 40 && player.y > boss.y + 35) {
        input.keys['KeyW'] = true;
      } else {
        input.keys['KeyW'] = false;
      }
    }

    player.update(dt, input, w, h, boss.bullets);
    boss.update(dt, elapsed, player, { recordHit() {}, getFrequency() { return 4.0; } });

    // 玩家子弹打击判定
    for (const b of player.bullets) {
      if (!b.alive) continue;
      if (!boss.shield.isBroken) {
        const hit = boss.shield.checkBulletCollision(b, null, Date.now());
        if (hit) continue;
        // 如果在护盾内部，允许直接扣除 Boss 核心阶段血量！
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

    if (boss.isDead) {
      bossKilled = true;
      break;
    }
  }

  const success = bossKilled && player.hp >= 1;
  console.log(`[Attempt ${attemptNum} Result] Success: ${success}, Time: ${elapsed.toFixed(3)}s, Player HP: ${player.hp} (Alive: ${player.hp >= 1}), Boss Dead: ${boss.isDead}`);
  return { success, player, boss, elapsed };
}

runSection5Attempt(1, {});
