import { Boss } from '../src/game/Boss.js';
import { Player } from '../src/game/Player.js';
import { STAGE_STRATEGIES } from '../src/tas/strategies.js';

export function runPhase4Test(p4Strategy) {
  const strat = STAGE_STRATEGIES['2-boss'];
  const state = strat.init();
  const boss = new Boss(400, 130, {
    phaseSequence: [7, 5, 8, 4, 9],
    phaseHps: [7, 7, 7, 9, 11],
    enableBullets: true
  });
  const player = new Player(400, 710, boss);
  boss.configure({
    phaseSequence: [7, 5, 8, 4, 9],
    phaseHps: [7, 7, 7, 9, 11],
    enableBullets: true
  });

  const ctx = { player, enemy: boss };
  let elapsed = 0;
  const dt = 1 / 60;
  let p4Deflects = 0;
  let p4WpHits = 0;
  let p4HitSeq = [];

  while (elapsed < 25 && !boss.isDead && !player.isDead) {
    const inputs = strat.update(ctx, elapsed, state);

    if (boss.currentPhaseIndex === 4) {
      p4Strategy(inputs, ctx, elapsed, state);
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

    player.update(dt, inputObj, 800, 800, boss.bullets);
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
          if (boss.shield.isShattering) continue;
          const hitAngle = Math.atan2(b.y - boss.y, b.x - boss.x);
          const angleStep = (Math.PI * 2) / boss.shield.count;
          let hitIdx = -1;
          const tolerance = Math.max(0.22, Math.min(0.38, ((Math.PI * 2) / boss.shield.count) * 0.42));
          if (!boss.shield.firstHitRegistered) {
            boss.shield.firstHitRegistered = true;
            boss.shield.currentAngle = hitAngle;
            boss.shield.weakpoints[0] = false;
            boss.shield.isRotating = true;
            boss.shield.checkAllWeakpoints();
            if (boss.currentPhaseIndex === 4) {
              p4WpHits++;
              p4HitSeq.push(`WP0`);
            }
          } else {
            for (let i = 0; i < boss.shield.count; i++) {
              if (!boss.shield.weakpoints[i]) continue;
              const wpAngle = (boss.shield.currentAngle + i * angleStep) % (Math.PI * 2);
              let diff = Math.abs(hitAngle - wpAngle);
              if (diff > Math.PI) diff = Math.PI * 2 - diff;
              if (diff <= tolerance) { hitIdx = i; break; }
            }
            if (hitIdx !== -1) {
              boss.shield.weakpoints[hitIdx] = false;
              boss.shield.checkAllWeakpoints();
              if (boss.currentPhaseIndex === 4) {
                p4WpHits++;
                p4HitSeq.push(`WP${hitIdx}`);
              }
            } else {
              if (boss.currentPhaseIndex === 4) {
                p4Deflects++;
                p4HitSeq.push(`DEF`);
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
  return { elapsed, playerHp: player.hp, bossDead: boss.isDead, p4Deflects, p4WpHits, p4HitSeq, finalX: player.x, finalY: player.y };
}

console.log('Testing Phase 4 strategies...');

// Test 1: What does current strategies.js produce?
const rCurrent = runPhase4Test((inputs, ctx, elapsed, state) => {
  // uses default
});
console.log('Current in strategies.js:', {
  time: rCurrent.elapsed.toFixed(2),
  dead: rCurrent.bossDead,
  hp: rCurrent.playerHp,
  p4Deflects: rCurrent.p4Deflects,
  hits: rCurrent.p4HitSeq.join('->')
});

// Test 2: Sweep A pulse duration
for (let dur = 0.2; dur <= 1.2; dur += 0.1) {
  const r = runPhase4Test((inputs, ctx, elapsed, state) => {
    const p4Time = state.p4StartTime ? elapsed - state.p4StartTime : 0;
    const punchDelay = ctx.enemy.invadeThreshold || 0.44;
    if (p4Time < punchDelay) {
      inputs.keys = { 'KeyW': true };
    } else if (p4Time >= punchDelay + 0.05) {
      if (!ctx.enemy.shield.isBroken && !ctx.enemy.shield.isShattering && !state.p4ShieldWasBroken) {
        inputs.keys = {};
        const holdY = 540;
        if (ctx.player.y < holdY - 4) inputs.keys['KeyS'] = true;
        else if (ctx.player.y > holdY + 4) inputs.keys['KeyW'] = true;

        if (p4Time >= punchDelay + 0.05 && p4Time < punchDelay + 0.05 + dur) {
          inputs.keys['KeyA'] = true;
        }
      } else if (ctx.enemy.shield.isBroken || ctx.enemy.shield.isShattering) {
        inputs.keys = { 'KeyW': true };
      } else if (state.p4ShieldRestoredTime) {
        if (!state.p4Blinked) {
          inputs.actions.push('skill2');
          state.p4Blinked = true;
        }
      }
    }
  });
  console.log(`dur=${dur.toFixed(1)}s -> Deflects: ${r.p4Deflects}, BossDead: ${r.bossDead}, PlayerHp: ${r.playerHp}, Hits: ${r.p4HitSeq.join('->')}`);
}

