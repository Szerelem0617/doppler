import { Boss } from '../src/game/Boss.js';
import { Player } from '../src/game/Player.js';

const dt = 1 / 60;
const w = 800;
const h = 800;

console.log('================================================================');
console.log(' ATTEMPT 4: FULL CONTINUOUS 5-PHASE END-TO-END SIMULATION');
console.log('================================================================\n');

const boss = new Boss(w / 2, 130, { phaseSequence: [7, 5, 8, 4, 9], phaseHps: [7, 7, 8, 9, 11], enableBullets: true });
const player = new Player(w / 2, 710, boss);
player.autoFire = true;

let elapsed = 0;
const state = {
  p0Blinked: false,
  p1StartTime: null,
  p1ShieldUsed: false,
  p2StartTime: null,
  p3StartTime: null,
  p3Blinked: false,
  p4StartTime: null,
  p4ShieldUsed: false,
  lastReportedPhase: -1,
  phaseSplits: []
};

let damageEvents = [];
player.takeDamage = function(dmg) {
  if (this.invincibleTimer > 0) return false;
  if (this.skill1Active) return false;
  damageEvents.push({ t: elapsed, phase: boss.currentPhaseIndex, hpBefore: this.hp, pos: { x: this.x, y: this.y } });
  return Player.prototype.takeDamage.call(this, dmg);
};

