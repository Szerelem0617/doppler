import { Boss } from '../src/game/Boss.js';
import { Player } from '../src/game/Player.js';
import { BossBullet } from '../src/game/BossBullet.js';

console.log('=== TUNING 5-PHASE TAS WITH UNINTERRUPTED BULLETS & 1.45s RECHARGE ===');

function simulateRun(params = {}) {
  const boss = new Boss(400, 130, {
    phaseSequence: [7, 5, 8, 4, 9],
    phaseHps: [7, 7, 8, 9, 11],
    enableBullets: true
  });
  boss.shield.rechargeDuration = 1.45;

  boss.update = function(dt, timestamp, player, frequencyMeter) {
    if (this.isDead) return;
    this.rotation += 1.2 * dt;
    if (this.hitFlashTimer > 0) this.hitFlashTimer -= dt;

    const shieldWasBroken = this.shield.isBroken;
    this.shield.update(dt, player);
    if (shieldWasBroken && !this.shield.isBroken) {
      const currentShieldCount = this.phaseWeakpoints ? this.phaseWeakpoints[this.currentPhaseIndex] : this.initialWeakpoints;
      this.shield.setConfiguration(currentShieldCount, 1.45);
    }

    for (let i = this.bullets.length - 1; i >= 0 && !this.isDead; i--) {
      const b = this.bullets[i];
      if (!b) continue;
      b.update(dt, this, player);

      if (b.isReflected && b.alive) {
        const dx = b.x - this.x;
        const dy = b.y - this.y;
        const dist = Math.hypot(dx, dy);
        if (this.shield && !this.shield.isBroken) {
          if (dist <= this.shield.radius + 8) {
            b.alive = false;
            continue;
          }
        } else {
          if (dist <= this.radius + 8) {
            b.alive = false;
            const dmg = this.phaseHps ? 1 : b.damage;
            this.takeDamage(dmg, frequencyMeter, timestamp);
            if (this.isDead) break;
          }
        }
      }
      if (!b.alive) this.bullets.splice(i, 1);
    }

    // Attacks uninterrupted:
    if (this.enableBullets) {
      const curRadialInterval = (this.currentPhaseIndex === 4) ? 0.12 : this.radialInterval;
      const curSnipeInterval = (this.currentPhaseIndex === 4) ? 0.25 : this.snipeInterval;
      this.radialTimer += dt;
      if (this.radialTimer >= curRadialInterval) {
        this.fireRadialBurst();
        this.radialTimer = 0;
      }
      this.snipeTimer += dt;
      if (this.snipeTimer >= curSnipeInterval) {
        this.fireSnipeLance(player);
        this.snipeTimer = 0;
      }
    }
  };

  const player = new Player(400, 710, boss);
  player.autoFire = true;
  const origDmg = player.takeDamage.bind(player);
  player.takeDamage = function(d) {
    console.log(`[HURT] t=${elapsed.toFixed(3)}s, phase=${boss.currentPhaseIndex}, pos=(${player.x.toFixed(1)}, ${player.y.toFixed(1)}), hp=${player.hp}->${player.hp-d}`);
    return origDmg(d);
  };

  let elapsed = 0;
  const dt = 1/60;
  const state = {
    p0Blinked: false,
    p1ShieldUsed: false,
    p1StartTime: null,
    p2Blinked: false,
    p2StartTime: null,
    p3Blinked: false,
    p3StartTime: null,
    p4Blinked: false,
    p4ShieldUsed: false,
    p4StartTime: null
  };
  let currentPhaseTracked = -1;

  while (elapsed < 16.0 && !boss.isDead && player.hp > 0) {
    elapsed += dt;
    const phase = boss.currentPhaseIndex;
    if (phase !== currentPhaseTracked) {
      currentPhaseTracked = phase;
      player.skill1CdTimer = 0;
      player.skill2CdTimer = 0;
      if (phase === 1) state.p1StartTime = elapsed;
      if (phase === 2) state.p2StartTime = elapsed;
      if (phase === 3) state.p3StartTime = elapsed;
      if (phase === 4) state.p4StartTime = elapsed;
    }

    const input = {
      keys: {},
      actions: [],
      consumeSkill2() { const i = this.actions.indexOf('skill2'); if (i !== -1) { this.actions.splice(i, 1); return true; } return false; },
      consumeSkill3() { const i = this.actions.indexOf('skill3'); if (i !== -1) { this.actions.splice(i, 1); return true; } return false; },
      getMovementVector() {
        let x = 0, y = 0;
        if (this.keys['KeyW']) y -= 1;
        if (this.keys['KeyS']) y += 1;
        if (this.keys['KeyA']) x -= 1;
        if (this.keys['KeyD']) x += 1;
        return { x, y };
      }
    };

    // Phase 0: 7 WP, 7 HP
    if (phase === 0) {
      if (!boss.shield.isBroken && !boss.shield.isShattering) {
        // slight drift to avoid center bullet
        input.keys['KeyW'] = true;
        if (elapsed >= 1.6 && elapsed < 2.0) input.keys['KeyD'] = true;
      } else if (!state.p0Blinked) {
        input.keys['KeyS'] = true;
        input.actions.push('skill2');
        state.p0Blinked = true;
      } else {
        input.keys['KeyW'] = true;
        if (player.x > 401) input.keys['KeyA'] = true;
      }
    }
    // Phase 1: 5 WP, 7 HP
    else if (phase === 1) {
      const p1Time = elapsed - state.p1StartTime;
      if (!boss.shield.isBroken && !boss.shield.isShattering) {
        input.keys['KeyS'] = true;
        // At p1Time >= 0.95, open reflect shield:
        if (!state.p1ShieldUsed && p1Time >= 0.95) {
          input.actions.push('skill3');
          state.p1ShieldUsed = true;
        }
      } else if (boss.shield.isShattering) {
        input.keys['KeyS'] = true;
      } else {
        input.keys['KeyS'] = true;
      }
    }
    // Phase 2: 8 WP, 8 HP
    else if (phase === 2) {
      const p2Time = elapsed - state.p2StartTime;
      if (!boss.shield.isBroken && !boss.shield.isShattering) {
        if (!state.p2Blinked && p2Time >= 0.82) {
          input.keys['KeyA'] = true;
          input.actions.push('skill2');
          state.p2Blinked = true;
        } else if (state.p2Blinked) {
          input.keys['KeyW'] = true;
          input.keys['KeyD'] = true;
        } else {
          // move slightly with A to dodge incoming stream
          input.keys['KeyW'] = true;
          if (p2Time < 0.35) input.keys['KeyA'] = true;
        }
      } else {
        const targetX = boss.x;
        const targetY = boss.y + 45;
        const dx = targetX - player.x;
        const dy = targetY - player.y;
        if (Math.abs(dx) > 10) { if (dx > 0) input.keys['KeyD'] = true; else input.keys['KeyA'] = true; }
        if (Math.abs(dy) > 10) { if (dy > 0) input.keys['KeyS'] = true; else input.keys['KeyW'] = true; }
      }
    }
    // Phase 3: 4 WP, 9 HP
    else if (phase === 3) {
      const p3Time = elapsed - state.p3StartTime;
      if (!boss.shield.isBroken && !boss.shield.isShattering) {
        input.keys['KeyS'] = true;
      } else if (boss.shield.isShattering) {
        input.keys['KeyW'] = true;
      } else {
        if (!state.p3Blinked && p3Time >= 2.45) {
          input.keys['KeyW'] = true;
          input.actions.push('skill2');
          state.p3Blinked = true;
        } else {
          input.keys['KeyW'] = true;
        }
      }
    }
    // Phase 4: 9 WP, 11 HP
    else if (phase === 4) {
      const p4Time = elapsed - state.p4StartTime;
      if (!state.p4Blinked && p4Time >= 0.25) {
        input.keys['KeyW'] = true;
        input.actions.push('skill2');
        state.p4Blinked = true;
      } else if (state.p4Blinked && !state.p4ShieldUsed && p4Time >= 0.35) {
        input.actions.push('skill3');
        state.p4ShieldUsed = true;
      } else {
        input.keys['KeyW'] = true;
      }
    }

    player.update(dt, input, 800, 800, boss.bullets);
    boss.update(dt, elapsed, player, { recordHit() {}, getFrequency() { return 4.0; } });

    for (const b of player.bullets) {
      if (!b.alive) continue;
      if (!boss.shield.isBroken) {
        if (boss.shield.checkBulletCollision(b, null, Date.now())) continue;
      } else {
        if (Math.hypot(b.x - boss.x, b.y - boss.y) <= boss.radius + 6) {
          b.alive = false;
          boss.takeDamage(1, null, Date.now());
        }
      }
    }
  }

  return { elapsed, bossDead: boss.isDead, playerHp: player.hp, currentPhase: boss.currentPhaseIndex };
}

const res = simulateRun();
console.log('Result:', res);
