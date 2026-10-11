import { Boss } from '../src/game/Boss.js';
import { Player } from '../src/game/Player.js';
import { STAGE_STRATEGIES } from '../src/tas/strategies.js';

const w = 800;
const h = 800;
const dt = 1 / 60;

function evaluateDetail(p4Fn) {
  const boss = new Boss(w / 2, 130, {
    phaseSequence: [7, 5, 8, 4, 9],
    phaseHps: [7, 7, 8, 9, 11],
    enableBullets: true
  });

  const player = new Player(w / 2, h - 90, boss);
  player.autoFire = true;

  const strategy = STAGE_STRATEGIES['2-boss'];
  const state = strategy.init();

  let elapsed = 0;
  let p4Logs = [];
  let p4StartTime = null;

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
    consumeSkill2() { return false; },
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

  globalThis.window = {
    tas: {
      active: true,
      recordBulletShot(phase) {},
      recordBulletHit(phase, type, val, angle) {
        if (phase === 4) {
          p4Logs.push({ t: elapsed, type, val, angle: (angle * 180 / Math.PI).toFixed(1) });
        }
      }
    }
  };

  while (elapsed < 23.0 && !boss.isDead && player.hp > 0) {
    elapsed += dt;
    const phase = boss.currentPhaseIndex;
    if (phase === 4 && p4StartTime === null) {
      p4StartTime = elapsed;
    }

    let inputs;
    if (phase === 4) {
      inputs = p4Fn({ player, boss, elapsed, p4Time: elapsed - p4StartTime, state });
    } else {
      inputs = strategy.update({ player, enemy: boss }, elapsed, state);
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

  const deflects = p4Logs.filter(l => l.type === 'deflect');
  return { elapsed, bossDead: boss.isDead, hp: player.hp, deflects: deflects.length, logs: p4Logs };
}

// Fine-grained sweep of targetX from 260 to 390
console.log('--- SWEEPING targetX FROM 260 TO 390 ---');
for (let tx = 260; tx <= 390; tx += 5) {
  const res = evaluateDetail(({ player, boss, elapsed, p4Time, state }) => {
    const inputs = { keys: {}, actions: [] };
    if (boss.shield.isBroken) {
      state.p4ShieldWasBroken = true;
    }
    if (state.p4ShieldWasBroken && !boss.shield.isBroken && !state.p4ShieldRestoredTime) {
      state.p4ShieldRestoredTime = elapsed;
    }

    const punchDelay = boss.invadeThreshold || 0.44;
    if (p4Time < punchDelay) {
      inputs.keys['KeyW'] = true;
    } else if (p4Time >= punchDelay + 0.05) {
      if (!boss.shield.isBroken && !boss.shield.isShattering && !state.p4ShieldWasBroken) {
        const holdY = 540;
        if (player.y < holdY - 4) inputs.keys['KeyS'] = true;
        else if (player.y > holdY + 4) inputs.keys['KeyW'] = true;

        if (player.x > tx + 3) inputs.keys['KeyA'] = true;
        else if (player.x < tx - 3) inputs.keys['KeyD'] = true;
      } else if (boss.shield.isBroken || boss.shield.isShattering) {
        inputs.keys['KeyW'] = true;
      } else if (state.p4ShieldRestoredTime) {
        if (!state.p4Blinked) {
          inputs.actions.push('skill2');
          state.p4Blinked = true;
        }
      }
    }
    return inputs;
  });

  console.log(`tx=${tx}: Deflects=${res.deflects}, Time=${res.elapsed.toFixed(2)}s`);
  if (res.deflects === 0) {
    console.log(`>>> ZERO DEFLECTS FOUND AT tx=${tx}! <<<`);
    console.log(res.logs);
  }
}
