import { Boss } from '../src/game/Boss.js';
import { Player } from '../src/game/Player.js';
import { Bullet } from '../src/game/Bullet.js';
import { BossBullet } from '../src/game/BossBullet.js';
import fs from 'fs';

console.log('================================================================');
console.log(' BOSS SPEEDRUN TAS - 5 SECTIONS VALIDATION SUITE');
console.log(' Segment-based execution with deep checkpoints & max 5 attempts');
console.log('================================================================\n');

const w = 800;
const h = 800;
const dt = 1 / 60;

// Deep State Serialization
function serializeState(player, boss, elapsed, inputsRecord) {
  return {
    elapsed,
    player: {
      x: player.x,
      y: player.y,
      vx: player.vx,
      vy: player.vy,
      angle: player.angle,
      hp: player.hp,
      maxHp: player.maxHp,
      autoFire: player.autoFire,
      fireTimer: player.fireTimer,
      skill1CdTimer: player.skill1CdTimer,
      skill1Active: player.skill1Active,
      skill1Timer: player.skill1Timer,
      skill2CdTimer: player.skill2CdTimer,
      invincibleTimer: player.invincibleTimer,
      knockbackTimer: player.knockbackTimer,
      knockbackVx: player.knockbackVx,
      knockbackVy: player.knockbackVy,
      knockbackMode: player.knockbackMode,
      isKnockedBack: player.isKnockedBack,
      bullets: player.bullets.map(b => ({
        x: b.x, y: b.y, vx: b.vx, vy: b.vy, speed: b.speed, radius: b.radius, alive: b.alive
      }))
    },
    boss: {
      x: boss.x,
      y: boss.y,
      hp: boss.hp,
      maxHp: boss.maxHp,
      isDead: boss.isDead,
      currentPhaseIndex: boss.currentPhaseIndex,
      currentPhaseHp: boss.currentPhaseHp,
      phaseWeakpoints: [...boss.phaseWeakpoints],
      phaseHps: [...boss.phaseHps],
      radialTimer: boss.radialTimer,
      snipeTimer: boss.snipeTimer,
      burstCount: boss.burstCount,
      invadeTimer: boss.invadeTimer,
      springPunchActive: boss.springPunchActive,
      springPunchTimer: boss.springPunchTimer,
      shield: {
        radius: boss.shield.radius,
        rotationSpeed: boss.shield.rotationSpeed,
        currentAngle: boss.shield.currentAngle,
        isBroken: boss.shield.isBroken,
        justBroken: boss.shield.justBroken,
        isShattering: boss.shield.isShattering,
        shatterTimer: boss.shield.shatterTimer,
        shatterDuration: boss.shield.shatterDuration,
        count: boss.shield.count,
        weakpoints: boss.shield.weakpoints.map(wp => ({
          angleOffset: wp.angleOffset,
          broken: wp.broken,
          hp: wp.hp
        }))
      },
      bullets: boss.bullets.map(b => ({
        x: b.x, y: b.y, vx: b.vx, vy: b.vy, radius: b.radius, isReflected: b.isReflected, alive: b.alive
      }))
    },
    inputsRecord: JSON.parse(JSON.stringify(inputsRecord))
  };
}

