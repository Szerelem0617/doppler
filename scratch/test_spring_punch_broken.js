import { Boss } from '../src/game/Boss.js';
import { Player } from '../src/game/Player.js';
import { STAGE_STRATEGIES } from '../src/tas/strategies.js';

const w = 800;
const h = 800;
const dt = 1 / 60;

function runSimulation(p2HoldY = 175, p2DelayEnterTime = 0) {
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

  // 临时开启破盾期间也能释放弹簧拳
  const origUpdate = boss.update.bind(boss);
  boss.update = function(dt, now, p, freqMeter) {
    // 强制允许破盾期间判定入侵
    const wasBroken = this.shield.isBroken;
    // 拦截原逻辑前：如果 isBroken 为 true，临时伪装成 false 来测试，或者直接测试修改后的逻辑
    origUpdate(dt, now, p, freqMeter);
  };

  const strategy = STAGE_STRATEGIES['2-boss'];
  const state = strategy.init();

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

    const inputs = strategy.update({ player, enemy: boss }, elapsed, state);
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

  return { elapsed, isDead: boss.isDead, hp: player.hp, punchHurts, bulletHurts, stats };
}

console.log('Current baseline:', runSimulation());
