import { Boss } from '../src/game/Boss.js';
import { Player } from '../src/game/Player.js';
import { STAGE_STRATEGIES } from '../src/tas/strategies.js';

const w = 800;
const h = 800;
const dt = 1 / 60;

function testNewPunchMechanism(speed = 550) {
  const boss = new Boss(w / 2, 130, {
    phaseSequence: [7, 5, 8, 4, 9],
    phaseHps: [7, 7, 8, 9, 11],
    enableBullets: true
  });

  const player = new Player(w / 2, h - 90, boss);
  player.autoFire = true;

  // Override boss update spring punch
  const origUpdate = boss.update.bind(boss);
  boss.update = function(dt, now, p, freqMeter) {
    if (this.shield && !this.shield.isBroken && p && !p.isDead) {
      const distToPlayer = Math.hypot(p.x - this.x, p.y - this.y);
      if (distToPlayer <= this.shield.radius) {
        if (this.invadeTimer + dt >= this.invadeThreshold && !this.springPunchActive) {
          // Custom Spring Punch Logic: Knock back to edge at constant speed
          this.invadeTimer = 0;
          this.springPunchActive = true;
          this.springPunchTimer = 0;
          this.springPunchStart = { x: this.x, y: this.y };
          this.springPunchTarget = { x: p.x, y: p.y };

          p.takeDamage(1);

          const dx = p.x - this.x;
          const dy = p.y - this.y;
          let len = Math.hypot(dx, dy);
          const ux = len > 0.001 ? dx / len : 0;
          const uy = len > 0.001 ? dy / len : 1;

          const pad = 36;
          let distToEdge = Infinity;
          if (ux > 0.001) distToEdge = Math.min(distToEdge, (w - pad - p.x) / ux);
          else if (ux < -0.001) distToEdge = Math.min(distToEdge, (pad - p.x) / ux);

          if (uy > 0.001) distToEdge = Math.min(distToEdge, (h - pad - p.y) / uy);
          else if (uy < -0.001) distToEdge = Math.min(distToEdge, (pad - p.y) / uy);

          if (!isFinite(distToEdge) || distToEdge <= 0) distToEdge = 550;
          const duration = distToEdge / speed;

          p.applyKnockback(ux, uy, speed, duration, 'CONSTANT');
          return;
        }
      }
    }
    return origUpdate(dt, now, p, freqMeter);
  };

  // Also in Player.update: if player reaches edge, stop knockback
  const origPlayerUpdate = player.update.bind(player);
  player.update = function(dt, input, canvasWidth, canvasHeight, bossBullets) {
    const res = origPlayerUpdate(dt, input, canvasWidth, canvasHeight, bossBullets);
    const pad = 36;
    if (this.isKnockedBack) {
      if (this.x <= pad + 1 || this.x >= canvasWidth - pad - 1 || this.y <= pad + 1 || this.y >= canvasHeight - pad - 1) {
        this.isKnockedBack = false;
        this.knockbackVx = 0;
        this.knockbackVy = 0;
        this.knockbackTimer = 0;
      }
    }
    return res;
  };

  const strategy = STAGE_STRATEGIES['2-boss'];
  const state = strategy.init();

  let elapsed = 0;
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

  while (elapsed < 25.0 && !boss.isDead && player.hp > 0) {
    elapsed += dt;
    const phase = boss.currentPhaseIndex;

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

  return { speed, elapsed, bossDead: boss.isDead, hp: player.hp, stats };
}

const res = testNewPunchMechanism(550);
console.log('New Punch Mechanism at speed 550:');
console.log(`- Time: ${res.elapsed.toFixed(2)}s`);
console.log(`- Boss Dead: ${res.bossDead}`);
console.log(`- Player HP: ${res.hp}/3`);
console.table(res.stats.byPhase);
