import { Boss } from '../src/game/Boss.js';
import { Player } from '../src/game/Player.js';
import { STAGE_STRATEGIES } from '../src/tas/strategies.js';

const w = 800;
const h = 800;
const dt = 1 / 60;

function runTest(p2EnterThresholdHp = 2) {
  const boss = new Boss(w / 2, 130, {
    phaseSequence: [7, 5, 8, 4, 9],
    phaseHps: [7, 7, 8, 9, 11],
    enableBullets: true
  });

  const player = new Player(w / 2, h - 90, boss);
  player.autoFire = true;

  let punchHurts = [];
  let bulletHurts = [];

  const origTakeDamage = player.takeDamage.bind(player);
  player.takeDamage = function(amt) {
    if (this.invincibleTimer > 0) return false;
    if (boss.springPunchActive && boss.springPunchTimer < 0.05) {
      punchHurts.push({ t: elapsed, phase: boss.currentPhaseIndex, hp: player.hp, pos: { x: player.x, y: player.y } });
    } else {
      bulletHurts.push({ t: elapsed, phase: boss.currentPhaseIndex, hp: player.hp, pos: { x: player.x, y: player.y } });
    }
    return origTakeDamage(amt);
  };

  // 临时覆盖 Phase 2 策略
  const origStrategy = STAGE_STRATEGIES['2-boss'];
  const state = origStrategy.init();

  let elapsed = 0;
  let stats = { byPhase: {} };

  globalThis.window = {
    tas: {
      active: true,
      recordBulletShot(phase) {
        if (!stats.byPhase[phase]) stats.byPhase[phase] = { fired: 0, wpHits: 0, coreHits: 0, deflects: 0 };
        stats.byPhase[phase].fired++;
      },
      recordBulletHit(phase, type, val) {
        if (!stats.byPhase[phase]) stats.byPhase[phase] = { fired: 0, wpHits: 0, coreHits: 0, deflects: 0 };
        const p = stats.byPhase[phase];
        if (type === 'wp') p.wpHits++;
        else if (type === 'deflect') p.deflects++;
        else if (type === 'core') p.coreHits += val;
      }
    }
  };

  const inputManager = {
    keys: {},
    skill1Triggered: false,
    consumeSkill1() {
      if (this.skill1Triggered) {
        this.skill1Triggered = false;
        return true;
      }
      return false;
    },
    consumeBlink() { return this.consumeSkill1(); },
    consumeSkill2() { return this.consumeBlink(); },
    consumeShield() { return false; },
    consumeSkill3() { return false; },
    consumeToggleFire() { return false; },
    getMovementVector() {
      let dx = 0, dy = 0;
      if (this.keys['KeyW'] || this.keys['ArrowUp']) dy -= 1;
      if (this.keys['KeyS'] || this.keys['ArrowDown']) dy += 1;
      if (this.keys['KeyA'] || this.keys['ArrowLeft']) dx -= 1;
      if (this.keys['KeyD'] || this.keys['ArrowRight']) dx += 1;
      if (dx !== 0 && dy !== 0) {
        const inv = 0.70710678;
        return { x: dx * inv, y: dy * inv };
      }
      return { x: dx, y: dy };
    }
  };

  const freqMeter = {
    recordHit() {},
    getFrequency() { return 4.0; },
    update() {}
  };

  while (elapsed < 25.0 && !boss.isDead && player.hp > 0) {
    elapsed += dt;
    const phase = boss.currentPhaseIndex;

    const inputs = origStrategy.update({ player, enemy: boss }, elapsed, state);

    // 重点：如果处于 Phase 2 破盾打血量阶段，测试“晚点进圈”
    if (phase === 2 && boss.shield.isBroken && !boss.shield.isShattering) {
      inputs.keys = {};
      const outsideY = boss.y + boss.shield.radius + 6; // 130 + 88 + 6 = 224
      const insideY = boss.y + 45; // 175

      // 当血量大于阈值时，保持在圈外边缘 (outsideY) 灌伤
      // 当血量 <= 阈值时，压入内圈 (insideY)，顺利在阶段末定格在圈内！
      const targetY = (boss.currentPhaseHp <= p2EnterThresholdHp) ? insideY : outsideY;
      const targetX = boss.x;

      if (player.y > targetY + 2) inputs.keys['KeyW'] = true;
      else if (player.y < targetY - 2) inputs.keys['KeyS'] = true;

      if (player.x < targetX - 2) inputs.keys['KeyD'] = true;
      else if (player.x > targetX + 2) inputs.keys['KeyA'] = true;
    }

    if (inputs.actions) {
      for (const act of inputs.actions) {
        if (act === 'skill1' || act === 'skill2' || act === 'blink') {
          inputManager.skill1Triggered = true;
        }
      }
    }
    inputManager.keys = inputs.keys || {};

    player.update(dt, inputManager, w, h, boss.bullets);
    boss.update(dt, elapsed * 1000, player, freqMeter);

    for (const bullet of player.bullets) {
      if (!bullet.alive) continue;
      if (!boss.shield.isBroken) {
        if (player.isInsideShield) {
          const playerDist = Math.hypot(player.x - boss.x, player.y - boss.y);
          if (playerDist <= boss.shield.radius * 0.75) {
            const dist = Math.hypot(bullet.x - boss.x, bullet.y - boss.y);
            if (dist <= boss.radius + 6) {
              bullet.alive = false;
              boss.takeDamage(1, freqMeter, elapsed * 1000);
              continue;
            }
            continue;
          }
        }
        boss.shield.checkBulletCollision(bullet, freqMeter, elapsed * 1000);
      } else {
        const dist = Math.hypot(bullet.x - boss.x, bullet.y - boss.y);
        if (dist <= boss.radius + 6) {
          bullet.alive = false;
          boss.takeDamage(1, freqMeter, elapsed * 1000);
        }
      }
    }
  }

  const defTotal = Object.values(stats.byPhase).reduce((sum, p) => sum + p.deflects, 0);
  return {
    threshold: p2EnterThresholdHp,
    elapsed: elapsed.toFixed(2),
    isDead: boss.isDead,
    hp: player.hp,
    deflects: defTotal,
    punchHurts,
    bulletHurts,
    stats: stats.byPhase
  };
}

for (let th of [1, 2, 3, 4]) {
  console.log(`Testing threshold ${th}:`, runTest(th));
}
