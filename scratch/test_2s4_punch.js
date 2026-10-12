import { Boss } from '../src/game/Boss.js';
import { Player } from '../src/game/Player.js';
import { STAGE_STRATEGIES } from '../src/tas/strategies.js';

const w = 800;
const h = 800;
const dt = 1 / 60;

function test2s4(speed = 550) {
  const boss = new Boss(w / 2, 130, {
    weakpoints: 4,
    enableBullets: false
  });

  const player = new Player(w / 2, h - 90, boss);
  player.autoFire = true;

  const origUpdate = boss.update.bind(boss);
  boss.update = function(dt, now, p, freqMeter) {
    if (this.shield && !this.shield.isBroken && p && !p.isDead) {
      const distToPlayer = Math.hypot(p.x - this.x, p.y - this.y);
      if (distToPlayer <= this.shield.radius) {
        if (this.invadeTimer + dt >= this.invadeThreshold && !this.springPunchActive) {
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

  const strategy = STAGE_STRATEGIES['2-s4'];
  const state = strategy.init();

  let elapsed = 0;
  let deflects = 0;
  let wpHits = 0;

  globalThis.window = {
    tas: {
      active: true,
      recordBulletShot() {},
      recordBulletHit(phase, type, val, angle) {
        if (type === 'deflect') deflects++;
        if (type === 'wp') wpHits++;
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

  while (elapsed < 10.0 && !boss.isDead && player.hp > 0) {
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
        boss.shield.checkBulletCollision(bullet, freqMeter, elapsed * 1000);
      } else {
        const dist = Math.hypot(bullet.x - boss.x, bullet.y - boss.y);
        if (dist <= boss.radius + 6) {
          bullet.alive = false;
          boss.takeDamage(bullet.damage, freqMeter, elapsed * 1000);
        }
      }
    }
  }

  return { elapsed, bossDead: boss.isDead, hp: player.hp, deflects, wpHits };
}

const res2s4 = test2s4(550);
console.log('2-s4 result:', res2s4);
