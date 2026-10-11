import { Boss } from '../src/game/Boss.js';
import { Player } from '../src/game/Player.js';
import { STAGE_STRATEGIES } from '../src/tas/strategies.js';

const dt = 1 / 60;
const w = 800;
const h = 800;

const boss = new Boss(w / 2, 130, {
  phaseSequence: [7, 5, 8, 4, 9],
  phaseHps: [7, 7, 8, 9, 11],
  enableBullets: true
});
const player = new Player(w / 2, 710, boss);
player.autoFire = true;

const strategy = STAGE_STRATEGIES['2-boss'];
const state = strategy.init();

let elapsed = 0;
let lastPhase = -1;
let bulletCounter = 0;
const bulletLog = [];

while (elapsed < 25.0 && !boss.isDead && player.hp > 0) {
  elapsed += dt;

  const currentPhase = boss.currentPhaseIndex;
  if (currentPhase !== lastPhase) {
    console.log(`\n============================================================`);
    console.log(`>>> ENTERED PHASE ${currentPhase} (UI Phase ${currentPhase + 1}) at t=${elapsed.toFixed(3)}s | Player HP: ${player.hp} | Boss HP: ${boss.currentPhaseHp}`);
    console.log(`============================================================`);
    lastPhase = currentPhase;
  }

  const rawInputs = strategy.update({ player, enemy: boss }, elapsed, state);

  const inputs = {
    keys: { ...rawInputs.keys },
    actions: [...(rawInputs.actions || [])],
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

  const prevBullets = new Set(player.bullets);
  player.update(dt, inputs, w, h, boss.bullets);
  for (const b of player.bullets) {
    if (!prevBullets.has(b)) {
      bulletCounter++;
      b._id = bulletCounter;
      b._spawnTime = elapsed;
      b._spawnPhase = boss.currentPhaseIndex;
      b._spawnPlayerY = player.y;
    }
  }

  boss.update(dt, elapsed, player, { recordHit() {}, getFrequency() { return 4.0; } });

  // Handle collisions exactly as main.js
  for (const b of player.bullets) {
    if (!b.alive) continue;

    if (!boss.shield.isBroken) {
      if (player.isInsideShield) {
        const playerDist = Math.hypot(player.x - boss.x, player.y - boss.y);
        if (playerDist <= boss.shield.radius * 0.75) {
          const dx = b.x - boss.x;
          const dy = b.y - boss.y;
          const dist = Math.hypot(dx, dy);
          if (dist <= boss.radius + 6) {
            b.alive = false;
            bulletLog.push({
              id: b._id,
              spawnTime: b._spawnTime,
              hitTime: elapsed,
              spawnPhase: b._spawnPhase,
              hitPhase: boss.currentPhaseIndex,
              result: 'HIT_BOSS_CORE_INSIDE',
              dmg: 1
            });
            boss.takeDamage(1, null, Date.now());
            continue;
          }
          continue;
        }
      }

      const dx = b.x - boss.x;
      const dy = b.y - boss.y;
      const dist = Math.hypot(dx, dy);
      if (dist <= boss.shield.radius + 8) {
        const prevWp = [...boss.shield.weakpoints];
        boss.shield.checkBulletCollision(b, null, Date.now());
        const afterWp = [...boss.shield.weakpoints];
        let hitWpIndex = -1;
        for (let i = 0; i < boss.shield.count; i++) {
          if (prevWp[i] && !afterWp[i]) {
            hitWpIndex = i;
            break;
          }
        }
        bulletLog.push({
          id: b._id,
          spawnTime: b._spawnTime,
          hitTime: elapsed,
          spawnPhase: b._spawnPhase,
          hitPhase: boss.currentPhaseIndex,
          result: hitWpIndex !== -1 ? `HIT_WEAKPOINT_${hitWpIndex}` : 'DEFLECTED_SHIELD_WALL (MISSED!)',
          shieldBroken: boss.shield.isBroken
        });
        continue;
      }
    } else {
      const dx = b.x - boss.x;
      const dy = b.y - boss.y;
      const dist = Math.hypot(dx, dy);
      if (dist <= boss.radius + 6) {
        b.alive = false;
        bulletLog.push({
          id: b._id,
          spawnTime: b._spawnTime,
          hitTime: elapsed,
          spawnPhase: b._spawnPhase,
          hitPhase: boss.currentPhaseIndex,
          result: 'HIT_BOSS_CORE_SHIELD_BROKEN',
          dmg: 1
        });
        boss.takeDamage(1, null, Date.now());
      }
    }
  }
}

console.log(`\n============================================================`);
console.log(`Simulation finished at t=${elapsed.toFixed(3)}s`);
console.log(`Boss dead: ${boss.isDead}, Player HP: ${player.hp}`);
console.log(`============================================================\n`);

for (let p = 0; p <= 4; p++) {
  const pBullets = bulletLog.filter(l => l.hitPhase === p);
  const wp = pBullets.filter(l => l.result.startsWith('HIT_WEAKPOINT')).length;
  const miss = pBullets.filter(l => l.result.includes('MISSED')).length;
  const core = pBullets.filter(l => l.result.includes('CORE')).length;
  console.log(`Phase ${p} (UI Phase ${p+1}):`);
  console.log(`  Total hits/deflections: ${pBullets.length} | Weakpoints: ${wp} | Missed/Deflected: ${miss} | Boss Core: ${core}`);
  if (miss > 0) {
    const missedList = pBullets.filter(l => l.result.includes('MISSED'));
    console.log(`  Missed bullets detail:`, missedList.map(m => `B#${m.id}(spawn t=${m.spawnTime.toFixed(2)}s, hit t=${m.hitTime.toFixed(2)}s)`).join(', '));
  }
}
