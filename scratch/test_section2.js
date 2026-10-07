import { Boss } from '../src/game/Boss.js';
import { Player } from '../src/game/Player.js';
import { Bullet } from '../src/game/Bullet.js';

console.log('==============================================');
console.log(' SECTION 2 TRIAL (Phase 1: 5 WP, 7 HP)');
console.log(' Plan: 前置位S后撤+A环绕破5盾 -> 破盾开L立场补齐7血');
console.log('==============================================');

const w = 800;
const h = 800;
const dt = 1 / 60;

// Run Section 1 first to get authentic checkpoint
function getSection1Checkpoint() {
  const boss = new Boss(w / 2, 130, {
    phaseSequence: [7, 5, 8, 4, 9],
    phaseHps: [7, 7, 8, 9, 11],
    enableBullets: true
  });
  const player = new Player(w / 2, h - 90, boss);
  player.autoFire = true;

  let elapsed = 0;
  let hasBlinked = false;

  while (elapsed < 5.0 && boss.currentPhaseIndex < 1) {
    elapsed += dt;
    const input = {
      keys: {},
      actions: [],
      consumeSkill2() { return this.actions.includes('skill2'); },
      consumeSkill3() { return false; },
      getMovementVector() {
        let x = 0, y = 0;
        if (this.keys['KeyW']) y -= 1;
        if (this.keys['KeyS']) y += 1;
        return { x, y };
      }
    };

    if (!boss.shield.isBroken && !boss.shield.isShattering) {
      input.keys['KeyW'] = true;
    } else if ((boss.shield.isShattering || boss.shield.isBroken) && !hasBlinked) {
      input.keys['KeyS'] = true;
      input.actions.push('skill2');
      hasBlinked = true;
    } else {
      input.keys['KeyW'] = true;
    }

    player.update(dt, input, w, h, boss.bullets);
    boss.update(dt, elapsed, player, { recordHit() {}, getFrequency() { return 4.0; } });

    for (const b of player.bullets) {
      if (!b.alive) continue;
      if (!boss.shield.isBroken) {
        if (boss.shield.checkBulletCollision(b, null, Date.now())) continue;
      } else {
        if (Math.hypot(b.x - boss.x, b.y - boss.y) <= boss.radius + 6) {
          b.alive = false;
          boss.takeDamage(1, null, Date.now());
        }
      }
    }
  }

  // Refresh skill cooldowns on phase transition as planned
  player.skill1CdTimer = 0;
  player.skill2CdTimer = 0;

  return { player, boss, elapsed };
}

function runSection2Attempt(attemptNum, params = {}) {
  const cp = getSection1Checkpoint();
  const player = cp.player;
  const boss = cp.boss;
  let elapsed = cp.elapsed;
  const startElapsed = elapsed;

  console.log(`[Attempt ${attemptNum} Start] Player pos: (${player.x.toFixed(1)}, ${player.y.toFixed(1)}), Boss Phase: ${boss.currentPhaseIndex}, Boss HP: ${boss.currentPhaseHp}`);

  let maxTime = startElapsed + 6.0;
  let phase1Completed = false;
  let hasUsedShield = false;

  while (elapsed < maxTime) {
    elapsed += dt;
    const phaseTime = elapsed - startElapsed;

    const input = {
      keys: {},
      actions: [],
      consumeSkill2() { return false; },
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

    // 破盾阶段：向后 (KeyS) + 环绕 (KeyA 或 KeyD)
    if (!boss.shield.isBroken && !boss.shield.isShattering) {
      input.keys['KeyS'] = true;
      input.keys['KeyA'] = true;
    }
    // 碎盾过载阶段：继续向后
    else if (boss.shield.isShattering) {
      input.keys['KeyS'] = true;
    }
    // 伤害阶段：开 L 护盾 + 稳定后撤/不动补齐输出
    else {
      if (!hasUsedShield) {
        input.actions.push('skill3');
        hasUsedShield = true;
      }
      if (params.damageMove === 'HOLD') {
        // 不动
      } else {
        input.keys['KeyS'] = true;
      }
    }

    player.update(dt, input, w, h, boss.bullets);
    boss.update(dt, elapsed, player, { recordHit() {}, getFrequency() { return 4.0; } });

    // Collisions
    for (const b of player.bullets) {
      if (!b.alive) continue;
      if (!boss.shield.isBroken) {
        const hit = boss.shield.checkBulletCollision(b, null, Date.now());
        if (hit) continue;
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

    if (boss.currentPhaseIndex >= 2) {
      phase1Completed = true;
      break;
    }
  }

  const success = phase1Completed && player.hp === 3;
  console.log(`[Attempt ${attemptNum} Result] Success: ${success}, Duration: ${(elapsed - startElapsed).toFixed(3)}s, Player HP: ${player.hp}, Boss Phase: ${boss.currentPhaseIndex}, EndPos: (${player.x.toFixed(1)}, ${player.y.toFixed(1)})`);
  return { success, player, boss, elapsed };
}

// Attempt 1
const res1 = runSection2Attempt(1, { damageMove: 'S' });
if (res1.success) {
  console.log('>>> Section 2 SUCCESS on Attempt 1! <<<');
} else {
  console.log('Section 2 Attempt 1 failed. Trying Attempt 2 with damageMove = HOLD...');
  const res2 = runSection2Attempt(2, { damageMove: 'HOLD' });
  if (res2.success) {
    console.log('>>> Section 2 SUCCESS on Attempt 2! <<<');
  }
}
