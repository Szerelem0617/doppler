import { Boss } from '../src/game/Boss.js';
import { Player } from '../src/game/Player.js';
import { STAGE_STRATEGIES } from '../src/tas/strategies.js';

function testFullRunFinal() {
  const strat = STAGE_STRATEGIES['2-boss'];
  const state = strat.init();
  const player = new Player(400, 600);
  const boss = new Boss(400, 130);
  boss.configure({ phaseSequence: [7, 5, 8, 4, 9], phaseHps: [7, 7, 7, 9, 11] });
  player.setEnemy(boss);
  const ctx = { player, enemy: boss };
  let elapsed = 0;
  const dt = 1 / 60;
  
  const stats = { byPhase: {} };

  while (elapsed < 25 && !boss.isDead) {
    const inputs = strat.update(ctx, elapsed, state);

    if (boss.currentPhaseIndex === 2) {
      const p2Time = state.p2StartTime ? elapsed - state.p2StartTime : 0;
      if (!boss.shield.isBroken && !boss.shield.isShattering) {
        inputs.keys = {};
        inputs.actions = [];
        const remainingWp = boss.shield.weakpoints ? boss.shield.weakpoints.filter(Boolean).length : 0;

        if (p2Time < 0.22) {
          inputs.keys['KeyW'] = true;
        } else if (p2Time < 0.78) {
          inputs.keys['KeyA'] = true;
          inputs.keys['KeyW'] = true;
        } else if (!state.p2BlinkedOpt && p2Time >= 0.78) {
          inputs.keys['KeyW'] = true;
          inputs.actions.push('skill2');
          state.p2BlinkedOpt = true;
        } else if (remainingWp > 1) {
          inputs.keys['KeyW'] = true;
          inputs.keys['KeyD'] = true;
        } else {
          inputs.keys['KeyS'] = true;
        }
      } else if (boss.shield.isShattering) {
        inputs.keys = {};
        if (player.x < boss.x - 2) inputs.keys['KeyD'] = true;
        else if (player.x > boss.x + 2) inputs.keys['KeyA'] = true;
      } else {
        inputs.keys = {};
        const targetY = boss.y + 45;
        const targetX = boss.x;
        if (player.y > targetY + 2) inputs.keys['KeyW'] = true;
        else if (player.y < targetY - 2) inputs.keys['KeyS'] = true;
        if (player.x < targetX - 2) inputs.keys['KeyD'] = true;
        else if (player.x > targetX + 2) inputs.keys['KeyA'] = true;
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

    const phase = boss.currentPhaseIndex;
    if (!stats.byPhase[phase]) {
      stats.byPhase[phase] = { wpHits: 0, coreHits: 0, deflects: 0, shatters: 0, hitSeq: [] };
    }
    const pStats = stats.byPhase[phase];

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
              pStats.coreHits++;
              continue;
            }
            continue;
          }
        }
        const dist = Math.hypot(b.x - boss.x, b.y - boss.y);
        if (dist <= boss.shield.radius + 8) {
          b.alive = false;
          if (boss.shield.isShattering) {
            pStats.shatters++;
          } else {
            const hitAngle = Math.atan2(b.y - boss.y, b.x - boss.x);
            const angleStep = (Math.PI * 2) / boss.shield.count;
            if (!boss.shield.firstHitRegistered) {
              boss.shield.firstHitRegistered = true;
              boss.shield.currentAngle = hitAngle;
              boss.shield.weakpoints[0] = false;
              boss.shield.isRotating = true;
              pStats.wpHits++;
              pStats.hitSeq.push('WP0');
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
                pStats.wpHits++;
                pStats.hitSeq.push(`WP${hitIdx}`);
                boss.shield.checkAllWeakpoints();
              } else {
                pStats.deflects++;
                pStats.hitSeq.push('DEF');
              }
            }
          }
        }
      } else {
        const dist = Math.hypot(b.x - boss.x, b.y - boss.y);
        if (dist <= boss.radius + 6) {
          b.alive = false;
          boss.takeDamage(1, null, elapsed);
          pStats.coreHits++;
        }
      }
    }
    elapsed += dt;
  }

  console.log(`\nRun finished at ${elapsed.toFixed(2)}s, Boss dead: ${boss.isDead}`);
  console.log('Statistics by Phase:');
  for (const ph in stats.byPhase) {
    const s = stats.byPhase[ph];
    console.log(`Phase ${ph}: wpHits=${s.wpHits}, coreHits=${s.coreHits}, deflects=${s.deflects}, shatters=${s.shatters}, sequence=${s.hitSeq.join('->')}`);
  }
}

testFullRunFinal();