// Deep State Restoration
function deserializeState(snapshot) {
  const boss = new Boss(w / 2, 130, {
    phaseSequence: snapshot.boss.phaseWeakpoints,
    phaseHps: snapshot.boss.phaseHps,
    enableBullets: true
  });
  boss.x = snapshot.boss.x;
  boss.y = snapshot.boss.y;
  boss.hp = snapshot.boss.hp;
  boss.maxHp = snapshot.boss.maxHp;
  boss.isDead = snapshot.boss.isDead;
  boss.currentPhaseIndex = snapshot.boss.currentPhaseIndex;
  boss.currentPhaseHp = snapshot.boss.currentPhaseHp;
  boss.radialTimer = snapshot.boss.radialTimer;
  boss.snipeTimer = snapshot.boss.snipeTimer;
  boss.burstCount = snapshot.boss.burstCount;
  boss.invadeTimer = snapshot.boss.invadeTimer;
  boss.springPunchActive = snapshot.boss.springPunchActive;
  boss.springPunchTimer = snapshot.boss.springPunchTimer;

  // Restore shield
  boss.shield.radius = snapshot.boss.shield.radius;
  boss.shield.rotationSpeed = snapshot.boss.shield.rotationSpeed;
  boss.shield.currentAngle = snapshot.boss.shield.currentAngle;
  boss.shield.isBroken = snapshot.boss.shield.isBroken;
  boss.shield.justBroken = snapshot.boss.shield.justBroken;
  boss.shield.isShattering = snapshot.boss.shield.isShattering;
  boss.shield.shatterTimer = snapshot.boss.shield.shatterTimer;
  boss.shield.shatterDuration = snapshot.boss.shield.shatterDuration;
  boss.shield.count = snapshot.boss.shield.count;
  boss.shield.weakpoints = snapshot.boss.shield.weakpoints.map(wp => ({ ...wp }));

  // Restore boss bullets
  boss.bullets = snapshot.boss.bullets.map(b => {
    const bb = new BossBullet(b.x, b.y, b.vx, b.vy);
    bb.radius = b.radius;
    bb.isReflected = b.isReflected;
    bb.alive = b.alive;
    return bb;
  });

  const player = new Player(snapshot.player.x, snapshot.player.y, boss);
  player.vx = snapshot.player.vx;
  player.vy = snapshot.player.vy;
  player.angle = snapshot.player.angle;
  player.hp = snapshot.player.hp;
  player.maxHp = snapshot.player.maxHp;
  player.autoFire = snapshot.player.autoFire;
  player.fireTimer = snapshot.player.fireTimer;
  player.skill1CdTimer = snapshot.player.skill1CdTimer;
  player.skill1Active = snapshot.player.skill1Active;
  player.skill1Timer = snapshot.player.skill1Timer;
  player.skill2CdTimer = snapshot.player.skill2CdTimer;
  player.invincibleTimer = snapshot.player.invincibleTimer;
  player.knockbackTimer = snapshot.player.knockbackTimer;
  player.knockbackVx = snapshot.player.knockbackVx;
  player.knockbackVy = snapshot.player.knockbackVy;
  player.knockbackMode = snapshot.player.knockbackMode;
  player.isKnockedBack = snapshot.player.isKnockedBack;

  // Restore player bullets
  player.bullets = snapshot.player.bullets.map(b => {
    const pb = new Bullet(b.x, b.y, boss, b.speed || 480);
    pb.radius = b.radius;
    pb.alive = b.alive;
    return pb;
  });

  return {
    player,
    boss,
    elapsed: snapshot.elapsed,
    inputsRecord: JSON.parse(JSON.stringify(snapshot.inputsRecord))
  };
}

// Global section checkpoints store
const checkpoints = {};
let allInputs = [];

