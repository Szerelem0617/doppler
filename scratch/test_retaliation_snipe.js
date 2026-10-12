import { Boss } from '../src/game/Boss.js';
import { Player } from '../src/game/Player.js';
import { STAGE_STRATEGIES } from '../src/tas/strategies.js';
import { BossBullet } from '../src/game/BossBullet.js';

const w = 800;
const h = 800;
const dt = 1 / 60;

function runSimulation(attackConfig, tasModifier) {
  const boss = new Boss(w / 2, 130, {
    phaseSequence: [7, 5, 8, 4, 9],
    phaseHps: [7, 7, 8, 9, 11],
    enableBullets: true
  });

  const player = new Player(w / 2, h - 90, boss);
  player.autoFire = true;

  let bulletHurts = [];
  let punchHurts = [];

  const origPlayerTakeDamage = player.takeDamage.bind(player);
  player.takeDamage = function(amount = 1) {
    if (this.invincibleTimer > 0) return false;
    if (boss.springPunchActive && boss.springPunchTimer < 0.05) {
      punchHurts.push({ t: elapsed, phase: boss.currentPhaseIndex, hp: player.hp });
    } else {
      bulletHurts.push({ t: elapsed, phase: boss.currentPhaseIndex, hp: player.hp, pos: { x: player.x.toFixed(1), y: player.y.toFixed(1) } });
    }
    return origPlayerTakeDamage(amount);
  };

  boss.brokenAttackTimer = 0;
  const origBossUpdate = boss.update.bind(boss);
  boss.update = function(dt, now, p, freqMeter) {
    origBossUpdate(dt, now, p, freqMeter);

    if (this.shield && this.shield.isBroken && !this.isDead && this.enableBullets) {
      this.brokenAttackTimer = (this.brokenAttackTimer || 0) + dt;
      if (this.brokenAttackTimer >= attackConfig.interval) {
        this.brokenAttackTimer = -999; // 每次破盾触发一轮标志性自卫反扑
        attackConfig.fire(this, p);
      }
    } else {
      this.brokenAttackTimer = 0;
    }
  };

  const strategy = STAGE_STRATEGIES['2-boss'];
  const state = strategy.init();

  let elapsed = 0;
  let stats = { byPhase: {} };

  globalThis.window = {
    tas: {
      active: true,
      recordBulletShot(phase) {
        if (!stats.byPhase[phase]) stats.byPhase[phase] = { fired: 0, wpHits: 0, coreHits: 0, deflects: 0, shatters: 0 };
        stats.byPhase[phase].fired++;
      },
      recordBulletHit(phase, type, val, angle) {
        if (!stats.byPhase[phase]) stats.byPhase[phase] = { fired: 0, wpHits: 0, coreHits: 0, deflects: 0, shatters: 0 };
        const p = stats.byPhase[phase];
        if (type === 'wp') p.wpHits++;
        else if (type === 'deflect') p.deflects++;
        else if (type === 'shatter') p.shatters++;
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

    let inputs = strategy.update({ player, enemy: boss }, elapsed, state);
    if (tasModifier) {
      inputs = tasModifier({ inputs, player, enemy: boss, elapsed, phase, state });
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
  return { elapsed, bossDead: boss.isDead, hp: player.hp, defTotal, punchHurts, bulletHurts, stats };
}

// Retaliation Attack Specification:
// When shield breaks, after 0.55s, Boss fires an emergency defense lance:
// 3 bullets at speed 290 px/s with offsets [-0.35, 0, 0.35] rad
const attackConfig = {
  interval: 0.55,
  fire(boss, player) {
    if (!player) return;
    const dx = player.x - boss.x;
    const dy = player.y - boss.y;
    const angle = Math.atan2(dy, dx);
    const speed = 290;
    [-0.35, 0, 0.35].forEach(offset => {
      const a = angle + offset;
      boss.bullets.push(new BossBullet(boss.x, boss.y, Math.cos(a) * speed, Math.sin(a) * speed));
    });
  }
};

// Test with TAS dodging
const res = runSimulation(attackConfig, ({ inputs, player, enemy, elapsed, phase, state }) => {
  // Let's see what happens if we tune each phase's broken shield movement
  if (enemy.shield && enemy.shield.isBroken) {
    if (phase === 0) {
      // Phase 0: already has dodge in base strategy:
      // if (elapsed >= 2.4 && elapsed <= 2.85) inputs.keys['KeyD'] = true;
    } else if (phase === 1) {
      // Phase 1: already has dodge in base strategy:
      // if (player.y < 350 && player.x < 430) inputs.keys['KeyD'] = true;
    } else if (phase === 2) {
      // In Phase 2: player charges forward to targetY = enemy.y + 45.
      // S-curve dodge: when charging in, micro-tap KeyD for 0.25s then re-center
      const p2Time = state.p2StartTime ? elapsed - state.p2StartTime : 0;
      if (p2Time >= 2.0 && p2Time <= 2.3) {
        inputs.keys['KeyD'] = true;
      }
    } else if (phase === 3) {
      // In Phase 3: player charges up from bottom edge (y=764) to targetY = enemy.y + 45.
      // Micro-tap KeyD when crossing y=400-300
      if (player.y > 280 && player.y < 420) {
        inputs.keys['KeyD'] = true;
      }
    } else if (phase === 4) {
      // In Phase 4: player is at targetX = 338 (offset left by 62px from 400).
      // Since player is at x=338, player is already to the left of the central beam!
      // Keep straight W charge!
    }
  }
  return inputs;
});

console.log('Result with Micro-Dodge:');
console.log(`- Time: ${res.elapsed.toFixed(2)}s`);
console.log(`- Boss Dead: ${res.bossDead}`);
console.log(`- Player HP: ${res.hp}/3`);
console.log(`- Deflects: ${res.defTotal}`);
console.log(`- Punch Hurts: ${res.punchHurts.length}`);
console.log(`- Bullet Hurts: ${res.bulletHurts.length}`);
if (res.bulletHurts.length > 0) {
  console.log('Bullet Hurt Details:', res.bulletHurts);
}
console.table(res.stats.byPhase);
