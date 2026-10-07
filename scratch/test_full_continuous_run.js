import { Boss } from '../src/game/Boss.js';
import { Player } from '../src/game/Player.js';

console.log('====================================================');
console.log(' END-TO-END CONTINUOUS SPEEDRUN SIMULATION');
console.log(' Testing all 5 phases seamlessly without checkpoints');
console.log('====================================================\n');

const w = 800;
const h = 800;
const dt = 1 / 60;

const boss = new Boss(w / 2, 130, {
  phaseSequence: [7, 5, 8, 4, 9],
  phaseHps: [7, 7, 8, 9, 11],
  enableBullets: true
});

const player = new Player(w / 2, h - 90, boss);
player.autoFire = true;
const origTakeDamage = player.takeDamage.bind(player);
player.takeDamage = function(amount) {
  let nearBullet = null, minDist = 999;
  for (const b of boss.bullets) {
    const d = Math.hypot(b.x - this.x, b.y - this.y);
    if (d < minDist) { minDist = d; nearBullet = b; }
  }
  console.log(`[HURT] t=${elapsed.toFixed(3)}s, phase=${boss.currentPhaseIndex}, pos=(${this.x.toFixed(1)}, ${this.y.toFixed(1)}), minDist=${minDist.toFixed(1)}, vx=${nearBullet?.vx.toFixed(1)}, vy=${nearBullet?.vy.toFixed(1)}`);
  return origTakeDamage(amount);
};

let elapsed = 0;
let maxTime = 25.0;

// Strategy state
const state = {
  p0Blinked: false,
  p1ShieldUsed: false,
  p2Blinked: false,
  p2StartTime: null,
  p3Blinked: false,
  p3StartTime: null,
  p4Blinked: false,
  p4ShieldUsed: false,
  p4StartTime: null
};

let currentPhaseTracked = -1;

while (elapsed < maxTime && !boss.isDead && player.hp > 0) {
  elapsed += dt;

  const phase = boss.currentPhaseIndex;
  if (phase !== currentPhaseTracked) {
    console.log(`>>> Entered Phase ${phase} at t=${elapsed.toFixed(3)}s | Player HP: ${player.hp} | Player Pos: (${player.x.toFixed(1)}, ${player.y.toFixed(1)})`);
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

  // Phase 0 (7 WP, 7 HP)
  if (phase === 0) {
    if (!boss.shield.isBroken && !boss.shield.isShattering) {
      input.keys['KeyW'] = true;
    } else if ((boss.shield.isShattering || boss.shield.isBroken) && !state.p0Blinked) {
      input.keys['KeyS'] = true;
      input.actions.push('skill2');
      state.p0Blinked = true;
    } else {
      input.keys['KeyW'] = true;
    }
  }
  // Phase 1 (5 WP, 7 HP)
  else if (phase === 1) {
    const p1Time = state.p1StartTime ? elapsed - state.p1StartTime : 0;
    if (!boss.shield.isBroken && !boss.shield.isShattering) {
      input.keys['KeyS'] = true;
      if (p1Time >= 0.15 && p1Time < 0.65) {
        input.keys['KeyA'] = true;
      } else if (p1Time >= 0.65 && player.x < 399) {
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
  }
  // Phase 2 (8 WP, 8 HP)
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
        input.keys['KeyW'] = true;
      }
    } else {
      // 碎盾与输出期：向 Boss 正下方内圈冲刺
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
  }
  // Phase 3 (4 WP, 9 HP)
  else if (phase === 3) {
    const p3Time = elapsed - state.p3StartTime;
    if (!boss.shield.isBroken && !boss.shield.isShattering) {
      // 滑退中射击
    } else if (boss.shield.isShattering) {
      input.keys['KeyW'] = true;
    } else {
      input.keys['KeyW'] = true;
      if (!state.p3Blinked && p3Time > 1.8) {
        input.actions.push('skill2');
        state.p3Blinked = true;
      }
    }
  }
  // Phase 4 (9 WP, 11 HP)
  else if (phase === 4) {
    if (!state.p4Blinked) {
      if (player.invincibleTimer > 0) {
        input.actions.push('skill2');
        state.p4Blinked = true;
      } else {
        input.keys['KeyW'] = true;
      }
    } else {
      if (!state.p4ShieldUsed) {
        input.actions.push('skill3');
        state.p4ShieldUsed = true;
      }
    }
  }

  player.update(dt, input, w, h, boss.bullets);
  boss.update(dt, elapsed, player, { recordHit() {}, getFrequency() { return 4.0; } });

  // Damage
  for (const b of player.bullets) {
    if (!b.alive) continue;
    if (!boss.shield.isBroken) {
      if (boss.shield.checkBulletCollision(b, null, Date.now())) continue;
      if (!boss.shield.isShattering) {
        if (Math.hypot(b.x - boss.x, b.y - boss.y) <= boss.radius + 6) {
          b.alive = false;
          boss.takeDamage(1, null, Date.now());
        }
      }
    } else {
      if (Math.hypot(b.x - boss.x, b.y - boss.y) <= boss.radius + 6) {
        b.alive = false;
        boss.takeDamage(1, null, Date.now());
      }
    }
  }
}

console.log(`\n====================================================`);
console.log(` RUN COMPLETED!`);
console.log(` Total Time: ${elapsed.toFixed(3)}s`);
console.log(` Boss Dead: ${boss.isDead}`);
console.log(` Player Alive: ${player.hp > 0} (HP: ${player.hp}/3)`);
console.log(` Victory: ${boss.isDead && player.hp > 0}`);
console.log(`====================================================\n`);
