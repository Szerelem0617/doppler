import { Boss } from '../src/game/Boss.js';
import { Player } from '../src/game/Player.js';
import { STAGE_STRATEGIES } from '../src/tas/strategies.js';

const w = 800;
const h = 800;
const dt = 1 / 60;

function runDetailP4(p4TargetX = 338, enterThreshold = 2) {
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
  let p4Deflects = 0;
  let p4WpHits = 0;
  let p4CoreHits = 0;

  globalThis.window = {
    tas: {
      active: true,
      recordBulletShot(phase) {},
      recordBulletHit(phase, type, val, angle) {
        if (phase === 4) {
          if (type === 'wp') p4WpHits++;
          else if (type === 'deflect') {
            p4Deflects++;
            console.log(`P4 Deflect at t=${elapsed.toFixed(3)}, playerX=${player.x.toFixed(1)}, playerY=${player.y.toFixed(1)}, angle=${angle ? angle.toFixed(3) : ''}`);
          }
          else if (type === 'core') p4CoreHits += val;
        }
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

  const freqMeter = { recordHit() {}, getFrequency() { return 4.0; }, update() {} };

  while (elapsed < 25.0 && !boss.isDead && player.hp > 0) {
    elapsed += dt;
    const phase = boss.currentPhaseIndex;
    const inputs = strategy.update({ player, enemy: boss }, elapsed, state);

    if (phase === 2 && boss.shield.isBroken) {
      inputs.keys = {};
      if (boss.currentPhaseHp > enterThreshold) {
        const safeY = 36;
        if (player.y > safeY + 2) inputs.keys['KeyW'] = true;
        else if (player.y < safeY - 2) inputs.keys['KeyS'] = true;
      } else {
        const targetY = boss.y + 45; // 175
        if (player.y > targetY + 2) inputs.keys['KeyW'] = true;
        else if (player.y < targetY - 2) inputs.keys['KeyS'] = true;
      }
      if (player.x < boss.x - 2) inputs.keys['KeyD'] = true;
      else if (player.x > boss.x + 2) inputs.keys['KeyA'] = true;
    }

    if (phase === 4) {
      const p4Time = state.p4StartTime ? elapsed - state.p4StartTime : 0;
      const punchDelay = boss.invadeThreshold || 0.44;
      if (p4Time >= punchDelay + 0.05 && !boss.shield.isBroken && !boss.shield.isShattering && !state.p4ShieldWasBroken) {
        inputs.keys['KeyA'] = false;
        inputs.keys['KeyD'] = false;
        if (player.x > p4TargetX + 3) inputs.keys['KeyA'] = true;
        else if (player.x < p4TargetX - 3) inputs.keys['KeyD'] = true;
      }
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

  return { p4TargetX, elapsed: elapsed.toFixed(2), isDead: boss.isDead, hp: player.hp, p4Deflects, p4WpHits, p4CoreHits };
}

for (let x = 320; x <= 360; x += 2) {
  const res = runDetailP4(x, 2);
  if (res.isDead && res.p4Deflects === 0) {
    console.log(`>>> FOUND 0 DEFLECTS! targetX=${x}:`, res);
  }
}
