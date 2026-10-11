import { Boss } from '../src/game/Boss.js';
import { Player } from '../src/game/Player.js';
import { STAGE_STRATEGIES } from '../src/tas/strategies.js';

const w = 800;
const h = 800;
const dt = 1 / 60;

function testStrategy(targetX) {
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
  let p4StartTime = null;

  let totalFired = 0;
  let stats = {
    byPhase: {}
  };

  function recordHit(phase, type, val, angle) {
    if (!stats.byPhase[phase]) {
      stats.byPhase[phase] = { fired: 0, wpHits: 0, coreHits: 0, deflects: 0, shatters: 0 };
    }
    const p = stats.byPhase[phase];
    if (type === 'wp') p.wpHits++;
    else if (type === 'deflect') p.deflects++;
    else if (type === 'shatter') p.shatters++;
    else if (type === 'core') p.coreHits += val;
  }

  globalThis.window = {
    tas: {
      active: true,
      recordBulletShot(phase) {
        if (!stats.byPhase[phase]) {
          stats.byPhase[phase] = { fired: 0, wpHits: 0, coreHits: 0, deflects: 0, shatters: 0 };
        }
        stats.byPhase[phase].fired++;
        totalFired++;
      },
      recordBulletHit(phase, type, val, angle) {
        recordHit(phase, type, val, angle);
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

  while (elapsed < 23.0 && !boss.isDead && player.hp > 0) {
    elapsed += dt;
    const phase = boss.currentPhaseIndex;
    if (phase === 4 && p4StartTime === null) {
      p4StartTime = elapsed;
    }

    // Override Phase 4 strategy
    let inputs;
    if (phase === 4) {
      const p4Time = elapsed - p4StartTime;
      inputs = { keys: {}, actions: [] };
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

          if (player.x > targetX + 3) inputs.keys['KeyA'] = true;
          else if (player.x < targetX - 3) inputs.keys['KeyD'] = true;
        } else if (boss.shield.isBroken || boss.shield.isShattering) {
          inputs.keys['KeyW'] = true;
        } else if (state.p4ShieldRestoredTime) {
          if (!state.p4Blinked) {
            inputs.actions.push('skill2');
            state.p4Blinked = true;
          }
        }
      }
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

  return { targetX, elapsed, bossDead: boss.isDead, hp: player.hp, stats, totalFired };
}

const res = testStrategy(338);
console.log('Result for targetX = 338:');
console.log(`- Total Time: ${res.elapsed.toFixed(2)}s`);
console.log(`- Player HP: ${res.hp}/3`);
console.log(`- Boss Dead: ${res.bossDead}`);
console.log(`- Total Shots: ${res.totalFired}`);
console.log('Stats by Phase:');
console.table(res.stats.byPhase);
