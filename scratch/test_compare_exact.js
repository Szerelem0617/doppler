import { Boss } from '../src/game/Boss.js';
import { Player } from '../src/game/Player.js';
import { STAGE_STRATEGIES } from '../src/tas/strategies.js';

const w = 800;
const h = 800;
const dt = 1 / 60;

function runSim(p4StrategyFn) {
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
  let p4Hits = [];
  let p4Deflects = [];
  let p4CoreHits = 0;

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

  while (elapsed < 25.0 && !boss.isDead && player.hp > 0) {
    elapsed += dt;
    const phase = boss.currentPhaseIndex;

    // Strategy input injection
    let inputs;
    if (phase === 4 && p4StrategyFn) {
      inputs = p4StrategyFn({ player, boss, elapsed, state });
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

    // Bullet collisions matching main.js exactly
    for (const bullet of player.bullets) {
      if (!bullet.alive) continue;

      if (!boss.shield.isBroken) {
        if (player.isInsideShield) {
          const playerDist = Math.hypot(player.x - boss.x, player.y - boss.y);
          if (playerDist <= boss.shield.radius * 0.75) {
            const dist = Math.hypot(bullet.x - boss.x, bullet.y - boss.y);
            if (dist <= boss.radius + 6) {
              bullet.alive = false;
              if (phase === 4) p4CoreHits++;
              boss.takeDamage(1, freqMeter, elapsed * 1000);
              continue;
            }
            continue;
          }
        }

        const prevAlive = bullet.alive;
        const hitShield = boss.shield.checkBulletCollision(bullet, freqMeter, elapsed * 1000);
        if (hitShield) {
          // Check if it hit a weakpoint or deflected
          // Shield.js calls window.tas.recordBulletHit if window.tas exists
        }
      } else {
        const dist = Math.hypot(bullet.x - boss.x, bullet.y - boss.y);
        if (dist <= boss.radius + 6) {
          bullet.alive = false;
          if (phase === 4) p4CoreHits++;
          boss.takeDamage(1, freqMeter, elapsed * 1000);
        }
      }
    }
  }

  return { elapsed, bossDead: boss.isDead, hp: player.hp };
}

// First run baseline
globalThis.window = {
  tas: {
    active: true,
    recordBulletShot(phase) {},
    recordBulletHit(phase, type, val, angle) {
      if (phase === 4) {
        console.log(`[P4 Log in Node] type=${type}, val=${val}, angle=${(angle * 180 / Math.PI).toFixed(1)}°`);
      }
    }
  }
};

const res = runSim(null);
console.log('Baseline Node Sim Result:', res);
