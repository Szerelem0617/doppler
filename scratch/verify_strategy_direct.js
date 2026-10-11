import { Boss } from '../src/game/Boss.js';
import { Player } from '../src/game/Player.js';
import { STAGE_STRATEGIES } from '../src/tas/strategies.js';

const dt = 1 / 60;
const w = 800;
const h = 800;

console.log('================================================================');
console.log(' VERIFYING STAGE_STRATEGIES["2-boss"] DIRECTLY IN NODE RUNNER');
console.log('================================================================\n');

const boss = new Boss(w / 2, 130, { phaseSequence: [7, 5, 8, 4, 9], phaseHps: [7, 7, 7, 9, 11], enableBullets: true });
const player = new Player(w / 2, 710, boss);
player.autoFire = true;

const strategy = STAGE_STRATEGIES['2-boss'];
const state = strategy.init();

function handlePlayerBulletCollisions(player, boss) {
  for (const b of player.bullets) {
    if (!b.alive) continue;

    if (!boss.shield.isBroken) {
      if (!boss.shield.isShattering && player.isInsideShield) {
        const playerDist = Math.hypot(player.x - boss.x, player.y - boss.y);
        if (playerDist <= boss.shield.radius * 0.75) {
          const dx = b.x - boss.x;
          const dy = b.y - boss.y;
          const dist = Math.hypot(dx, dy);
          if (dist <= boss.radius + 6) {
            b.alive = false;
            boss.takeDamage(1, null, Date.now());
            continue;
          }
          continue;
        }
      }

      if (boss.shield.checkBulletCollision(b, null, Date.now())) continue;
    } else {
      if (Math.hypot(b.x - boss.x, b.y - boss.y) <= boss.radius + 6) {
        b.alive = false;
        boss.takeDamage(1, null, Date.now());
      }
    }
  }
}

let elapsed = 0;
let lastPhase = -1;

while (elapsed < 25.0 && !boss.isDead && player.hp > 0) {
  elapsed += dt;

  if (boss.currentPhaseIndex !== lastPhase) {
    if (lastPhase >= 0) {
      console.log(`>>> Phase ${lastPhase} Complete at t=${elapsed.toFixed(3)}s | HP: ${player.hp}/3 | Pos: (${player.x.toFixed(1)}, ${player.y.toFixed(1)}) | isInside: ${player.isInsideShield} <<<`);
    }
    lastPhase = boss.currentPhaseIndex;
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

  player.update(dt, inputs, w, h, boss.bullets);
  boss.update(dt, elapsed, player, { recordHit() {}, getFrequency() { return 4.0; } });
  handlePlayerBulletCollisions(player, boss);
}

if (boss.isDead) {
  console.log(`>>> Phase 4 Complete at t=${elapsed.toFixed(3)}s | HP: ${player.hp}/3 | Pos: (${player.x.toFixed(1)}, ${player.y.toFixed(1)}) <<<`);
}

console.log('\n================================================================');
console.log(' STRATEGY VERIFICATION RESULT');
console.log('================================================================');
console.log(`  Boss isDead: ${boss.isDead}`);
console.log(`  Total Run Duration: ${elapsed.toFixed(3)}s`);
console.log(`  Remaining Player HP: ${player.hp}/3`);
