import { Boss } from '../src/game/Boss.js';
import { Player } from '../src/game/Player.js';

console.log('--- Testing Phase 5 Details ---');
const w = 800;
const h = 800;
const dt = 1 / 60;

const boss = new Boss(w / 2, 130, {
  phaseSequence: [7, 5, 8, 4, 9],
  phaseHps: [7, 7, 8, 9, 11],
  enableBullets: true
});
boss.currentPhaseIndex = 4;
boss.currentPhaseHp = 11;
boss.shield.setConfiguration(9, 2.8);
boss.firePhase5SpawnBarrage();
console.log('Initial bullets count:', boss.bullets.length);

const player = new Player(400, 480, boss);
player.hp = 2;
player.autoFire = true;

let elapsed = 0;
let hitTime = null;
let blinkTime = null;

for (let frame = 0; frame < 180; frame++) {
  elapsed += dt;

  const input = {
    keys: { KeyW: true },
    actions: [],
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
      return this.keys['KeyW'] ? { x: 0, y: -1 } : { x: 0, y: 0 };
    }
  };

  // If hit and invincible, blink in!
  if (player.invincibleTimer > 0 && !blinkTime) {
    input.keys['KeyW'] = false; // release W so blink warps inside shield!
    input.actions.push('skill2');
    blinkTime = elapsed;
  }

  // Once blinked in, trigger L reflect shield
  if (blinkTime && !player.skill1Active && player.skill1CdTimer <= 0) {
    input.actions.push('skill3');
  }

  player.update(dt, input, w, h, boss.bullets);
  boss.update(dt, elapsed, player, { recordHit() {}, getFrequency() { return 4.0; } });

  // Player laser damage inside shield
  for (const b of player.bullets) {
    if (!b.alive) continue;
    if (!boss.shield.isBroken) {
      const hit = boss.shield.checkBulletCollision(b, null, Date.now());
      if (hit) continue;
      if (!boss.shield.isShattering) {
        if (Math.hypot(b.x - boss.x, b.y - boss.y) <= boss.radius + 6) {
          b.alive = false;
          boss.takeDamage(1, null, Date.now());
        }
      }
    } else {
      if (Math.hypot(b.x - boss.x, b.y - boss.y) <= boss.radius + 6) {
        b.alive = false;
        boss.takeDamage(1, null, Date.now());
      }
    }
  }

  if (player.hp === 1 && hitTime === null) {
    hitTime = elapsed;
    console.log(`Player hit at t=${elapsed.toFixed(3)}s! Player Y=${player.y.toFixed(1)}, HP=${player.hp}`);
  }

  if (blinkTime && Math.abs(elapsed - blinkTime) < 0.001) {
    console.log(`Player blinked to (${player.x.toFixed(1)}, ${player.y.toFixed(1)}) at t=${elapsed.toFixed(3)}s`);
  }

  if (boss.isDead) {
    console.log(`Boss died at t=${elapsed.toFixed(3)}s! Remaining HP: ${boss.currentPhaseHp}`);
    break;
  }
}

console.log(`End: Boss HP=${boss.currentPhaseHp}, Player HP=${player.hp}, isDead=${boss.isDead}`);
