import { Boss } from '../src/game/Boss.js';
import { Player } from '../src/game/Player.js';
import { Bullet } from '../src/game/Bullet.js';
import { STAGE_STRATEGIES } from '../src/tas/strategies.js';

// Setup full simulation to Phase 4
const strat = STAGE_STRATEGIES['2-boss'];
const state = strat.init();

const player = new Player(400, 600);
const boss = new Boss(400, 130);
boss.configure({
  phaseSequence: [7, 5, 8, 4, 9],
  phaseHps: [7, 7, 7, 9, 11]
});
player.setEnemy(boss);

const ctx = { player, enemy: boss };
let elapsed = 0;
const dt = 1 / 60;
let bulletCount = 0;

console.log('Simulating 2-boss run...');

while (elapsed < 25 && !boss.isDead) {
  // TAS input
  const inputs = strat.update(ctx, elapsed, state);
  const inputObj = {
    keys: inputs.keys || {},
    getMovementVector() {
      let x = 0, y = 0;
      if (this.keys['KeyA']) x -= 1;
      if (this.keys['KeyD']) x += 1;
      if (this.keys['KeyW']) y -= 1;
      if (this.keys['KeyS']) y += 1;
      const len = Math.hypot(x, y);
      return len > 0 ? { x: x / len, y: y / len } : { x: 0, y: 0 };
    },
    consumeBlink() {
      if (inputs.actions && (inputs.actions.includes('skill2') || inputs.actions.includes('blink'))) {
        inputs.actions = inputs.actions.filter(a => a !== 'skill2' && a !== 'blink');
        return true;
      }
      return false;
    }
  };

  player.update(dt, inputObj, 800, 800);
  boss.update(dt, player);

  // Bullet collisions (from main.js)
  for (const b of player.bullets) {
    if (!b.alive) continue;
    if (!boss.shield.isBroken) {
      if (player.isInsideShield) {
        const playerDist = Math.hypot(player.x - boss.x, player.y - boss.y);
        if (playerDist <= boss.shield.radius * 0.75) {
          const dist = Math.hypot(b.x - boss.x, b.y - boss.y);
          if (dist <= boss.radius + 6) {
            b.alive = false;
            const p = boss.currentPhaseIndex;
            boss.takeDamage(1, null, elapsed);
            console.log(`[${elapsed.toFixed(2)}s][P${p}] Core hit inside shield! Boss HP: ${boss.currentPhaseHp}/${boss.phaseHps[p]}`);
            continue;
          }
          continue;
        }
      }
      
      // Shield collision
      const dist = Math.hypot(b.x - boss.x, b.y - boss.y);
      if (dist <= boss.shield.radius + 8) {
        b.alive = false;
        const p = boss.currentPhaseIndex;
        if (boss.shield.isShattering) {
          console.log(`[${elapsed.toFixed(2)}s][P${p}] Shatter absorb`);
        } else {
          const hitAngle = Math.atan2(b.y - boss.y, b.x - boss.x);
          const angleStep = (Math.PI * 2) / boss.shield.count;
          let hitIndex = -1;
          const tolerance = Math.max(0.22, Math.min(0.38, ((Math.PI * 2) / boss.shield.count) * 0.42));
          
          if (!boss.shield.firstHitRegistered) {
            boss.shield.firstHitRegistered = true;
            boss.shield.currentAngle = hitAngle;
            boss.shield.weakpoints[0] = false;
            boss.shield.isRotating = true;
            console.log(`[${elapsed.toFixed(2)}s][P${p}] First hit WP 0!`);
            boss.shield.checkAllWeakpoints();
          } else {
            for (let i = 0; i < boss.shield.count; i++) {
              if (!boss.shield.weakpoints[i]) continue;
              const wpAngle = (boss.shield.currentAngle + i * angleStep) % (Math.PI * 2);
              let diff = Math.abs(hitAngle - wpAngle);
              if (diff > Math.PI) diff = Math.PI * 2 - diff;
              if (diff <= tolerance) {
                hitIndex = i;
                break;
              }
            }
            if (hitIndex !== -1) {
              boss.shield.weakpoints[hitIndex] = false;
              console.log(`[${elapsed.toFixed(2)}s][P${p}] Hit WP ${hitIndex}! Remaining: ${boss.shield.weakpoints.filter(Boolean).length}`);
              boss.shield.checkAllWeakpoints();
            } else {
              console.log(`[${elapsed.toFixed(2)}s][P${p}] *** DEFLECT *** hitAngle: ${(hitAngle*180/Math.PI).toFixed(1)}°`);
            }
          }
        }
      }
    } else {
      // Shield broken
      const dist = Math.hypot(b.x - boss.x, b.y - boss.y);
      if (dist <= boss.radius + 6) {
        b.alive = false;
        const p = boss.currentPhaseIndex;
        boss.takeDamage(1, null, elapsed);
        console.log(`[${elapsed.toFixed(2)}s][P${p}] Core hit broken shield! Boss HP: ${boss.currentPhaseHp}/${boss.phaseHps[p]}`);
      }
    }
  }

  elapsed += dt;
}

console.log(`Finished at ${elapsed.toFixed(2)}s, Boss dead: ${boss.isDead}`);
