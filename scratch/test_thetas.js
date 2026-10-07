import { Boss } from '../src/game/Boss.js';
import { Player } from '../src/game/Player.js';
import { BossBullet } from '../src/game/BossBullet.js';

console.log('Testing full continuous run for different theta and dodge styles...');

function runFull(theta, p1Tactic) {
  const boss = new Boss(400, 130, {
    phaseSequence: [7, 5, 8, 4, 9],
    phaseHps: [7, 7, 8, 9, 11],
    enableBullets: true
  });
  boss.fireSnipeLance = function(p) {
    if (!p) return;
    const dx = p.x - this.x;
    const dy = p.y - this.y;
    const angle = Math.atan2(dy, dx);
    const speed = 360;
    [-theta, 0, theta].forEach(offset => {
      const a = angle + offset;
      const vx = Math.cos(a) * speed;
      const vy = Math.sin(a) * speed;
      this.bullets.push(new BossBullet(this.x, this.y, vx, vy));
    });
  };

  const player = new Player(400, 710, boss);
  player.autoFire = true;

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
      consumeSkill2() {
        const idx = this.actions.indexOf('skill2');
        if (idx !== -1) { this.actions.splice(idx, 1); return true; }
        return false;
      },
      consumeSkill3() {
        const idx = this.actions.indexOf('skill3');
        if (idx !== -1) { this.actions.splice(idx, 1); return true; }
        return false;
      },
      getMovementVector() {
        let x = 0, y = 0;
        if (this.keys['KeyW']) y -= 1;
        if (this.keys['KeyS']) y += 1;
        if (this.keys['KeyA']) x -= 1;
        if (this.keys['KeyD']) x += 1;
        if (x !== 0 && y !== 0) {
          const inv = 0.70710678;
          return { x: x * inv, y: y * inv };
        }
        return { x, y };
      }
    };

    if (phase === 0) {
      if (!boss.shield.isBroken && !boss.shield.isShattering) {
        input.keys['KeyW'] = true;
      } else if (!state.p0Blinked) {
        input.keys['KeyS'] = true;
        input.actions.push('skill2');
        state.p0Blinked = true;
      } else {
        input.keys['KeyW'] = true;
      }
    } else if (phase === 1) {
      p1Tactic(input, elapsed - state.p1StartTime, player, boss, state);
    } else if (phase === 2) {
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
          input.keys['KeyW'] = true;
        }
      } else {
        const targetX = boss.x;
        const targetY = boss.y + 45;
        const dx = targetX - player.x;
        const dy = targetY - player.y;
        if (Math.abs(dx) > 10) {
          if (dx > 0) input.keys['KeyD'] = true;
          else input.keys['KeyA'] = true;
        }
        if (Math.abs(dy) > 10) {
          if (dy > 0) input.keys['KeyS'] = true;
          else input.keys['KeyW'] = true;
        }
      }
    } else if (phase === 3) {
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
    } else if (phase === 4) {
      const p4Time = elapsed - state.p4StartTime;
      if (!state.p4Blinked && p4Time >= 0.25) {
        input.keys['KeyW'] = true;
        input.actions.push('skill2');
        state.p4Blinked = true;
      } else if (state.p4Blinked && !state.p4ShieldUsed && p4Time >= 0.35) {
        input.actions.push('skill3');
        state.p4ShieldUsed = true;
      } else if (p4Time >= 0.35) {
        input.keys['KeyW'] = true;
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

  return {
    success: boss.isDead && player.hp >= 1,
    bossDead: boss.isDead,
    playerHp: player.hp,
    time: elapsed
  };
}

// Test various tactics and thetas
for (const theta of [0.18, 0.20, 0.22, 0.24, 0.26]) {
  // Tactic A: Slight dodge left then recenter
  for (const aDuration of [0.18, 0.22, 0.26, 0.30]) {
    const res = runFull(theta, (input, p1Time, player, boss, state) => {
      if (!boss.shield.isBroken && !boss.shield.isShattering) {
        input.keys['KeyS'] = true;
        if (p1Time >= 0.20 && p1Time < 0.20 + aDuration) {
          input.keys['KeyA'] = true;
        } else if (p1Time >= 0.20 + aDuration && player.x < 399) {
          input.keys['KeyD'] = true;
        }
      } else if (boss.shield.isShattering) {
        input.keys['KeyS'] = true;
        if (player.x < 399) input.keys['KeyD'] = true;
      } else {
        if (!state.p1ShieldUsed) {
          input.actions.push('skill3');
          state.p1ShieldUsed = true;
        }
        input.keys['KeyS'] = true;
        if (player.x < 399) input.keys['KeyD'] = true;
      }
    });

    if (res.success) {
      console.log(`PASS! theta=${theta.toFixed(2)}, aDur=${aDuration.toFixed(2)} => Time: ${res.time.toFixed(3)}s, HP: ${res.playerHp}`);
    }
  }
}