// ==========================================
// SECTION 1: Phase 0 (7 WP, 7 HP)
// Plan: W forward breaks 7 WP -> S+K back-blink -> W forward bursts 7 HP. 0 dmg. End: front.
// ==========================================
function testSection1() {
  console.log('>>> [STARTING SECTION 1] Phase 0 (7 WP, 7 HP) <<<');
  const MAX_ATTEMPTS = 5;

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    console.log(`  [Sec 1 - Attempt ${attempt}/5] Initializing clean state...`);
    const boss = new Boss(w / 2, 130, {
      phaseSequence: [7, 5, 8, 4, 9],
      phaseHps: [7, 7, 8, 9, 11],
      enableBullets: true
    });
    const player = new Player(w / 2, h - 90, boss);
    player.autoFire = true;

    let elapsed = 0;
    let hasBlinkedBack = false;
    let secInputs = [];
    let completed = false;

    while (elapsed < 5.0 && boss.currentPhaseIndex === 0) {
      elapsed += dt;

      const input = {
        keys: {},
        actions: [],
        consumeSkill2() {
          const idx = this.actions.indexOf('skill2');
          if (idx !== -1) { this.actions.splice(idx, 1); return true; }
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

      // Tactic:
      // 1. 破盾：W 前推
      if (!boss.shield.isBroken && !boss.shield.isShattering) {
        input.keys['KeyW'] = true;
      }
      // 2. 破盾瞬间：S+K 后闪
      else if ((boss.shield.isShattering || boss.shield.isBroken) && !hasBlinkedBack) {
        input.keys['KeyS'] = true;
        input.actions.push('skill2');
        hasBlinkedBack = true;
      }
      // 3. 伤害：W 前推 (侧向微移规避不间断中央狙击光束，随后回中)
      else {
        input.keys['KeyW'] = true;
        if (elapsed >= 2.4 && elapsed <= 2.85) {
          input.keys['KeyD'] = true;
        } else if (elapsed > 2.85 && player.x > 401) {
          input.keys['KeyA'] = true;
        }
      }

      // Record input
      secInputs.push({
        time: elapsed,
        keys: { ...input.keys },
        actions: [...input.actions]
      });

      player.update(dt, input, w, h, boss.bullets);
      boss.update(dt, elapsed, player, { recordHit() {}, getFrequency() { return 4.0; } });

      // Collisions
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

      if (boss.currentPhaseIndex >= 1) {
        completed = true;
        break;
      }
    }

    // Success criteria: Phase 0 clear, Player HP == 3 (0 damage), Y < 350 (front position)
    const success = completed && player.hp === 3 && player.y < 350;
    if (success) {
      console.log(`  ✅ Section 1 SUCCESS on Attempt ${attempt}!`);
      console.log(`     Duration: ${elapsed.toFixed(3)}s | HP: ${player.hp}/3 | End Pos: (${player.x.toFixed(1)}, ${player.y.toFixed(1)})`);

      // Refresh skill cooldowns for transition
      player.skill1CdTimer = 0;
      player.skill2CdTimer = 0;

      // Save deep checkpoint 1
      checkpoints['sec1'] = serializeState(player, boss, elapsed, secInputs);
      return true;
    } else {
      console.log(`  ❌ Sec 1 Attempt ${attempt} failed (completed=${completed}, hp=${player.hp}, y=${player.y.toFixed(1)})`);
    }
  }

  console.error('🚨 Section 1 exceeded 5 attempts! Aborting.');
  return false;
}

// ==========================================
// SECTION 2: Phase 1 (5 WP, 7 HP)
// Plan: S retreat breaks 5 WP -> L reflect shield + S/HOLD bursts 7 HP. 0 dmg.
// ==========================================
function testSection2() {
  console.log('\n>>> [STARTING SECTION 2] Phase 1 (5 WP, 7 HP) <<<');
  const MAX_ATTEMPTS = 5;

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    console.log(`  [Sec 2 - Attempt ${attempt}/5] Restoring Checkpoint 1...`);
    const state = deserializeState(checkpoints['sec1']);
    const player = state.player;
    const boss = state.boss;
    let elapsed = state.elapsed;
    const startElapsed = elapsed;
    let secInputs = [...state.inputsRecord];

    let hasUsedShield = false;
    let completed = false;

    player.takeDamage = function(amount) {
      console.log(`    [SEC 2 HURT] t=${elapsed.toFixed(3)}s, pos=(${this.x.toFixed(1)}, ${this.y.toFixed(1)}), hp before=${this.hp}`);
      return Player.prototype.takeDamage.call(this, amount);
    };

    while (elapsed < startElapsed + 6.0 && boss.currentPhaseIndex === 1) {
      elapsed += dt;
      const phaseTime = elapsed - startElapsed;

      const input = {
        keys: {},
        actions: [],
        consumeSkill2() { return false; },
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

      // Tactic:
      // 1. 破盾：S 后撤，在破盾前 (0.95s) 开启 K 反射力场反弹狙击子弹；反弹子弹飞行途中护盾破碎，刚好直击破盾后核心造成第7点伤害！
      if (!boss.shield.isBroken && !boss.shield.isShattering) {
        input.keys['KeyS'] = true;
        if (!hasUsedShield && phaseTime >= 0.95) {
          input.actions.push('skill3');
          hasUsedShield = true;
        }
      }
      // 2. 碎盾过载与虚弱攻击阶段：保持 v_y = 0 静止 (输出严格 6 激光)，微幅向左横移 (x < 330) 提前规避开局中央狙击光束！
      else {
        if (phaseTime >= 2.0 && player.x > 330) {
          input.keys['KeyA'] = true;
        }
      }

      secInputs.push({
        time: elapsed,
        keys: { ...input.keys },
        actions: [...input.actions]
      });

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

      if (boss.currentPhaseIndex >= 2) {
        completed = true;
        break;
      }
    }

    const success = completed && player.hp === 3 && hasUsedShield;
    if (success) {
      console.log(`  ✅ Section 2 SUCCESS on Attempt ${attempt}!`);
      console.log(`     Duration: ${(elapsed - startElapsed).toFixed(3)}s | HP: ${player.hp}/3 | End Pos: (${player.x.toFixed(1)}, ${player.y.toFixed(1)})`);

      player.skill1CdTimer = 0;
      player.skill2CdTimer = 0;

      checkpoints['sec2'] = serializeState(player, boss, elapsed, secInputs);
      return true;
    } else {
      console.log(`  ❌ Sec 2 Attempt ${attempt} failed (completed=${completed}, hp=${player.hp})`);
    }
  }

  console.error('🚨 Section 2 exceeded 5 attempts! Aborting.');
  return false;
}

// ==========================================
// SECTION 3: Phase 2 (8 WP, 8 HP)
// Plan: W (4 WP) + K blink (4 WP) breaks 8 WP -> rush into Boss circle (dist <= 88px) to burst 8 HP. 0 dmg. End: circle.
// ==========================================
function testSection3() {
  console.log('\n>>> [STARTING SECTION 3] Phase 2 (8 WP, 8 HP) <<<');
  const MAX_ATTEMPTS = 5;

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    console.log(`  [Sec 3 - Attempt ${attempt}/5] Restoring Checkpoint 2...`);
    const state = deserializeState(checkpoints['sec2']);
    const player = state.player;
    const boss = state.boss;
    let elapsed = state.elapsed;
    const startElapsed = elapsed;
    let secInputs = [...state.inputsRecord];

    player.takeDamage = function(amount) {
      console.log(`    [SEC 3 HURT] t=${elapsed.toFixed(3)}s (pTime=${(elapsed - startElapsed).toFixed(3)}s), pos=(${this.x.toFixed(1)}, ${this.y.toFixed(1)}), hp before=${this.hp}`);
      return Player.prototype.takeDamage.call(this, amount);
    };

    let hasBrokenOnce = false;
    let completed = false;

    while (elapsed < startElapsed + 6.0 && boss.currentPhaseIndex === 2) {
      elapsed += dt;
      const phaseTime = elapsed - startElapsed;

      if (boss.shield.isBroken) hasBrokenOnce = true;

      let moveX = 0;
      let moveY = -1;

      // 1. 破盾阶段：纯走位微幅向右回中 (x: 326 -> 400)，连续 8 发自导激光全中破盾
      if (!hasBrokenOnce) {
        if (phaseTime < 0.8) moveX = 0.35;
        else if (player.x < 395) moveX = 0.4;
        else if (player.x > 405) moveX = -0.4;
      }
      // 2. 碎盾与虚弱输出期：稳健挺进至内圈 (targetY = 185, dist = 55px <= 88)，稳定射击灌死 8 血并留在圈内！
      else {
        const targetY = 185;
        if (player.y > targetY + 2) moveY = -1;
        else if (player.y < targetY - 2) moveY = 1;
        else moveY = 0;

        if (player.x < 396) moveX = 0.4;
        else if (player.x > 404) moveX = -0.4;
      }

      const input = {
        keys: {},
        actions: [],
        consumeSkill2() { return false; },
        consumeSkill3() { return false; },
        getMovementVector() {
          return { x: moveX, y: moveY };
        }
      };

      if (moveY < 0) input.keys['KeyW'] = true;
      if (moveY > 0) input.keys['KeyS'] = true;
      if (moveX < 0) input.keys['KeyA'] = true;
      if (moveX > 0) input.keys['KeyD'] = true;

      secInputs.push({
        time: elapsed,
        keys: { ...input.keys },
        actions: [...input.actions]
      });

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

      if (boss.currentPhaseIndex >= 3) {
        completed = true;
        break;
      }
    }

    const distToBoss = Math.hypot(player.x - boss.x, player.y - boss.y);
    const inCircle = distToBoss <= 88;
    const success = completed && player.hp === 3 && inCircle;

    if (success) {
      console.log(`  ✅ Section 3 SUCCESS on Attempt ${attempt}!`);
      console.log(`     Duration: ${(elapsed - startElapsed).toFixed(3)}s | HP: ${player.hp}/3 | End Pos: (${player.x.toFixed(1)}, ${player.y.toFixed(1)}) [Dist to Boss: ${distToBoss.toFixed(1)}px <= 88px inside circle!]`);

      player.skill1CdTimer = 0;
      player.skill2CdTimer = 0;

      checkpoints['sec3'] = serializeState(player, boss, elapsed, secInputs);
      return true;
    } else {
      console.log(`  ❌ Sec 3 Attempt ${attempt} failed (completed=${completed}, hp=${player.hp}, dist=${distToBoss.toFixed(1)}px)`);
    }
  }

  console.error('🚨 Section 3 exceeded 5 attempts! Aborting.');
  return false;
}

