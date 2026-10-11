import { Boss } from '../src/game/Boss.js';
import { Player } from '../src/game/Player.js';
import { STAGE_STRATEGIES } from '../src/tas/strategies.js';

function testTailInput(tailKey, tailTime) {
  const strat = STAGE_STRATEGIES['2-boss'];
  const state = strat.init();
  const player = new Player(400, 600);
  const boss = new Boss(400, 130);
  boss.configure({ phaseSequence: [7, 5, 8, 4, 9], phaseHps: [7, 7, 7, 9, 11] });
  player.setEnemy(boss);
  const ctx = { player, enemy: boss };
  let elapsed = 0;
  const dt = 1 / 60;
  let p4Deflects = 0;
  let p4WpHits = 0;
  let p4HitSeq = [];

  while (elapsed < 24 && !boss.isDead && !player.isDead) {
    const inputs = strat.update(ctx, elapsed, state);

    if (boss.currentPhaseIndex === 4) {
      const p4Time = state.p4StartTime ? elapsed - state.p4StartTime : 0;
      const punchDelay = boss.invadeThreshold || 0.44;
      if (p4Time < punchDelay) {
        inputs.keys = { 'KeyW': true };
      } else if (p4Time >= punchDelay + 0.05) {
        if (!boss.shield.isBroken && !boss.shield.isShattering && !state.p4ShieldWasBroken) {
          inputs.keys = {};
          const holdY = 540;
          if (player.y < holdY - 4) inputs.keys['KeyS'] = true;
          else if (player.y > holdY + 4) inputs.keys['KeyW'] = true;

          if (p4Time >= 1.30 && p4Time < tailTime) {
            inputs.keys['KeyD'] = true;
          } else if (p4Time >= tailTime) {
            inputs.keys[tailKey] = true;
          }
        }
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
                  p4WpHits++;
                  p4HitSeq.push(`WP${hitIdx}`);
                }
                boss.shield.checkAllWeakpoints();
              } else {
                if (boss.currentPhaseIndex === 4) {
                  p4Deflects++;
                  p4HitSeq.push(`DEF`);
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

  return { tailKey, tailTime, p4Deflects, p4WpHits, p4HitSeq, playerAlive: !player.isDead };
}

for (const k of ['KeyW', 'KeyA', 'KeyS']) {
  for (let t = 2.0; t <= 2.6; t += 0.1) {
    const r = testTailInput(k, t);
    if (r.p4Deflects === 0) {
      console.log(`0 DEFLECTS! key=${k}, time=${t.toFixed(1)}s -> Seq: ${r.p4HitSeq.join('->')}`);
    }
  }
}
