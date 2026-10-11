import { Boss } from '../src/game/Boss.js';
import { Player } from '../src/game/Player.js';
import { STAGE_STRATEGIES } from '../src/tas/strategies.js';

function simulatePhase2(config) {
  const strat = STAGE_STRATEGIES['2-boss'];
  const state = strat.init();
  const player = new Player(400, 600);
  const boss = new Boss(400, 130);
  boss.configure({ phaseSequence: [7, 5, 8, 4, 9], phaseHps: [7, 7, 7, 9, 11] });
  player.setEnemy(boss);
  const ctx = { player, enemy: boss };
  let elapsed = 0;
  const dt = 1 / 60;
  let p2Deflects = 0;
  let p2WpHits = 0;
  let p2ShatterTime = 0;
  let p2HitSeq = [];

  while (elapsed < 13 && boss.currentPhaseIndex <= 2) {
    const inputs = strat.update(ctx, elapsed, state);

    if (boss.currentPhaseIndex === 2 && !boss.shield.isBroken && !boss.shield.isShattering) {
      const p2Time = state.p2StartTime ? elapsed - state.p2StartTime : 0;
      inputs.keys = {};
      inputs.actions = [];

      // Custom phase 2 logic based on config
      config.updateInputs(p2Time, inputs, player, boss, state);
    }

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
            // shatter
          } else {
            const hitAngle = Math.atan2(b.y - boss.y, b.x - boss.x);
            const angleStep = (Math.PI * 2) / boss.shield.count;
            if (!boss.shield.firstHitRegistered) {
              boss.shield.firstHitRegistered = true;
              boss.shield.currentAngle = hitAngle;
              boss.shield.weakpoints[0] = false;
              boss.shield.isRotating = true;
              if (boss.currentPhaseIndex === 2) {
                p2WpHits++;
                p2HitSeq.push('WP0');
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
                if (boss.currentPhaseIndex === 2) {
                  p2WpHits++;
                  p2HitSeq.push(`WP${hitIdx}`);
                  if (boss.shield.weakpoints.every(wp => !wp)) {
                    p2ShatterTime = elapsed;
                  }
                }
                boss.shield.checkAllWeakpoints();
              } else {
                if (boss.currentPhaseIndex === 2) {
                  p2Deflects++;
                  p2HitSeq.push('DEF');
                }
              }
            }
          }
        }
      } else {
        const dist = Math.hypot(b.x - boss.x, b.y - boss.y);
        if (dist <= boss.radius + 6) {
          b.alive = false;
          boss.takeDamage(1, null, elapsed);
        }
      }
    }
    elapsed += dt;
  }

  return { p2Deflects, p2WpHits, p2ShatterTime, p2HitSeq };
}

// Search grid
console.log('Searching parameter space for 0 DEFLECTS in Phase 2...');
let best = null;

const blinkTimes = [0.65, 0.70, 0.75, 0.80, 0.85, 0.90, 0.95, 1.00];
const blinkDirs = ['KeyA', 'KeyS', 'KeyD', 'KeyW'];
const afterDirs = [
  ['KeyW', 'KeyD'],
  ['KeyS', 'KeyD'],
  ['KeyD'],
  ['KeyS'],
  ['KeyA'],
  ['KeyW']
];

for (const bt of blinkTimes) {
  for (const bdir of blinkDirs) {
    for (const adir of afterDirs) {
      const res = simulatePhase2({
        updateInputs(p2Time, inputs, player, boss, state) {
          if (p2Time < 0.22) {
            inputs.keys['KeyW'] = true;
          } else if (p2Time < bt) {
            inputs.keys['KeyA'] = true;
            inputs.keys['KeyW'] = true;
          } else if (!state.p2SearchedBlink && p2Time >= bt) {
            inputs.keys[bdir] = true;
            inputs.actions.push('skill2');
            state.p2SearchedBlink = true;
          } else {
            for (const k of adir) inputs.keys[k] = true;
          }
        }
      });

      if (res.p2WpHits === 8 && res.p2Deflects === 0) {
        console.log(`FOUND 0 DEFLECTS! bt: ${bt}s, bdir: ${bdir}, adir: ${adir.join('+')}, time: ${res.p2ShatterTime.toFixed(2)}s, seq: ${res.p2HitSeq.join('->')}`);
        if (!best || res.p2ShatterTime < best.p2ShatterTime) {
          best = { bt, bdir, adir, ...res };
        }
      }
    }
  }
}

if (best) {
  console.log('\n*** BEST SOLUTION FOUND ***');
  console.log(JSON.stringify(best, null, 2));
} else {
  console.log('\nNo 0-deflect with simple grid, expanding search...');
}