while (elapsed < 25.0 && !boss.isDead && player.hp > 0) {
  elapsed += dt;

  const phase = boss.currentPhaseIndex;
  if (phase !== state.lastReportedPhase) {
    if (state.lastReportedPhase >= 0) {
      state.phaseSplits.push({
        phase: state.lastReportedPhase,
        time: elapsed,
        hp: player.hp
      });
      console.log(`>>> Phase ${state.lastReportedPhase} Complete at t=${elapsed.toFixed(3)}s | HP: ${player.hp}/3 | Pos: (${player.x.toFixed(1)}, ${player.y.toFixed(1)}) <<<`);
    }
    state.lastReportedPhase = phase;
    if (phase === 1) state.p1StartTime = elapsed;
    if (phase === 2) state.p2StartTime = elapsed;
    if (phase === 3) state.p3StartTime = elapsed;
    if (phase === 4) state.p4StartTime = elapsed;
  }

  const inputs = {
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
      if (x !== 0 && y !== 0) { const inv = 0.70710678; return { x: x * inv, y: y * inv }; }
      return { x, y };
    }
  };

  // Phase 0: 7 WP, 7 HP
  if (phase === 0) {
    if (!boss.shield.isBroken && !boss.shield.isShattering) {
      inputs.keys['KeyW'] = true;
    } else if ((boss.shield.isShattering || boss.shield.isBroken) && !state.p0Blinked) {
      inputs.keys['KeyS'] = true;
      inputs.actions.push('skill2');
      state.p0Blinked = true;
    } else {
      inputs.keys['KeyW'] = true;
      if (elapsed >= 2.4 && elapsed <= 2.85) inputs.keys['KeyD'] = true;
      else if (elapsed > 2.85 && player.x > 401) inputs.keys['KeyA'] = true;
    }
  }
  // Phase 1: 5 WP, 7 HP
  else if (phase === 1) {
    const p1Time = elapsed - state.p1StartTime;
    if (!boss.shield.isBroken && !boss.shield.isShattering) inputs.keys['KeyS'] = true;
    if (!state.p1ShieldUsed && p1Time >= 1.15) {
      inputs.actions.push('skill3');
      state.p1ShieldUsed = true;
    }
  }
  // Phase 2: 8 WP, 8 HP (Pure Movement - No Shield)
  else if (phase === 2) {
    const p2Time = elapsed - state.p2StartTime;
    const targetY = boss.y + 56;
    const targetX = boss.x + 8;
    if (p2Time >= 0.25) {
      if (player.y > targetY + 2) inputs.keys['KeyW'] = true;
      else if (player.y < targetY - 2) inputs.keys['KeyS'] = true;

      if (player.x < targetX - 2) inputs.keys['KeyD'] = true;
      else if (player.x > targetX + 2) inputs.keys['KeyA'] = true;
    }
  }
  // Phase 3: 4 WP, 9 HP
  else if (phase === 3) {
    const p3Time = elapsed - state.p3StartTime;
    if (!state.p3Blinked && p3Time >= 0.05) {
      inputs.actions.push('skill2');
      state.p3Blinked = true;
    }
    if (p3Time >= 1.40) {
      inputs.keys['KeyW'] = true;
      if (p3Time >= 1.65 && p3Time <= 1.95) inputs.keys['KeyD'] = true;
    }
  }
  // Phase 4: 9 WP, 11 HP
  else if (phase === 4) {
    const p4Time = elapsed - state.p4StartTime;
    if (!boss.shield.isBroken && !boss.shield.isShattering) {
      inputs.keys['KeyW'] = true;
      inputs.keys['KeyD'] = true;
    } else {
      const targetY = boss.y + 60;
      if (player.y > targetY + 2) inputs.keys['KeyW'] = true;
      else if (player.y < targetY - 2) inputs.keys['KeyS'] = true;

      if (player.x > boss.x + 2) inputs.keys['KeyA'] = true;
      else if (player.x < boss.x - 2) inputs.keys['KeyD'] = true;
    }

    if (!state.p4ShieldUsed && player.shieldCdTimer <= 0) {
      inputs.actions.push('skill3');
      state.p4ShieldUsed = true;
    }
  }

  player.update(dt, inputs, w, h, boss.bullets);
  boss.update(dt, elapsed, player, { recordHit() {}, getFrequency() { return 4.0; } });

  if (phase === 4) {
    const brokenCount = boss.shield.weakpoints.filter(wp => wp === false).length;
    if (brokenCount !== (state.p4Broken || 0)) {
      console.log(`    [P4 WP Broken] p4Time=${(elapsed - state.p4StartTime).toFixed(3)}s, broken=${brokenCount}/9, isBroken=${boss.shield.isBroken}`);
      state.p4Broken = brokenCount;
    }
  }

  for (const b of player.bullets) {
    if (!b.alive) continue;
    if (!boss.shield.isBroken) {
      if (boss.shield.checkBulletCollision(b, null, Date.now())) continue;
    } else {
      if (Math.hypot(b.x - boss.x, b.y - boss.y) <= boss.radius + 6) {
        b.alive = false;
        boss.takeDamage(1, null, Date.now());
        if (phase === 3) console.log(`    [P3 Core Hit] t=${elapsed.toFixed(3)}s, p3Time=${(elapsed - state.p3StartTime).toFixed(3)}s, Boss Phase HP left: ${boss.currentPhaseHp}`);
        if (phase === 4) console.log(`    [P4 Core Hit] t=${elapsed.toFixed(3)}s, p4Time=${(elapsed - state.p4StartTime).toFixed(3)}s, Boss Phase HP left: ${boss.currentPhaseHp}`);
      }
    }
  }
}

if (boss.isDead) {
  state.phaseSplits.push({
    phase: 4,
    time: elapsed,
    hp: player.hp
  });
}

console.log('\n================================================================');
console.log(' FULL END-TO-END SIMULATION RESULT');
console.log('================================================================');
console.log(`  Victory: ${boss.isDead}`);
console.log(`  Total Run Duration: ${elapsed.toFixed(3)}s`);
console.log(`  Remaining HP: ${player.hp}/3`);
console.log(`  Damage Events (${damageEvents.length}):`);
damageEvents.forEach(e => {
  console.log(`    - t=${e.t.toFixed(3)}s | Phase ${e.phase} | HP before: ${e.hpBefore} | Pos: (${e.pos.x.toFixed(1)}, ${e.pos.y.toFixed(1)})`);
});
console.log(`  Phase Split Times:`);
state.phaseSplits.forEach(s => {
  console.log(`    - Phase ${s.phase}: Finished at t=${s.time.toFixed(3)}s | HP: ${s.hp}/3`);
});
