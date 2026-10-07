import { Boss } from '../src/game/Boss.js';
import { Player } from '../src/game/Player.js';

console.log('==============================================');
console.log(' SECTION 5 TRIAL - ATTEMPT 2');
console.log(' Using direct shield core warp (move={0,0} on K)');
console.log('==============================================');

const w = 800;
const h = 800;
const dt = 1 / 60;

function runSection5Attempt2() {
  const boss = new Boss(w / 2, 130, {
    phaseSequence: [7, 5, 8, 4, 9],
    phaseHps: [7, 7, 8, 9, 11],
    enableBullets: true
  });
  boss.currentPhaseIndex = 4;
  boss.currentPhaseHp = 11;
  boss.shield.setConfiguration(9, 2.8);
  boss.firePhase5SpawnBarrage();

  const player = new Player(400, 480, boss);
  player.hp = 2;
  player.autoFire = true;
  player.skill1CdTimer = 0;
  player.skill2CdTimer = 0;

  let elapsed = 0;
  let hasBlinkedIn = false;
  let hasUsedReflect = false;
  let bossKilled = false;

  while (elapsed < 5.0 && !boss.isDead && player.hp > 0) {
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
    if (!hasBlinkedIn) {
      if (player.invincibleTimer > 0) {
        // 受到伤害触发无敌后，静止瞬移直插护盾核心内部！
        input.actions.push('skill2');
        hasBlinkedIn = true;
      } else {
        input.keys['KeyW'] = true;
      }
    } else {
      // 2. 闪现进圈后，立即开启 L 反弹护盾并贴脸输出！
      if (!hasUsedReflect) {
        input.actions.push('skill3');
        hasUsedReflect = true;
        console.log(`Blinked directly into circle! Player pos: (${player.x.toFixed(1)}, ${player.y.toFixed(1)}), DistToBoss: ${Math.hypot(player.x - boss.x, player.y - boss.y).toFixed(1)}px`);
      }
      // 保持在圈内贴脸微距
    }

    player.update(dt, input, w, h, boss.bullets);
    boss.update(dt, elapsed, player, { recordHit() {}, getFrequency() { return 4.0; } });

    // 玩家子弹打击判定
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

    if (boss.isDead) {
      bossKilled = true;
      break;
    }
  }

  const success = bossKilled && player.hp >= 1;
  console.log(`[Attempt 2 Result] Success: ${success}, Time: ${elapsed.toFixed(3)}s, Player HP: ${player.hp} (Alive: ${player.hp >= 1}), Boss Dead: ${boss.isDead}`);
  return { success, player, boss, elapsed };
}

runSection5Attempt2();
