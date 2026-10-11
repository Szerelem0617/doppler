import { Boss } from '../src/game/Boss.js';
import { Player } from '../src/game/Player.js';
import { STAGE_STRATEGIES } from '../src/tas/strategies.js';

function runTestWithBrokenCount(blinkDirection = 'KeyA', afterMove = ['KeyD']) {
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
  let p2HitSeq = [];

  while (elapsed < 14 && boss.currentPhaseIndex <= 2) {
    const inputs = strat.update(ctx, elapsed, state);

    if (boss.currentPhaseIndex === 2 && !boss.shield.isBroken && !boss.shield.isShattering) {
      const p2Time = state.p2StartTime ? elapsed - state.p2StartTime : 0;
      inputs.keys = {};
      inputs.actions = [];

      const brokenCount = boss.shield.weakpoints.filter(wp => !wp).length;

      if (p2Time < 0.22) {
        inputs.keys['KeyW'] = true;
      } else if (brokenCount < 4) {
        // A+W 贴盾绕行击破前 4 盾 (0, 7, 6, 5)
        inputs.keys['KeyA'] = true;
        inputs.keys['KeyW'] = true;
      } else if (!state.p2DynamicBlinked && brokenCount >= 4) {
        // 击破 4 盾后瞬间触发折跃跳角！
        inputs.keys[blinkDirection] = true;
        inputs.actions.push('skill2');
        state.p2DynamicBlinked = true;
      } else {
        // 闪现后追踪击破后 4 盾 (4, 3, 2, 1)
        for (const k of afterMove) inputs.keys[k] = true;
      }
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
                p2HitSeq.push(`WP0@${elapsed.toFixed(2)}s`);
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
                  p2HitSeq.push(`WP${hitIdx}@${elapsed.toFixed(2)}s`);
                }
                boss.shield.checkAllWeakpoints();
              } else {
                if (boss.currentPhaseIndex === 2) {
                  p2Deflects++;
                  p2HitSeq.push(`DEF@${elapsed.toFixed(2)}s(${(hitAngle*180/Math.PI).toFixed(0)}°)`);
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

  return { blinkDirection, afterMove, p2Deflects, p2WpHits, p2HitSeq };
}

const dirs = ['KeyA', 'KeyW', 'KeyD', 'KeyS'];
const afters = [
  ['KeyD'],
  ['KeyW', 'KeyD'],
  ['KeyS', 'KeyD'],
  ['KeyA'],
  ['KeyW']
];

for (const d of dirs) {
  for (const a of afters) {
    const res = runTestWithBrokenCount(d, a);
    if (res.p2Deflects === 0) {
      console.log(`PERFECT 0 DEFLECTS! Blink: ${d}, After: ${a.join('+')}, Seq: ${res.p2HitSeq.join(' -> ')}`);
    } else {
      console.log(`Blink: ${d}, After: ${a.join('+')} -> Deflects: ${res.p2Deflects}, Seq: ${res.p2HitSeq.join(' -> ')}`);
    }
  }
}
