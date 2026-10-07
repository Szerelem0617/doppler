import { Boss } from '../src/game/Boss.js';
import { Player } from '../src/game/Player.js';

console.log('--- Testing Section 3 from Centered Checkpoint (x=381.7, y=636.0) ---');

const w = 800;
const h = 800;
const dt = 1 / 60;

function runSection3FromP1(params = {}) {
  const boss = new Boss(w / 2, 130, {
    phaseSequence: [7, 5, 8, 4, 9],
    phaseHps: [7, 7, 8, 9, 11],
    enableBullets: true
  });
  const player = new Player(w / 2, h - 90, boss);
  player.autoFire = true;

  let elapsed = 0;
  let p0Blinked = false;
  let p1Shielded = false;

  // Run Phase 0 & 1
  while (elapsed < 10.0 && boss.currentPhaseIndex < 2) {
    elapsed += dt;
    const input = {
      keys: {},
      actions: [],
      consumeSkill2() { return this.actions.includes('skill2'); },
      consumeSkill3() { return this.actions.includes('skill3'); },
      getMovementVector() {
        let x = 0, y = 0;
        if (this.keys['KeyW']) y -= 1;
        if (this.keys['KeyS']) y += 1;
        if (this.keys['KeyA']) x -= 1;
        if (this.keys['KeyD']) x -= 1;
        return { x, y };
      }
    };

    if (boss.currentPhaseIndex === 0) {
      if (!boss.shield.isBroken && !boss.shield.isShattering) {
        input.keys['KeyW'] = true;
      } else if (!p0Blinked) {
        input.keys['KeyS'] = true;
        input.actions.push('skill2');
        p0Blinked = true;
      } else {
        input.keys['KeyW'] = true;
      }
    } else if (boss.currentPhaseIndex === 1) {
      if (!boss.shield.isBroken && !boss.shield.isShattering) {
        input.keys['KeyS'] = true;
        input.keys['KeyA'] = true;
      } else if (boss.shield.isShattering) {
        input.keys['KeyS'] = true;
        if (player.x < 360) input.keys['KeyD'] = true;
      } else {
        if (!p1Shielded) {
          input.actions.push('skill3');
          p1Shielded = true;
        }
        if (player.x < 380) input.keys['KeyD'] = true;
        else if (player.x > 420) input.keys['KeyA'] = true;
      }
    }

    player.update(dt, input, w, h, boss.bullets);
    boss.update(dt, elapsed, player, { recordHit() {}, getFrequency() { return 4.0; } });

    for (const b of player.bullets) {
      if (!b.alive) continue;
      if (!boss.shield.isBroken) {
        if (boss.shield.checkBulletCollision(b, null, Date.now())) continue;
      } else {
        if (Math.hypot(b.x - boss.x, b.y - boss.y) <= boss.radius + 6) {
          b.alive = false;
          boss.takeDamage(1, null, Date.now());
        }
      }
    }
  }

  // Refresh skill cooldowns
  player.skill1CdTimer = 0;
  player.skill2CdTimer = 0;

  const startElapsed = elapsed;
  let p2Elapsed = 0;
  let hasBlinked = false;
  let p2Success = false;

  console.log(`Starting Phase 2 (Section 3). Player pos: (${player.x.toFixed(1)}, ${player.y.toFixed(1)}), Boss Phase: ${boss.currentPhaseIndex}, Boss HP: ${boss.currentPhaseHp}`);

  while (p2Elapsed < 5.0 && boss.currentPhaseIndex < 3) {
    elapsed += dt;
    p2Elapsed += dt;

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

    // Phase 2: 8 弱点
    if (!boss.shield.isBroken && !boss.shield.isShattering) {
      // 0 ~ blinkDelay: W前推 (击破前4个弱点)
      if (!hasBlinked && p2Elapsed >= params.blinkDelay) {
        input.keys['KeyA'] = true;
        input.actions.push('skill2');
        hasBlinked = true;
      } else if (hasBlinked) {
        // 闪现后：W+D 斜向右上切入回正瞄准轴线 (击破后4个弱点)
        input.keys['KeyW'] = true;
        input.keys['KeyD'] = true;
      } else {
        input.keys['KeyW'] = true;
      }
    }
    // 碎盾与暴露期：全速前冲进圈！
    else {
      input.keys['KeyW'] = true;
    }

    player.update(dt, input, w, h, boss.bullets);
    boss.update(dt, elapsed, player, { recordHit() {}, getFrequency() { return 4.0; } });

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

    if (boss.currentPhaseIndex >= 3) {
      p2Success = true;
      break;
    }
  }

  const distToBoss = Math.hypot(player.x - boss.x, player.y - boss.y);
  const isInside = distToBoss <= boss.shield.radius;
  console.log(`Phase 2 (Section 3) finished! Success: ${p2Success}, Time: ${p2Elapsed.toFixed(3)}s, Player HP: ${player.hp}, DistToBoss: ${distToBoss.toFixed(1)}px (Shield R: ${boss.shield.radius}px, isInside: ${isInside}), Pos: (${player.x.toFixed(1)}, ${player.y.toFixed(1)})`);
  return { success: p2Success && player.hp === 3 && isInside, player, boss, elapsed, distToBoss, isInside };
}

// Sweep blinkDelay from 0.70 to 0.90
for (const bd of [0.78, 0.80, 0.82, 0.84, 0.86]) {
  console.log(`\nTesting blinkDelay = ${bd}s...`);
  const r = runSection3FromP1({ blinkDelay: bd });
  if (r.success) {
    console.log(`>>> Section 3 SUCCESS with blinkDelay = ${bd}s! <<<`);
    break;
  }
}
