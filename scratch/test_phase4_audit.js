import { Boss } from '../src/game/Boss.js';
import { Player } from '../src/game/Player.js';
import { STAGE_STRATEGIES } from '../src/tas/strategies.js';

const w = 800;
const h = 800;
const dt = 1 / 60;

const boss = new Boss(w / 2, 130, {
  phaseSequence: [7, 5, 8, 4, 9],
  phaseHps: [7, 7, 8, 9, 11],
  enableBullets: true
});

const player = new Player(w / 2, h - 90, boss);
player.autoFire = true;

const strategy = STAGE_STRATEGIES['2-boss'];
const state = strategy.init();

let elapsed = 0;
let phase4Events = [];

let currentPhase = -1;

while (elapsed < 25.0 && !boss.isDead && player.hp > 0) {
  elapsed += dt;
  const phase = boss.currentPhaseIndex;
  if (phase !== currentPhase) {
    console.log(`>>> Enter Phase ${phase} at t=${elapsed.toFixed(3)}s, Player HP: ${player.hp}, Pos: (${player.x.toFixed(1)}, ${player.y.toFixed(1)})`);
    currentPhase = phase;
  }

  const inputs = strategy.update({ player, enemy: boss }, elapsed, state);

  // Handle inputs
  const inputObj = {
    keys: inputs.keys,
    actions: [...inputs.actions],
    consumeSkill2() {
      const idx = this.actions.indexOf('skill2');
      if (idx !== -1) { this.actions.splice(idx, 1); return true; }
      return false;
    },
    consumeSkill3() {
      const idx = this.actions.indexOf('skill3');
      if (idx !== -1) { this.actions.splice(idx, 1); return true; }
      return false;
    },
    getMovementVector() {
      let x = 0, y = 0;
      if (this.keys['KeyW']) y -= 1;
      if (this.keys['KeyS']) y += 1;
      if (this.keys['KeyA']) x -= 1;
      if (this.keys['KeyD']) x += 1;
      if (x !== 0 && y !== 0) {
        const inv = 0.70710678;
        return { x: x * inv, y: y * inv };
      }
      return { x, y };
    }
  };

  player.update(dt, inputObj, w, h, boss.bullets);
  boss.update(dt, elapsed * 1000, player, { recordHit() {}, getFrequency() { return 4.0; } });

  // Check player bullets
  for (const b of player.bullets) {
    if (!b.alive) continue;
    if (phase === 4) {
      if (!b._tracked) {
        b._tracked = true;
        // console.log(`[P4 Bullet Fired] at t=${elapsed.toFixed(3)}s, player pos=(${player.x.toFixed(1)}, ${player.y.toFixed(1)})`);
      }
    }

    if (!boss.shield.isBroken) {
      const prevAlive = b.alive;
      const hitWp = boss.shield.checkBulletCollision(b, null, Date.now());
      if (hitWp) {
        if (phase === 4) {
          phase4Events.push({
            t: elapsed,
            type: 'WP_HIT',
            wpRemaining: boss.shield.weakpoints.filter(wp => wp.alive).length,
            playerPos: { x: player.x, y: player.y },
            bulletPos: { x: b.x, y: b.y }
          });
          console.log(`[P4 WP HIT] t=${elapsed.toFixed(3)}s, wpRemaining=${boss.shield.weakpoints.filter(wp => wp.alive).length}, player=(${player.x.toFixed(1)}, ${player.y.toFixed(1)})`);
        }
        continue;
      } else if (!b.alive && prevAlive) {
        // Bullet was deflected!
        if (phase === 4) {
          phase4Events.push({
            t: elapsed,
            type: 'DEFLECT',
            playerPos: { x: player.x, y: player.y },
            bulletPos: { x: b.x, y: b.y }
          });
          console.log(`[P4 DEFLECT / 空弹!] t=${elapsed.toFixed(3)}s, player=(${player.x.toFixed(1)}, ${player.y.toFixed(1)}), bullet=(${b.x.toFixed(1)}, ${b.y.toFixed(1)})`);
        }
        continue;
      }

      if (!boss.shield.isShattering) {
        if (Math.hypot(b.x - boss.x, b.y - boss.y) <= boss.radius + 6) {
          b.alive = false;
          if (phase === 4) {
            console.log(`[P4 CORE HIT (Inside Shield)] t=${elapsed.toFixed(3)}s, Boss HP: ${boss.currentPhaseHp - 1}`);
          }
          boss.takeDamage(1, null, Date.now());
        }
      }
    } else {
      if (Math.hypot(b.x - boss.x, b.y - boss.y) <= boss.radius + 6) {
        b.alive = false;
        if (phase === 4) {
          console.log(`[P4 CORE HIT (Shield Broken)] t=${elapsed.toFixed(3)}s, Boss HP: ${boss.currentPhaseHp - 1}`);
        }
        boss.takeDamage(1, null, Date.now());
      }
    }
  }
}

console.log(`\nSimulation Finished at t=${elapsed.toFixed(3)}s, Boss Dead=${boss.isDead}, Player HP=${player.hp}/3`);
const defs = phase4Events.filter(e => e.type === 'DEFLECT');
console.log(`Total Phase 4 Deflects (空弹): ${defs.length}`);
