import { Enemy } from '../src/game/Enemy.js';
import { STAGE_STRATEGIES } from '../src/tas/strategies.js';

console.log('--- Testing Stage 1 with Enemy Class Directly ---');

const w = 800;
const h = 800;
const enemy = new Enemy(w / 2, 130);

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

const input = { keys: {}, actions: [] };
const strat = STAGE_STRATEGIES['1'];
const stratState = strat.init ? strat.init() : {};

let elapsed = 0;
const dt = 1 / 60;
let lastState = '';

while (elapsed < 6.0 && !enemy.isDead) {
  elapsed += dt;

  const ctx = { player, enemy };
  const inputs = strat.update(ctx, elapsed, stratState);
  if (inputs.actions && inputs.actions.includes('toggleFire')) {
    player.autoFire = true;
  }
  input.keys = inputs.keys || {};

  let moveY = 0;
  if (input.keys['KeyW']) moveY -= 1;
  if (input.keys['KeyS']) moveY += 1;
  player.y += moveY * player.speed * dt;

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

  for (const b of player.bullets) {
    if (!b.alive) continue;
    b.y -= b.speed * dt;
  }

  enemy.update(dt, elapsed, player, null);

  for (const b of player.bullets) {
    if (!b.alive) continue;
    if (!enemy.shield.isBroken) {
      const hit = enemy.shield.checkBulletCollision(b, null, Date.now());
      if (hit) continue;
    } else {
      const dist = Math.hypot(b.x - enemy.x, b.y - enemy.y);
      if (dist <= enemy.radius + 6) {
        b.alive = false;
        enemy.takeDamage(b.damage, { recordHit() {}, getFrequency() { return 4.0; } }, Date.now());
      }
    }
  }

  let curState = enemy.shield.isShattering ? 'SHATTERING' : (enemy.shield.isBroken ? 'BROKEN' : 'SHIELDED');
  if (curState !== lastState) {
    console.log(`  At ${elapsed.toFixed(3)}s: State -> [${curState}], Player Y = ${player.y.toFixed(1)}, Enemy HP = ${enemy.hp}`);
    lastState = curState;
  }
}

console.assert(enemy.isDead, 'Enemy should be dead');
console.log(`Enemy dead: ${enemy.isDead}, Stage 1 cleared in: ${elapsed.toFixed(2)}s`);