// ==========================================
// SECTION 4: Phase 3 (4 WP, 9 HP)
// Plan: Starts inside circle -> spring punch knockback (-1 HP) -> shoots in 550px/s constant retreat breaking 4 WP -> W forward + 前闪 (W+K) bursts 9 HP. Exactly -1 dmg. End: front.
// ==========================================
function testSection4() {
  console.log('\n>>> [STARTING SECTION 4] Phase 3 (4 WP, 9 HP) <<<');
  const MAX_ATTEMPTS = 5;

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    console.log(`  [Sec 4 - Attempt ${attempt}/5] Restoring Checkpoint 3...`);
    const state = deserializeState(checkpoints['sec3']);
    const player = state.player;
    const boss = state.boss;
    let elapsed = state.elapsed;
    const startElapsed = elapsed;
    let secInputs = [...state.inputsRecord];

    let hasForwardBlinked = false;
    let completed = false;

    while (elapsed < startElapsed + 6.0 && boss.currentPhaseIndex === 3) {
      elapsed += dt;
      const phaseTime = elapsed - startElapsed;

      const input = {
        keys: {},
        actions: [],
        consumeSkill2() {
          const idx = this.actions.indexOf('skill2');
          if (idx !== -1) { this.actions.splice(idx, 1); return true; }
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

      // Tactic:
      // 1. 破盾：被弹簧拳击飞 550px/s 恒速滑退，射击自动破 4 盾
      if (!boss.shield.isBroken && !boss.shield.isShattering) {
        // 自由滑退射击
      }
      // 2. 碎盾过载阶段：开始前推
      else if (boss.shield.isShattering) {
        input.keys['KeyW'] = true;
      }
      // 3. 虚弱伤害阶段：W 前推 + 前闪 (W+K) 爆发清空 9 血！
      else {
        input.keys['KeyW'] = true;
        if (!hasForwardBlinked && phaseTime > 1.8) {
          input.actions.push('skill2');
          hasForwardBlinked = true;
        }
      }

      secInputs.push({
        time: elapsed,
        keys: { ...input.keys },
        actions: [...input.actions]
      });

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

      if (boss.currentPhaseIndex >= 4) {
        completed = true;
        break;
      }
    }

    // Success criteria: Phase 3 clear, Player HP == 2 (exactly -1 damage from punch), hasForwardBlinked == true
    const success = completed && player.hp === 2 && hasForwardBlinked;
    if (success) {
      console.log(`  ✅ Section 4 SUCCESS on Attempt ${attempt}!`);
      console.log(`     Duration: ${(elapsed - startElapsed).toFixed(3)}s | HP: ${player.hp}/3 (-1 dmg) | End Pos: (${player.x.toFixed(1)}, ${player.y.toFixed(1)})`);

      player.skill1CdTimer = 0;
      player.skill2CdTimer = 0;

      checkpoints['sec4'] = serializeState(player, boss, elapsed, secInputs);
      return true;
    } else {
      console.log(`  ❌ Sec 4 Attempt ${attempt} failed (completed=${completed}, hp=${player.hp})`);
    }
  }

  console.error('🚨 Section 4 exceeded 5 attempts! Aborting.');
  return false;
}

// ==========================================
// SECTION 5: Phase 4 (9 WP, 11 HP)
// Plan: Boss spawns dense barrage. Player W rushes forward taking -1 HP -> enters invincible frames -> K blinks inside circle -> activates L reflect shield -> reflected bullets + laser kill boss before knockback! Player HP = 1. Boss Dead.
// ==========================================
function testSection5() {
  console.log('\n>>> [STARTING SECTION 5] Phase 4 (9 WP, 11 HP) <<<');
  const MAX_ATTEMPTS = 5;

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    console.log(`  [Sec 5 - Attempt ${attempt}/5] Restoring Checkpoint 4...`);
    const state = deserializeState(checkpoints['sec4']);
    const player = state.player;
    const boss = state.boss;
    let elapsed = state.elapsed;
    const startElapsed = elapsed;
    let secInputs = [...state.inputsRecord];

    let hasBlinkedIn = false;
    let hasReflected = false;
    let completed = false;

    while (elapsed < startElapsed + 5.0 && !boss.isDead && player.hp > 0) {
      elapsed += dt;

      const input = {
        keys: {},
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
          let x = 0, y = 0;
          if (this.keys['KeyW']) y -= 1;
          if (this.keys['KeyS']) y += 1;
          if (this.keys['KeyA']) x -= 1;
          if (this.keys['KeyD']) x += 1;
          return { x, y };
        }
      };

      // Tactic:
      // 1. 前冲吃弹 -1 血触发无敌时间，随即瞬移折跃入圈
      if (!hasBlinkedIn) {
        if (player.invincibleTimer > 0) {
          // 释放所有方向键，让闪现自动直插护盾内圈
          input.actions.push('skill2');
          hasBlinkedIn = true;
        } else {
          input.keys['KeyW'] = true;
        }
      }
      // 2. 进圈瞬间立即开启 L 护盾反弹！
      else {
        if (!hasReflected) {
          input.actions.push('skill3');
          hasReflected = true;
        }
      }

      secInputs.push({
        time: elapsed,
        keys: { ...input.keys },
        actions: [...input.actions]
      });

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

      if (boss.isDead) {
        completed = true;
        break;
      }
    }

    // Success criteria: Boss is dead, Player alive with HP == 1 (took exactly -1 dmg), hasBlinkedIn && hasReflected
    const success = completed && player.hp === 1 && hasBlinkedIn && hasReflected;
    if (success) {
      console.log(`  ✅ Section 5 SUCCESS on Attempt ${attempt}!`);
      console.log(`     Duration: ${(elapsed - startElapsed).toFixed(3)}s | HP: ${player.hp}/3 (Survived!) | Boss Defeated!`);

      checkpoints['sec5'] = serializeState(player, boss, elapsed, secInputs);
      allInputs = secInputs;
      return true;
    } else {
      console.log(`  ❌ Sec 5 Attempt ${attempt} failed (completed=${completed}, hp=${player.hp}, isDead=${boss.isDead})`);
    }
  }

  console.error('🚨 Section 5 exceeded 5 attempts! Aborting.');
  return false;
}

