import { Boss } from '../src/game/Boss.js';
import { Player } from '../src/game/Player.js';
import { STAGE_STRATEGIES } from '../src/tas/strategies.js';

const dt = 1 / 60;
const w = 800, h = 800;

const boss = new Boss(w / 2, 130, {
  phaseSequence: [7, 5, 8, 4, 9],
  phaseHps: [7, 7, 7, 9, 11],
  enableBullets: true
});
const player = new Player(w / 2, 710, boss);
player.autoFire = true;

const strategy = STAGE_STRATEGIES['2-boss'];
const state = strategy.init();

let elapsed = 0;
let bulletCounter = 0;

console.log('Simulating Phase 0 and Phase 1 in detail...');

while (elapsed < 8.0 && !boss.isDead && player.hp > 0) {
  elapsed += dt;
  const currentPhase = boss.currentPhaseIndex;

  const rawInputs = strategy.update({ player, enemy: boss }, elapsed, state);
  const inputs = {
    keys: { ...rawInputs.keys },
    actions: [...(rawInputs.actions || [])],
    consumeSkill1() { const i = this.actions.indexOf('skill2'); if (i !== -1) { this.actions.splice(i, 1); return true; } return false; },
    consumeSkill2() { return false; },
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
      b._spawnPhase = currentPhase;
      b._spawnPlayerX = player.x;
      b._spawnPlayerY = player.y;
    }
  }

  boss.update(dt, elapsed * 1000, player, { recordHit() {}, getFrequency() { return 4.0; } });

  // Handle collisions
  for (const b of player.bullets) {
    if (!b.alive) continue;

    if (!boss.shield.isBroken) {
      const dx = b.x - boss.x;
      const dy = b.y - boss.y;
      const dist = Math.hypot(dx, dy);

      if (dist <= boss.shield.radius + 8) {
        const prevWp = [...boss.shield.weakpoints];
        const hitAngle = Math.atan2(dy, dx);
        boss.shield.checkBulletCollision(b, null, Date.now());
        const afterWp = [...boss.shield.weakpoints];

        let hitWpIndex = -1;
        for (let i = 0; i < boss.shield.count; i++) {
          if (prevWp[i] && !afterWp[i]) {
            hitWpIndex = i;
            break;
          }
        }

        if (boss.currentPhaseIndex === 1) {
          console.log(`[P1 5WP HIT] t=${elapsed.toFixed(3)}s | Bullet #${b._id} (fired t=${b._spawnTime.toFixed(3)}s at Y=${b._spawnPlayerY.toFixed(1)}, X=${b._spawnPlayerX.toFixed(1)}) -> hitAngle=${(hitAngle*180/Math.PI).toFixed(1)}° | Result: ${hitWpIndex !== -1 ? 'WP ' + hitWpIndex : 'DEFLECTED/MISSED!'} | Remaining WPs: ${afterWp.map((w,i)=>w?i:'_').join('')}`);
        }
        continue;
      }
    } else {
      const dx = b.x - boss.x;
      const dy = b.y - boss.y;
      const dist = Math.hypot(dx, dy);
      if (dist <= boss.radius + 6) {
        b.alive = false;
        boss.takeDamage(1, null, Date.now());
        if (boss.currentPhaseIndex === 1) {
          console.log(`[P1 CORE HIT] t=${elapsed.toFixed(3)}s | Bullet #${b._id} hit core | Boss Phase HP: ${boss.currentPhaseHp}`);
        }
      }
    }
  }

  if (boss.currentPhaseIndex === 2) {
    console.log(`Phase 1 ended at t=${elapsed.toFixed(3)}s!`);
    break;
  }
}
