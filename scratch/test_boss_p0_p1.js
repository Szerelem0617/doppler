import { Boss } from '../src/game/Boss.js';
import { Player } from '../src/game/Player.js';

const dt = 1 / 60;
const w = 800, h = 800;

const boss = new Boss(w / 2, 130, {
  phaseSequence: [7, 5, 8, 4, 9],
  phaseHps: [7, 7, 7, 9, 11],
  enableBullets: true
});
const player = new Player(w / 2, 710, boss);
player.autoFire = true;

let elapsed = 0;
let p0Blinked = false;
let p1StartTime = null;

let p1WpHits = 0;
let p1Missed = 0;

for (let t = 0; t < 7.0; t += dt) {
  elapsed = t;
  const phase = boss.currentPhaseIndex;

  const input = {
    keys: {},
    actions: [],
    consumeSkill1() { const i = this.actions.indexOf('skill2'); if (i !== -1) { this.actions.splice(i, 1); return true; } return false; },
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

  // Phase 0
  if (phase === 0) {
    if (!boss.shield.isBroken) {
      input.keys['KeyW'] = true;
    } else if (boss.shield.isBroken && !p0Blinked) {
      input.keys['KeyS'] = true;
      input.actions.push('skill2');
      p0Blinked = true;
    } else {
      input.keys['KeyW'] = true;
    }
  }
  // Phase 1 (5 弱点): PURE S RETREAT until broken, then PURE W ADVANCE to melt!
  else if (phase === 1) {
    if (!p1StartTime) p1StartTime = elapsed;
    if (!boss.shield.isBroken) {
      input.keys['KeyS'] = true;
    } else {
      input.keys['KeyW'] = true;
    }
  }

  player.update(dt, input, w, h, boss.bullets);
  boss.update(dt, elapsed * 1000, player, { recordHit() {}, getFrequency() { return 4.0; } });

  for (const b of player.bullets) {
    if (!b.alive) continue;
    if (!boss.shield.isBroken) {
      const dx = b.x - boss.x, dy = b.y - boss.y;
      if (Math.hypot(dx, dy) <= boss.shield.radius + 8) {
        const prev = [...boss.shield.weakpoints];
        boss.shield.checkBulletCollision(b, null, Date.now());
        const after = [...boss.shield.weakpoints];
        if (phase === 1) {
          let hitWp = -1;
          for (let i = 0; i < 5; i++) {
            if (prev[i] && !after[i]) hitWp = i;
          }
          if (hitWp !== -1) {
            p1WpHits++;
            console.log(`[Phase 1] t=${t.toFixed(3)}s (p1Time=${(t-p1StartTime).toFixed(3)}s): HIT WP #${p1WpHits}/5 (WP ${hitWp})! Player Y=${player.y.toFixed(1)}`);
          } else {
            p1Missed++;
            console.log(`[Phase 1] t=${t.toFixed(3)}s: MISSED SHIELD WALL! Total Missed: ${p1Missed}`);
          }
        }
      }
    } else {
      const dx = b.x - boss.x, dy = b.y - boss.y;
      if (Math.hypot(dx, dy) <= boss.radius + 6) {
        b.alive = false;
        boss.takeDamage(1, null, Date.now());
        if (phase === 1) {
          console.log(`[Phase 1] t=${t.toFixed(3)}s: HIT BOSS CORE! Remaining HP: ${boss.currentPhaseHp}`);
        }
      }
    }
  }

  if (boss.currentPhaseIndex === 2) {
    console.log(`\n==============================================`);
    console.log(`Phase 1 COMPLETED at t=${t.toFixed(3)}s!`);
    console.log(`Phase 1 WP Hits: ${p1WpHits}/5, Missed: ${p1Missed}`);
    console.log(`Player HP: ${player.hp}/3, Player Pos: (${player.x.toFixed(1)}, ${player.y.toFixed(1)})`);
    console.log(`==============================================\n`);
    break;
  }
}
