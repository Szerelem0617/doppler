import { Boss } from '../src/game/Boss.js';
import { Player } from '../src/game/Player.js';
import { BossBullet } from '../src/game/BossBullet.js';

console.log('Testing spreads for fireSnipeLance: [-spread, 0, spread]');

for (const spread of [0.15, 0.20, 0.25, 0.30, 0.35, 0.40]) {
  // Test 1: Stationary player at distance 300
  let stationaryHit = false;
  {
    const boss = new Boss(400, 130, { hp: 100, enableBullets: true });
    const player = new Player(400, 430, boss);
    const dx = player.x - boss.x;
    const dy = player.y - boss.y;
    const angle = Math.atan2(dy, dx);
    const speed = 360;
    [-spread, 0, spread].forEach(offset => {
      const a = angle + offset;
      const vx = Math.cos(a) * speed;
      const vy = Math.sin(a) * speed;
      boss.bullets.push(new BossBullet(boss.x, boss.y, vx, vy));
    });

    for (let f = 0; f < 120; f++) {
      const dt = 1/60;
      player.update(dt, { getMovementVector: () => ({ x: 0, y: 0 }) }, 800, 800, boss.bullets);
      boss.update(dt, f * dt, player, { recordHit() {}, getFrequency() { return 4; } });
      if (player.hp < 3) {
        stationaryHit = true;
        break;
      }
    }
  }

  // Test 2: Player moving left (A) to dodge
  let dodgeLeftHit = false;
  {
    const boss = new Boss(400, 130, { hp: 100, enableBullets: true });
    const player = new Player(400, 430, boss);
    const dx = player.x - boss.x;
    const dy = player.y - boss.y;
    const angle = Math.atan2(dy, dx);
    const speed = 360;
    [-spread, 0, spread].forEach(offset => {
      const a = angle + offset;
      const vx = Math.cos(a) * speed;
      const vy = Math.sin(a) * speed;
      boss.bullets.push(new BossBullet(boss.x, boss.y, vx, vy));
    });

    for (let f = 0; f < 120; f++) {
      const dt = 1/60;
      player.update(dt, { getMovementVector: () => ({ x: -1, y: 0 }) }, 800, 800, boss.bullets);
      boss.update(dt, f * dt, player, { recordHit() {}, getFrequency() { return 4; } });
      if (player.hp < 3) {
        dodgeLeftHit = true;
        break;
      }
    }
  }

  // Test 3: Player moving down-left (S+A) to dodge
  let dodgeDiagHit = false;
  {
    const boss = new Boss(400, 130, { hp: 100, enableBullets: true });
    const player = new Player(400, 430, boss);
    const dx = player.x - boss.x;
    const dy = player.y - boss.y;
    const angle = Math.atan2(dy, dx);
    const speed = 360;
    [-spread, 0, spread].forEach(offset => {
      const a = angle + offset;
      const vx = Math.cos(a) * speed;
      const vy = Math.sin(a) * speed;
      boss.bullets.push(new BossBullet(boss.x, boss.y, vx, vy));
    });

    for (let f = 0; f < 120; f++) {
      const dt = 1/60;
      player.update(dt, { getMovementVector: () => ({ x: -0.707, y: 0.707 }) }, 800, 800, boss.bullets);
      boss.update(dt, f * dt, player, { recordHit() {}, getFrequency() { return 4; } });
      if (player.hp < 3) {
        dodgeDiagHit = true;
        break;
      }
    }
  }

  console.log(`Spread ${spread.toFixed(2)}: stationaryHit=${stationaryHit}, dodgeLeftHit=${dodgeLeftHit}, dodgeDiagHit=${dodgeDiagHit}`);
}
