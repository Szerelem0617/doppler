import { Boss } from '../src/game/Boss.js';
import { Player } from '../src/game/Player.js';

console.log('--- Testing precise entry into Boss circle for Section 3 ---');

const w = 800;
const h = 800;
const dt = 1 / 60;

const boss = new Boss(w / 2, 130, {
  phaseSequence: [7, 5, 8, 4, 9],
  phaseHps: [7, 7, 8, 9, 11],
  enableBullets: true
});
boss.currentPhaseIndex = 2;
boss.currentPhaseHp = 8;
boss.shield.setConfiguration(8, 2.8);

const player = new Player(400, 559, boss);
player.autoFire = true;

let elapsed = 0;
let p2Blinked = false;

while (elapsed < 4.5 && boss.currentPhaseIndex === 2) {
  elapsed += dt;

  const input = {
    keys: {},
    actions: [],
    consumeSkill2() {
      const idx = this.actions.indexOf('skill2');
      if (idx !== -1) {
        this.actions.splice(idx, 1);
        return true;
      }
      return false;
    },
    consumeSkill3() { return false; },
    getMovementVector() {
      let x = 0, y = 0;
      if (this.keys['KeyW']) y -= 1;
      if (this.keys['KeyS']) y += 1;
      if (this.keys['KeyA']) x -= 1;
      if (this.keys['KeyD']) x += 1;
      return { x, y };
    }
  };

  // 破盾期 (0 ~ 1.86s)
  if (!boss.shield.isBroken && !boss.shield.isShattering) {
    if (!p2Blinked && elapsed >= 0.82) {
      input.keys['KeyA'] = true;
      input.actions.push('skill2');
      p2Blinked = true;
    } else if (p2Blinked) {
      input.keys['KeyW'] = true;
      input.keys['KeyD'] = true;
    } else {
      input.keys['KeyW'] = true;
    }
  } else {
    // 碎盾与虚弱期：精准向 Boss 护盾正下方内圈 (400, 175) 移动并稳定停在圈内！
    const targetX = boss.x;
    const targetY = boss.y + 45;
    const dx = targetX - player.x;
    const dy = targetY - player.y;

    if (Math.abs(dx) > 10) {
      if (dx > 0) input.keys['KeyD'] = true;
      else input.keys['KeyA'] = true;
    }
    if (Math.abs(dy) > 10) {
      if (dy > 0) input.keys['KeyS'] = true;
      else input.keys['KeyW'] = true;
    }
  }

  player.update(dt, input, w, h, boss.bullets);
  boss.update(dt, elapsed, player, { recordHit() {}, getFrequency() { return 4.0; } });

  for (const b of player.bullets) {
    if (!b.alive) continue;
    if (!boss.shield.isBroken) {
      if (boss.shield.checkBulletCollision(b, null, Date.now())) continue;
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
}

const distToBoss = Math.hypot(player.x - boss.x, player.y - boss.y);
const isInside = distToBoss <= boss.shield.radius;
console.log(`Section 3 Result:
  Time: ${elapsed.toFixed(3)}s
  Boss Phase: ${boss.currentPhaseIndex} (Advanced to Phase 3: ${boss.currentPhaseIndex === 3})
  Player HP: ${player.hp} (Took 0 damage: ${player.hp === 3})
  Player Pos: (${player.x.toFixed(1)}, ${player.y.toFixed(1)})
  DistToBoss: ${distToBoss.toFixed(1)}px (Shield Radius: ${boss.shield.radius}px)
  Is Inside Circle: ${isInside}
  OVERALL SUCCESS: ${boss.currentPhaseIndex === 3 && player.hp === 3 && isInside}
`);
