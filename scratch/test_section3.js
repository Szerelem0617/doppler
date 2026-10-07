import { Boss } from '../src/game/Boss.js';
import { Player } from '../src/game/Player.js';
import { Bullet } from '../src/game/Bullet.js';

console.log('==============================================');
console.log(' SECTION 3 TRIAL (Phase 2: 8 WP, 8 HP)');
console.log(' Plan: 前4发W+闪现后4发破8盾 -> 进圈输出清空8血并停在圈内');
console.log('==============================================');

const w = 800;
const h = 800;
const dt = 1 / 60;

function getSection2Checkpoint() {
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

  // Run Phase 0 & Phase 1
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
        if (this.keys['KeyD']) x += 1;
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
      } else {
        if (!p1Shielded) {
          input.actions.push('skill3');
          p1Shielded = true;
        }
        input.keys['KeyS'] = true;
      }
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
  }

  player.skill1CdTimer = 0;
  player.skill2CdTimer = 0;

  return { player, boss, elapsed };
}

function runSection3Attempt(attemptNum, params = {}) {
  const cp = getSection2Checkpoint();
  const player = cp.player;
  const boss = cp.boss;
  let elapsed = cp.elapsed;
  const startElapsed = elapsed;

  console.log(`[Attempt ${attemptNum} Start] Player: (${player.x.toFixed(1)}, ${player.y.toFixed(1)}), Boss Phase: ${boss.currentPhaseIndex}, Boss HP: ${boss.currentPhaseHp}`);

  let maxTime = startElapsed + 6.0;
  let hasBlinked = false;
  let phase2Completed = false;

  const blinkDelay = params.blinkDelay || 0.65; // Time into Phase 2 to blink

  while (elapsed < maxTime) {
    elapsed += dt;
    const phaseElapsed = elapsed - startElapsed;

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

    // 破盾阶段
    if (!boss.shield.isBroken && !boss.shield.isShattering) {
      if (!hasBlinked && phaseElapsed >= blinkDelay) {
        input.keys['KeyA'] = true;
        input.actions.push('skill2');
        hasBlinked = true;
      } else if (hasBlinked) {
        input.keys['KeyW'] = true;
        input.keys['KeyD'] = true;
      } else {
        input.keys['KeyW'] = true;
      }
    }
    // 碎盾过载阶段：全速前冲进圈！
    else if (boss.shield.isShattering) {
      input.keys['KeyW'] = true;
    }
    // 伤害阶段：全速进圈输出并停在圈内
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
      phase2Completed = true;
      break;
    }
  }

  const distToBoss = Math.hypot(player.x - boss.x, player.y - boss.y);
  const isInsideCircle = distToBoss <= boss.shield.radius;
  const success = phase2Completed && player.hp === 3 && isInsideCircle;

  console.log(`[Attempt ${attemptNum} Result] Success: ${success}, Duration: ${(elapsed - startElapsed).toFixed(3)}s, Player HP: ${player.hp}, DistToBoss: ${distToBoss.toFixed(1)}px (Shield R: ${boss.shield.radius}px, isInside: ${isInsideCircle})`);
  return { success, player, boss, elapsed, isInsideCircle };
}

// Sweep blinkDelay across attempts
let succeeded = false;
const delays = [0.65, 0.55, 0.75, 0.45, 0.85];
for (let i = 0; i < delays.length; i++) {
  const res = runSection3Attempt(i + 1, { blinkDelay: delays[i] });
  if (res.success) {
    console.log(`>>> Section 3 SUCCESS on Attempt ${i + 1} with blinkDelay = ${delays[i]}s! <<<`);
    succeeded = true;
    break;
  }
}
if (!succeeded) {
  console.log('Section 3 needs further tuning.');
}
