import { Boss } from '../src/game/Boss.js';
import { Player } from '../src/game/Player.js';

console.log('--- Testing Phase 5 Rapid Core Reflection ---');

const w = 800;
const h = 800;
const dt = 1 / 60;

const boss = new Boss(w / 2, 130, {
  phaseSequence: [7, 5, 8, 4, 9],
  phaseHps: [7, 7, 8, 9, 11],
  enableBullets: true
});
boss.currentPhaseIndex = 4;
boss.currentPhaseHp = 11;
boss.shield.setConfiguration(9, 2.8);
boss.firePhase5SpawnBarrage();

// Test with Phase 5 rapid radial bursts (interval 0.25s)
boss.radialInterval = 0.25;
boss.radialTimer = 0.20; // Pre-warmed

const player = new Player(400, 480, boss);
player.hp = 2;
player.autoFire = true;
player.skill1CdTimer = 0;
player.skill2CdTimer = 0;

let elapsed = 0;
let hasBlinkedIn = false;
let hasUsedReflect = false;
let bossDied = false;

while (elapsed < 3.0 && !boss.isDead && player.hp > 0) {
  elapsed += dt;

  const input = {
    keys: {},
    actions: [],
    consumeSkill2() {
      const idx = this.actions.indexOf('skill2');
      if (idx !== -1) { this.actions.splice(idx, 1); return true; }
      return false;
    },
    consumeSkill3() {
      const idx = this.actions.indexOf('skill3');
      if (idx !== -1) { this.actions.splice(idx, 1); return true; }
      return false;
    },
    getMovementVector() { return { x: 0, y: 0 }; }
  };

  // 1. 前冲吃弹获得无敌
  if (!hasBlinkedIn) {
    if (player.invincibleTimer > 0) {
      input.actions.push('skill2'); // 瞬移进圈
      hasBlinkedIn = true;
    } else {
      input.keys['KeyW'] = true;
    }
  } else {
    // 2. 进圈瞬间开 L 护盾反弹！
    if (!hasUsedReflect) {
      input.actions.push('skill3');
      hasUsedReflect = true;
      console.log(`Blinked into circle at t=${elapsed.toFixed(3)}s! Activated L shield!`);
    }
  }

  player.update(dt, input, w, h, boss.bullets);
  boss.update(dt, elapsed, player, { recordHit() {}, getFrequency() { return 4.0; } });

  // 玩家激光伤害
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
    bossDied = true;
    break;
  }
}

console.log(`Phase 5 Result:
  Boss Dead: ${boss.isDead}
  Player Alive: ${player.hp > 0} (HP = ${player.hp})
  Elapsed Time: ${elapsed.toFixed(3)}s
  Remaining Phase HP: ${boss.currentPhaseHp}
  SUCCESS: ${boss.isDead && player.hp > 0}
`);
