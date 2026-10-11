import { Boss } from '../src/game/Boss.js';
import { Player } from '../src/game/Player.js';
import { STAGE_STRATEGIES } from '../src/tas/strategies.js';

const strat = STAGE_STRATEGIES['2-boss'];
const state = strat.init();
const player = new Player(400, 600);
const boss = new Boss(400, 130);
boss.configure({ phaseSequence: [7, 5, 8, 4, 9], phaseHps: [7, 7, 7, 9, 11] });
player.setEnemy(boss);
const ctx = { player, enemy: boss };
let elapsed = 0;
const dt = 1 / 60;

console.log('Simulating baseline run to trace Phase 4 deflects...');

while (elapsed < 25 && !boss.isDead) {
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

  for (const b of player.bullets) {
    if (!b.alive) continue;
    if (!boss.shield.isBroken) {
      if (player.isInsideShield) {
        const playerDist = Math.hypot(player.x - boss.x, player.y - boss.y);
        if (playerDist <= boss.shield.radius * 0.75) {
          const dist = Math.hypot(b.x - boss.x, b.y - boss.y);
          if (dist <= boss.radius + 6) {
            b.alive = false;
            if (boss.currentPhaseIndex === 4) {
              console.log(`[P4 CORE INSIDE] ${elapsed.toFixed(3)}s, bossHP: ${boss.currentPhaseHp}`);
            }
            boss.takeDamage(1, null, elapsed);
            continue;
          }
          continue;
        }
      }
      const dist = Math.hypot(b.x - boss.x, b.y - boss.y);
      if (dist <= boss.shield.radius + 8) {
        b.alive = false;
        if (boss.shield.isShattering) {
          if (boss.currentPhaseIndex === 4) {
            console.log(`[P4 SHATTER ABSORB] ${elapsed.toFixed(3)}s`);
          }
        } else {
          const hitAngle = Math.atan2(b.y - boss.y, b.x - boss.x);
          const angleStep = (Math.PI * 2) / boss.shield.count;
          const deg = (rad) => (rad * 180 / Math.PI).toFixed(1);

          if (!boss.shield.firstHitRegistered) {
            boss.shield.firstHitRegistered = true;
            boss.shield.currentAngle = hitAngle;
            boss.shield.weakpoints[0] = false;
            boss.shield.isRotating = true;
            if (boss.currentPhaseIndex === 4) {
              console.log(`[P4 WP 0] ${elapsed.toFixed(3)}s, hitAngle: ${deg(hitAngle)}°, player: (${player.x.toFixed(1)}, ${player.y.toFixed(1)})`);
            }
            boss.shield.checkAllWeakpoints();
          } else {
            const tolerance = Math.max(0.22, Math.min(0.38, ((Math.PI * 2) / boss.shield.count) * 0.42));
            let hitIdx = -1;
            for (let i = 0; i < boss.shield.count; i++) {
              if (!boss.shield.weakpoints[i]) continue;
              const wpAngle = (boss.shield.currentAngle + i * angleStep) % (Math.PI * 2);
              let diff = Math.abs(hitAngle - wpAngle);
              if (diff > Math.PI) diff = Math.PI * 2 - diff;
              if (diff <= tolerance) { hitIdx = i; break; }
            }
            if (hitIdx !== -1) {
              boss.shield.weakpoints[hitIdx] = false;
              if (boss.currentPhaseIndex === 4) {
                console.log(`[P4 WP ${hitIdx}] ${elapsed.toFixed(3)}s, hitAngle: ${deg(hitAngle)}°, player: (${player.x.toFixed(1)}, ${player.y.toFixed(1)}), remaining: ${boss.shield.weakpoints.filter(Boolean).length}`);
              }
              boss.shield.checkAllWeakpoints();
            } else {
              if (boss.currentPhaseIndex === 4) {
                console.log(`[P4 DEFLECT] ${elapsed.toFixed(3)}s, hitAngle: ${deg(hitAngle)}°, player: (${player.x.toFixed(1)}, ${player.y.toFixed(1)})`);
                for (let i = 0; i < boss.shield.count; i++) {
                  if (!boss.shield.weakpoints[i]) continue;
                  const wpAngle = (boss.shield.currentAngle + i * angleStep) % (Math.PI * 2);
                  let diff = Math.abs(hitAngle - wpAngle);
                  if (diff > Math.PI) diff = Math.PI * 2 - diff;
                  console.log(`    alive WP ${i}: ${deg(wpAngle)}°, diff: ${deg(diff)}° (tol: ${deg(tolerance)}°)`);
                }
              }
            }
          }
        }
      }
    } else {
      const dist = Math.hypot(b.x - boss.x, b.y - boss.y);
      if (dist <= boss.radius + 6) {
        b.alive = false;
        if (boss.currentPhaseIndex === 4) {
          console.log(`[P4 CORE BROKEN] ${elapsed.toFixed(3)}s, bossHP: ${boss.currentPhaseHp}`);
        }
        boss.takeDamage(1, null, elapsed);
      }
    }
  }
  elapsed += dt;
}
