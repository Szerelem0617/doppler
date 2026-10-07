import { Shield } from '../src/game/Shield.js';
import { STAGE_STRATEGIES } from '../src/tas/strategies.js';

console.log('--- Simulating Stage 1 Full Playthrough with 0.3s Shatter Mechanic ---');

// Mock enemy & player setup matching STAGE 1
const w = 800;
const h = 800;
const enemy = {
  x: w / 2,
  y: 130,
  maxHp: 70,
  hp: 70,
  radius: 28,
  isDead: false,
  takeDamage(amount) {
    this.hp = Math.max(0, this.hp - amount);
    if (this.hp <= 0) this.isDead = true;
  }
};
enemy.shield = new Shield(enemy, 6, 78, 0.22);
enemy.shield.rechargeDuration = 2.0;

const player = {
  x: w / 2,
  y: h - 90,
  speed: 220,
  autoFire: false,
  fireInterval: 0.22,
  fireTimer: 0,
  bullets: [],
  enemy: enemy
};

const input = {
  keys: {},
  actions: []
};

const strat = STAGE_STRATEGIES['1'];
const stratState = strat.init ? strat.init() : {};

let elapsed = 0;
const dt = 1 / 60; // 60 FPS
let maxTime = 6.0;
let phaseLog = [];
let lastState = '';

while (elapsed < maxTime && !enemy.isDead) {
  elapsed += dt;

  // TAS update
  const ctx = { player, enemy };
  const inputs = strat.update(ctx, elapsed, stratState);
  if (inputs.actions && inputs.actions.includes('toggleFire')) {
    player.autoFire = true;
  }
  input.keys = inputs.keys || {};

  // Player movement
  let moveY = 0;
  if (input.keys['KeyW']) moveY -= 1;
  if (input.keys['KeyS']) moveY += 1;
  player.y += moveY * player.speed * dt;

  // Player shooting
  if (player.autoFire) {
    player.fireTimer += dt;
    if (player.fireTimer >= player.fireInterval) {
      player.fireTimer = 0;
      player.bullets.push({
        x: player.x,
        y: player.y,
        speed: 480,
        alive: true,
        damage: 10
      });
    }
  }

  // Update bullets
  for (const b of player.bullets) {
    if (!b.alive) continue;
    const dy = enemy.y - b.y;
    const dist = Math.abs(dy);
    if (dist > 0) {
      b.y -= b.speed * dt;
    }
  }

  // Update shield
  enemy.shield.update(dt, player);

  // Collisions
  for (const b of player.bullets) {
    if (!b.alive) continue;

    if (!enemy.shield.isBroken) {
      const hit = enemy.shield.checkBulletCollision(b, null, Date.now());
      if (hit) continue;
    } else {
      const dist = Math.hypot(b.x - enemy.x, b.y - enemy.y);
      if (dist <= enemy.radius + 6) {
        b.alive = false;
        enemy.takeDamage(b.damage);
      }
    }
  }

  // Log state transitions
  let curState = enemy.shield.isShattering ? 'SHATTERING' : (enemy.shield.isBroken ? 'BROKEN' : 'SHIELDED');
  if (curState !== lastState) {
    phaseLog.push({ time: elapsed.toFixed(3), state: curState, playerY: player.y.toFixed(1), enemyHp: enemy.hp });
    lastState = curState;
  }
}

console.log('State Transitions:');
for (const p of phaseLog) {
  console.log(`  At ${p.time}s: Entered [${p.state}], Player Y = ${p.playerY}, Enemy HP = ${p.enemyHp}`);
}

console.assert(enemy.isDead, 'Enemy should be dead within the vulnerable window');
console.log(`Stage 1 successfully cleared in ${elapsed.toFixed(2)}s!`);