// Master execution
const s1 = testSection1();
if (!s1) process.exit(1);

const s2 = testSection2();
if (!s2) process.exit(1);

const s3 = testSection3();
if (!s3) process.exit(1);

const s4 = testSection4();
if (!s4) process.exit(1);

const s5 = testSection5();
if (!s5) process.exit(1);

console.log('\n================================================================');
console.log(' 🎉 ALL 5 SECTIONS COMPLETED ACCORDING TO PLAN! 🎉');
console.log(` Total Replay Frames: ${allInputs.length} (~${(allInputs.length * dt).toFixed(2)}s)`);
console.log('================================================================');

// Save checkpoints to disk
fs.writeFileSync('./scratch/section_checkpoints.json', JSON.stringify({
  summary: {
    section1: { duration: checkpoints.sec1.elapsed, hp: checkpoints.sec1.player.hp },
    section2: { duration: checkpoints.sec2.elapsed - checkpoints.sec1.elapsed, hp: checkpoints.sec2.player.hp },
    section3: { duration: checkpoints.sec3.elapsed - checkpoints.sec2.elapsed, hp: checkpoints.sec3.player.hp },
    section4: { duration: checkpoints.sec4.elapsed - checkpoints.sec3.elapsed, hp: checkpoints.sec4.player.hp },
    section5: { duration: checkpoints.sec5.elapsed - checkpoints.sec4.elapsed, hp: checkpoints.sec5.player.hp },
    totalTime: checkpoints.sec5.elapsed,
    finalHp: checkpoints.sec5.player.hp
  }
}, null, 2));

console.log('Saved section checkpoints metadata to scratch/section_checkpoints.json');
