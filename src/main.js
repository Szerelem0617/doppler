import { InputManager } from './engine/Input.js';
import { FrequencyMeter } from './engine/FrequencyMeter.js';
import { audio } from './engine/Audio.js';
import { Enemy } from './game/Enemy.js';
import { Boss } from './game/Boss.js';
import { Player } from './game/Player.js';
import { TASEngine } from './tas/index.js';

// DOM 元素引用
const canvas = document.getElementById('game-canvas');
const ctx = canvas.getContext('2d');
const freqCanvas = document.getElementById('freq-waveform');

const tabStg1 = document.getElementById('tab-stg1');
const tabStg2s7 = document.getElementById('tab-stg2s7');
const tabStg2s5 = document.getElementById('tab-stg2s5');
const tabStg2s8 = document.getElementById('tab-stg2s8');
const tabStg2s4 = document.getElementById('tab-stg2s4');
const tabStg2s9 = document.getElementById('tab-stg2s9');
const tabStg2boss = document.getElementById('tab-stg2boss');
const stageTabs = {
  '1': tabStg1,
  '2-s7': tabStg2s7,
  '2-s5': tabStg2s5,
  '2-s8': tabStg2s8,
  '2-s4': tabStg2s4,
  '2-s9': tabStg2s9,
  '2-boss': tabStg2boss
};

const tasRunBtn = document.getElementById('tas-run-btn');
const tasRunAllBtn = document.getElementById('tas-run-all-btn');

const speedrunTimerCard = document.getElementById('speedrun-timer');
const timerDigits = document.getElementById('timer-digits');

const bossTag = document.getElementById('boss-tag');
const bossHpBar = document.getElementById('boss-hp-bar');
const bossHpText = document.getElementById('boss-hp-text');
const shieldStatusText = document.getElementById('shield-status-text');
const shieldStatusLine = document.getElementById('shield-status-line');
const shieldRechargeContainer = document.getElementById('shield-recharge-container');
const shieldRechargeBar = document.getElementById('shield-recharge-bar');

const freqNum = document.getElementById('freq-num');
const freqStatus = document.getElementById('freq-status');
const freqMultiplier = document.getElementById('freq-multiplier');
const freezePrompt = document.getElementById('freeze-prompt');

const playerHpCells = document.getElementById('player-hp-cells');

const slotSkill1 = document.getElementById('slot-skill1');
const skill1Status = document.getElementById('skill1-status');
const slotSkill2 = document.getElementById('slot-skill2');
const skill2Status = document.getElementById('skill2-status');
const slotSkill3 = document.getElementById('slot-skill3');
const skill3Status = document.getElementById('skill3-status');

const overlay = document.getElementById('game-overlay');
const overlayTitle = document.getElementById('overlay-title');
const overlayDesc = document.getElementById('overlay-desc');
const overlayBadge = document.getElementById('overlay-badge');
const startBtn = document.getElementById('start-btn');
const hubBtn = document.getElementById('hub-btn');

// 全景战术选关大厅元素
const missionHub = document.getElementById('mission-hub');
const missionCardsGrid = document.getElementById('mission-cards-grid');

// 关卡机制专属元数据 (5 大进阶弱点机制关 + 教学关 + 五阶终极大考)
const STAGE_META = {
  '1': {
    code: 'STAGE 1',
    name: '基础机制教学',
    weakpoints: 6,
    mechanic: '静止破盾 + 冲锋斩杀',
    instruction: '静止打 6 发刚好破盾，但伤害不足 70；必须向前移动利用多普勒蓝移提速方可完成一轮斩杀！',
    tag: 'TUTORIAL'
  },
  '2-s7': {
    code: '2-s7',
    name: '压迫推移前冲',
    weakpoints: 7,
    mechanic: 'W 键正向/斜向缓慢推进',
    instruction: '7 弱点间距 51.4°！轻推 W 键以约 160px/s 慢速前压，多普勒轻度蓝移压缩连破 7 弱点！',
    tag: 'FORWARD PUSH'
  },
  '2-s5': {
    code: '2-s5',
    name: '回环机动拉扯',
    weakpoints: 5,
    mechanic: 'S 后退 + A/D 逆向弧形拉扯',
    instruction: '5 弱点间距 72°！按住 S 键后退同时横拉绕行，以相反角位移精准匹配 72° 连碎 5 弱点！',
    tag: 'RADIAL + ORBIT'
  },
  '2-s8': {
    code: '2-s8',
    name: '极频蓝移突破',
    weakpoints: 8,
    mechanic: '极速前进多普勒压缩',
    instruction: '8 弱点间距 45°！保持全速前冲进行强大多普勒蓝移，将射击波前极限压缩连破 8 盾！',
    tag: 'HIGH BLUE SHIFT'
  },
  '2-s4': {
    code: '2-s4',
    name: '借力飞退破盾',
    weakpoints: 4,
    mechanic: '诱骗弹簧拳 · 550px/s 恒速滑退',
    instruction: '4 弱点间距 90° 需 550px/s 极速红移！闪现进盾诱骗弹簧拳，在 1.05s 恒速滑退中连射直接破盾！',
    tag: 'SPRING PUNCH'
  },
  '2-s9': {
    code: '2-s9',
    name: '极限频移压制',
    weakpoints: 9,
    mechanic: '40° 密位弱点极限多普勒击穿',
    instruction: '9 弱点间距仅 40°！全程开启火控保持高频推进，利用极限多普勒蓝移紧凑波前连碎 9 弱点！',
    tag: 'HIGH FREQ BURST'
  },
  '2-boss': {
    code: 'STAGE 2-BOSS',
    name: '动能泰坦 // 五阶终极决战',
    weakpoints: '7→5→8→4→9',
    mechanic: '五边形动态护盾连携大考',
    instruction: '五阶段全弱点矩阵大考：[7前推 → 5拉扯 → 8极频 → 4借力飞退 → 9极限压制]！内框五边形边框实时显示阶段进度，一轮破盾打空阶段血量方可切阶！',
    tag: 'FINAL CLIMAX'
  }
};

const completedStages = new Set();
let recommendedStage = '1';
let isHubOpen = true;

// 游戏状态单一可信数据源 (Single Source of Truth)
let input;
let freqMeter;
let currentStage = '1'; // '1', '2-s7', '2-s5', '2-s8', '2-s4', '2-s9', '2-boss'
let nextStageTarget = null;
let enemyTarget;
let player;
let tas;

let isRunning = false;
let isVictory = false;
let isGameOver = false;
let isTimeFrozen = false;
let hasShownFreezePrompt = false;
let lastTime = 0;
let speedrunSeconds = 0;
let backgroundStars = [];

function resizeCanvas() {
  const dpr = window.devicePixelRatio || 1;
  const w = window.innerWidth;
  const h = window.innerHeight;

  canvas.width = w * dpr;
  canvas.height = h * dpr;
  canvas.style.width = `${w}px`;
  canvas.style.height = `${h}px`;

  ctx.resetTransform();
  ctx.scale(dpr, dpr);

  if (enemyTarget) {
    enemyTarget.x = w / 2;
    enemyTarget.y = Math.min(130, h * 0.16);
  }
}

function initStars(count = 70) {
  backgroundStars = [];
  const w = window.innerWidth;
  const h = window.innerHeight;
  for (let i = 0; i < count; i++) {
    backgroundStars.push({
      x: Math.random() * w,
      y: Math.random() * h,
      size: 0.8 + Math.random() * 1.5,
      alpha: 0.2 + Math.random() * 0.6,
      speed: 15 + Math.random() * 25
    });
  }
}

function openMissionHub() {
  isHubOpen = true;
  missionHub.classList.remove('hidden');
  overlay.classList.add('hidden');
  renderMissionHub();
}

function closeMissionHub() {
  isHubOpen = false;
  missionHub.classList.add('hidden');
}

function renderMissionHub() {
  missionCardsGrid.innerHTML = '';
  Object.keys(STAGE_META).forEach(stg => {
    const meta = STAGE_META[stg];
    const isCompleted = completedStages.has(stg);
    const isRec = stg === recommendedStage;

    const card = document.createElement('div');
    card.className = `mission-card ${isRec ? 'recommended' : ''}`;
    
    let tagHtml;
    if (isCompleted) {
      tagHtml = `<span class="card-tag passed-tag">COMPLETED ✓</span>`;
    } else if (isRec) {
      tagHtml = `<span class="card-tag rec-tag">RECOMMENDED ★</span>`;
    } else {
      tagHtml = `<span class="card-tag">${meta.tag}</span>`;
    }

    card.innerHTML = `
      <div>
        <div class="card-top-row">
          <span class="card-code">${meta.code}</span>
          ${tagHtml}
        </div>
        <div class="card-name">${meta.name}</div>
        <div class="card-mechanic">✦ ${meta.mechanic}</div>
        <p class="card-instruction">${meta.instruction}</p>
      </div>
      <div class="card-footer">
        <span class="card-wp-count">${meta.weakpoints} 弱点护盾</span>
        <button class="card-play-btn">START ▶</button>
      </div>
    `;

    card.addEventListener('click', () => {
      startStageFromHub(stg);
    });

    missionCardsGrid.appendChild(card);
  });
}

function startStageFromHub(stg) {
  closeMissionHub();
  switchStage(stg);
}

function initGame() {
  const w = window.innerWidth;
  const h = window.innerHeight;

  input = new InputManager(canvas);
  freqMeter = new FrequencyMeter(freqCanvas, 3.33);

  // 默认从 Stage 1 初始化数据
  switchStage('1');

  initStars(80);
  resizeCanvas();
  window.addEventListener('resize', resizeCanvas);

  // 绑定顶部独立验证阶段切换点击
  Object.keys(stageTabs).forEach(stg => {
    stageTabs[stg].addEventListener('click', (e) => {
      e.stopPropagation();
      closeMissionHub();
      switchStage(stg);
    });
  });

  // 开始按钮与返回大厅按钮响应
  startBtn.addEventListener('click', handleStartBtnClick);
  hubBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    openMissionHub();
  });

  // 键盘事件全局监听
  window.addEventListener('keydown', (e) => {
    // 按 Escape 随时返回选拔大厅
    if (e.code === 'Escape') {
      openMissionHub();
      return;
    }

    // 首次破盾时停状态下：按下 WASD 或方向键立即解除时停
    if (isTimeFrozen) {
      const moveKeys = ['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'];
      if (moveKeys.includes(e.code)) {
        isTimeFrozen = false;
        freezePrompt.style.display = 'none';
      }
      return;
    }

    // 处于大厅状态不触发键盘直接开战
    if (isHubOpen) return;

    // 关卡准备中按 Enter 也可以直接开战
    if (!isRunning && (e.code === 'Enter' || e.code === 'NumpadEnter')) {
      startGame();
    }
  });

  // 初始化高内聚 TAS 自动化测试系统
  tas = new TASEngine({
    get input() { return input; },
    get player() { return player; },
    get enemy() { return enemyTarget; },
    get currentStage() { return currentStage; },
    switchStage: (stg) => switchStage(stg),
    startGame: () => startGame()
  });
  window.tas = tas;

  if (tasRunBtn) {
    tasRunBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      closeMissionHub();
      tasRunBtn.classList.add('active');
      startGame();
      tas.start(currentStage, (timeStr) => {
        tasRunBtn.classList.remove('active');
      });
    });
  }

  if (tasRunAllBtn) {
    tasRunAllBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      closeMissionHub();
      tasRunAllBtn.classList.add('active');
      tas.startTour(null, (results) => {
        tasRunAllBtn.classList.remove('active');
      });
    });
  }

  // 默认直接打开全景选关大厅！
  openMissionHub();

  requestAnimationFrame(gameLoop);
}

function handleStartBtnClick() {
  if (nextStageTarget) {
    const target = nextStageTarget;
    nextStageTarget = null;
    switchStage(target);
    return;
  }

  // 点击直接开局（默认不射击，开局后由玩家按 J 开启）
  startGame();
}

function switchStage(stg) {
  currentStage = stg;
  nextStageTarget = null;

  Object.keys(stageTabs).forEach(k => {
    stageTabs[k].classList.toggle('active', k === stg);
  });

  speedrunTimerCard.style.display = stg !== '1' ? 'flex' : 'none';

  initStage(stg);

  const meta = STAGE_META[stg] || STAGE_META['1'];
  overlayBadge.textContent = `${meta.code.toUpperCase()} // ${meta.tag}`;
  overlayTitle.textContent = `${meta.name}`;
  overlayDesc.innerHTML = `
    <strong>【核心机制】${meta.mechanic}</strong><br/>
    <span style="color:#00ffff;font-weight:700">【破盾走位指南】</span> ${meta.instruction}<br/>
    <span style="color:#ffaa00">【战斗须知】</span> 点击下方按钮直接开局，默认处于停火状态，进入战斗后按 <strong>[J]</strong> 键开启射击！
  `;

  startBtn.textContent = '开始挑战 [CLICK TO START]';

  overlay.classList.remove('hidden');
  isRunning = false;
  isGameOver = false;
  isVictory = false;
}

function initStage(stg) {
  const w = window.innerWidth;
  const h = window.innerHeight;
  const enemyY = Math.min(130, h * 0.16);
  const playerStartY = Math.max(h - 90, h * 0.88);

  if (stg === '1') {
    enemyTarget = new Enemy(w / 2, enemyY);
    bossTag.textContent = 'TARGET 01 // SENTINEL CORE';
  } else if (stg === '2-s7') {
    enemyTarget = new Boss(w / 2, enemyY, { hp: 120, weakpoints: 7, enableBullets: false });
    bossTag.textContent = 'STAGE 2-s7 // 7 WEAKPOINTS (FORWARD PUSH)';
  } else if (stg === '2-s5') {
    enemyTarget = new Boss(w / 2, enemyY, { hp: 120, weakpoints: 5, enableBullets: false });
    bossTag.textContent = 'STAGE 2-s5 // 5 WEAKPOINTS (BACK + ORBIT)';
  } else if (stg === '2-s8') {
    enemyTarget = new Boss(w / 2, enemyY, { hp: 150, weakpoints: 8, enableBullets: false });
    bossTag.textContent = 'STAGE 2-s8 // 8 WEAKPOINTS (HIGH BLUE SHIFT)';
  } else if (stg === '2-s4') {
    enemyTarget = new Boss(w / 2, enemyY, { hp: 120, weakpoints: 4, enableBullets: false });
    bossTag.textContent = 'STAGE 2-s4 // 4 WEAKPOINTS (SPRING PUNCH)';
  } else if (stg === '2-s9') {
    // 9 弱点专属关：40° 密位极限多普勒高频击穿 (无冲锋)
    enemyTarget = new Boss(w / 2, enemyY, { hp: 150, weakpoints: 9, enableBullets: false });
    bossTag.textContent = 'STAGE 2-s9 // 9 WEAKPOINTS (HIGH FREQ BURST)';
  } else if (stg === '2-boss') {
    // 2-boss 综合终极决战：五阶段顺序 [7, 5, 8, 4, 9]，破盾转阶，血量 [7, 7, 8, 9, 11]
    enemyTarget = new Boss(w / 2, enemyY, {
      phaseSequence: [7, 5, 8, 4, 9],
      phaseHps: [7, 7, 8, 9, 11],
      enableBullets: true
    });
    bossTag.textContent = 'STAGE 2-BOSS // TITAN MATRIX (PHASE 1/5: 7 WP | 7 HP)';
  }

  if (!player) {
    player = new Player(w / 2, playerStartY, enemyTarget);
  } else {
    player.setEnemy(enemyTarget);
    player.reset(w / 2, playerStartY);
    player.heal(3);
  }

  freqMeter.reset();
  speedrunSeconds = 0;
  timerDigits.textContent = '00:00.00';
  updatePlayerHpUI();
}

function startGame() {
  audio.init();
  audio.resume();

  const w = window.innerWidth;
  const h = window.innerHeight;
  const playerStartY = Math.max(h - 90, h * 0.88);

  enemyTarget.reset();
  player.reset(w / 2, playerStartY);
  player.heal(3);

  freqMeter.reset();

  isVictory = false;
  isGameOver = false;
  isRunning = true;
  isTimeFrozen = false;
  hasShownFreezePrompt = false;
  speedrunSeconds = 0;
  freezePrompt.style.display = 'none';
  overlay.classList.add('hidden');
  updatePlayerHpUI();
}

function showVictory() {
  isVictory = true;
  isRunning = false;
  isTimeFrozen = false;
  freezePrompt.style.display = 'none';

  completedStages.add(currentStage);

  const timeStr = formatTimer(speedrunSeconds);

  // 通知 TAS 引擎结算当前关卡
  const isTouring = tas && tas.handleVictory(timeStr);
  if (tasRunBtn) tasRunBtn.classList.remove('active');

  const nextMap = {
    '1': '2-s7',
    '2-s7': '2-s5',
    '2-s5': '2-s8',
    '2-s8': '2-s4',
    '2-s4': '2-s9',
    '2-s9': '2-boss',
    '2-boss': null
  };

  const next = nextMap[currentStage];
  nextStageTarget = next;
  if (next) {
    recommendedStage = next;
  }

  overlayBadge.textContent = `${currentStage.toUpperCase()} VERIFIED ✓`;
  overlayTitle.textContent = currentStage === '2-boss' ? '终极泰坦决战通关！' : '阶段测试通关！';

  if (next) {
    overlayDesc.innerHTML = `
      <strong>${currentStage.toUpperCase()} 机制验证成功！</strong><br/><br/>
      测试耗时：<strong>${timeStr}</strong><br/>
      你已成功掌握该阶段破盾机制。<br/>
      点击下方按钮直接挺进 <strong>${next.toUpperCase()}</strong>！
    `;
    startBtn.textContent = `进入下一测试关 ${next.toUpperCase()} [CLICK]`;
  } else {
    overlayDesc.innerHTML = `
      <strong>六阶段终极泰坦决战全部通关！</strong><br/><br/>
      总挑战耗时：<strong>${timeStr}</strong><br/>
      恭喜完整击破 [7 → 5 → 9 → 4 → 8 → 10] 全部多普勒护盾阶段，成为真正的多普勒王牌王牌飞行员！
    `;
    startBtn.textContent = '返回战术大厅 [CLICK]';
    nextStageTarget = null;
  }

  overlay.classList.remove('hidden');

  // 如果处于 TAS 全局巡航模式，不阻塞弹窗直接静默流转
  if (isTouring) {
    // 保持提示窗打开展示成绩，tasEngine 内部的 setTimeout 会自动切到下一关
  }
}

function showGameOver() {
  isGameOver = true;
  isRunning = false;
  isTimeFrozen = false;
  nextStageTarget = null;
  freezePrompt.style.display = 'none';

  if (tas) {
    tas.handleGameOver();
  }
  if (tasRunBtn) tasRunBtn.classList.remove('active');
  if (tasRunAllBtn) tasRunAllBtn.classList.remove('active');

  overlayBadge.textContent = 'MISSION FAILED';
  overlayTitle.textContent = '战机损毁';
  overlayDesc.innerHTML = `
    能量护甲耗尽（三滴血扣完）。<br/>
    善用 <strong>[J] 开启/关闭射击</strong>，按 <strong>[K] 瞬移折跃</strong> 调整站位，按 <strong>[L] 开启力场护盾</strong> 抵御反弹致命弹幕！
  `;
  startBtn.textContent = '重试本关 [点击重开]';
  overlay.classList.remove('hidden');
}

function formatTimer(secs) {
  const m = Math.floor(secs / 60);
  const s = Math.floor(secs % 60);
  const ms = Math.floor((secs % 1) * 100);
  const mm = m < 10 ? '0' + m : m;
  const ss = s < 10 ? '0' + s : s;
  const mss = ms < 10 ? '0' + ms : ms;
  return `${mm}:${ss}.${mss}`;
}

function handleCollisions(now) {
  // 1. 我方子弹打击敌方
  for (const bullet of player.bullets) {
    if (!bullet.alive) continue;

    if (!enemyTarget.shield.isBroken) {
      const hitShield = enemyTarget.shield.checkBulletCollision(bullet, freqMeter, now);
      
      if (currentStage === '1' && enemyTarget.shield.isBroken && !hasShownFreezePrompt) {
        hasShownFreezePrompt = true;
        isTimeFrozen = true;
        freezePrompt.style.display = 'flex';
      }

      // 破盾事件响应
      if (enemyTarget.shield.isBroken) {
        player.heal(1);
        updatePlayerHpUI();
      }

      if (hitShield) continue;
    } else {
      const dx = bullet.x - enemyTarget.x;
      const dy = bullet.y - enemyTarget.y;
      const dist = Math.hypot(dx, dy);

      if (dist <= enemyTarget.radius + 6) {
        bullet.alive = false;
        // 具备多阶段血量的 Boss (2-boss)：每发子弹命中扣除 1 点阶段血量与总血量；普通目标扣除 bullet.damage
        const dmg = (enemyTarget.phaseHps) ? 1 : bullet.damage;
        enemyTarget.takeDamage(dmg, freqMeter, now);

        if (enemyTarget.isDead && !isVictory) {
          setTimeout(showVictory, 800);
        }
      }
    }
  }

  // 2. 检测玩家是否损毁
  if (player.isDead && !isGameOver) {
    showGameOver();
  }
}

function updatePlayerHpUI() {
  if (!playerHpCells) return;
  const cells = playerHpCells.querySelectorAll('.hp-cell');
  cells.forEach((cell, idx) => {
    cell.className = 'hp-cell';
    if (idx < player.hp) {
      cell.classList.add('active');
      if (player.hp === 1) cell.classList.add('danger');
    }
  });
}

function updateHUD(now) {
  updatePlayerHpUI();

  const hpPercent = Math.max(0, (enemyTarget.hp / enemyTarget.maxHp) * 100);
  bossHpBar.style.width = `${hpPercent}%`;
  bossHpText.textContent = `HP: ${Math.round(enemyTarget.hp)} / ${enemyTarget.maxHp}`;

  // 动态更新 Boss 标签 (针对 2-boss 呈现六阶段进度与当前阶段血量)
  if (currentStage === '2-boss' && enemyTarget.phaseWeakpoints) {
    const phaseNum = enemyTarget.currentPhaseIndex + 1;
    const curWp = enemyTarget.phaseWeakpoints[enemyTarget.currentPhaseIndex];
    const curHp = enemyTarget.currentPhaseHp !== undefined ? enemyTarget.currentPhaseHp : Math.round(enemyTarget.hp);
    const maxHp = enemyTarget.phaseMaxHps ? enemyTarget.phaseMaxHps[enemyTarget.currentPhaseIndex] : curHp;
    bossTag.textContent = `STAGE 2-BOSS // TITAN MATRIX (PHASE ${phaseNum}/5: ${curWp} WP | ${curHp}/${maxHp} HP)`;
  }

  const shield = enemyTarget.shield;
  const statusDot = shieldStatusLine.querySelector('.status-dot');

  if (shield.isBroken) {
    statusDot.className = 'status-dot shield-off';
    const remainSec = Math.max(0, shield.rechargeDuration - shield.rechargeTimer).toFixed(1);
    shieldStatusText.textContent = `护盾过载！恢复倒计时: ${remainSec}s`;
    shieldRechargeContainer.style.display = 'block';
    const rechargePercent = (shield.rechargeTimer / shield.rechargeDuration) * 100;
    shieldRechargeBar.style.width = `${rechargePercent}%`;
  } else {
    statusDot.className = 'status-dot shield-on';
    shieldRechargeContainer.style.display = 'none';
    const activeWeakpoints = shield.weakpoints.filter(Boolean).length;
    shieldStatusText.textContent = `旋转护盾：防御偏转中 (${activeWeakpoints}/${shield.count} 弱点)`;
  }

  const freq = freqMeter.getFrequency();
  const mult = freqMeter.getMultiplier();
  freqNum.textContent = freq.toFixed(2);
  freqMultiplier.textContent = `${mult.toFixed(2)}x`;

  if (freq >= 6.8) {
    freqNum.className = 'freq-number high-freq';
    freqNum.style.color = '#39ff14';
    freqStatus.textContent = 'EXTREME DOPPLER COMPRESSION';
    freqStatus.style.color = '#39ff14';
  } else if (freq > 4.8) {
    freqNum.className = 'freq-number high-freq';
    freqNum.style.color = '#00ffff';
    freqStatus.textContent = 'DOPPLER COMPRESSION (HIGH)';
    freqStatus.style.color = '#00ffff';
  } else if (freq > 2.0) {
    freqNum.className = 'freq-number';
    freqNum.style.color = '#fff';
    freqStatus.textContent = 'STANDARD EMISSION';
    freqStatus.style.color = '#ffaa00';
  } else {
    freqNum.className = 'freq-number';
    freqNum.style.color = '#fff';
    freqStatus.textContent = 'TARGET IDLE';
    freqStatus.style.color = '#8899aa';
  }

  // J 键火控开关 HUD 状态
  if (player.autoFire) {
    slotSkill1.classList.add('active');
    skill1Status.textContent = 'AUTO [ON]';
    skill1Status.className = 'skill-status fire-on';
  } else {
    slotSkill1.classList.remove('active');
    skill1Status.textContent = 'CEASE [OFF]';
    skill1Status.className = 'skill-status fire-off';
  }

  // K 键闪现
  if (player.skill2CdTimer > 0) {
    slotSkill2.classList.remove('active');
    skill2Status.textContent = `CD: ${player.skill2CdTimer.toFixed(1)}s`;
    skill2Status.className = 'skill-status cooling';
  } else {
    slotSkill2.classList.remove('active');
    skill2Status.textContent = 'READY';
    skill2Status.className = 'skill-status';
  }

  // L 键力场盾
  if (slotSkill3 && skill3Status) {
    if (player.skill1Active) {
      slotSkill3.classList.add('active');
      skill3Status.textContent = 'SHIELDING';
      skill3Status.className = 'skill-status fire-on';
    } else if (player.skill1CdTimer > 0) {
      slotSkill3.classList.remove('active');
      skill3Status.textContent = `CD: ${player.skill1CdTimer.toFixed(1)}s`;
      skill3Status.className = 'skill-status cooling';
    } else {
      slotSkill3.classList.remove('active');
      skill3Status.textContent = 'READY';
      skill3Status.className = 'skill-status';
    }
  }

  if (currentStage !== '1' && isRunning && !isVictory) {
    timerDigits.textContent = formatTimer(speedrunSeconds);
  }
}

function renderBackground(ctx, dt) {
  const w = window.innerWidth;
  const h = window.innerHeight;

  ctx.save();
  ctx.strokeStyle = currentStage !== '1' ? 'rgba(255, 0, 85, 0.04)' : 'rgba(0, 240, 255, 0.035)';
  ctx.lineWidth = 1;
  const gridSize = 60;
  for (let x = 0; x < w; x += gridSize) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, h);
    ctx.stroke();
  }
  for (let y = 0; y < h; y += gridSize) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(w, y);
    ctx.stroke();
  }

  ctx.fillStyle = '#ffffff';
  for (const s of backgroundStars) {
    if (!isTimeFrozen) {
      s.y += s.speed * dt;
      if (s.y > h) {
        s.y = 0;
        s.x = Math.random() * w;
      }
    }
    ctx.globalAlpha = s.alpha;
    ctx.beginPath();
    ctx.arc(s.x, s.y, s.size, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1.0;
  ctx.restore();
}

function gameLoop(timestamp) {
  if (!lastTime) lastTime = timestamp;
  const dt = Math.min((timestamp - lastTime) / 1000, 0.1);
  lastTime = timestamp;

  const w = window.innerWidth;
  const h = window.innerHeight;

  ctx.clearRect(0, 0, w, h);

  renderBackground(ctx, dt);

  if (isRunning) {
    // TAS 虚拟按键注入 (在玩家逻辑更新之前注入)
    if (tas && tas.active) {
      tas.update(dt);
      if (isTimeFrozen && (input.keys['KeyW'] || input.keys['KeyA'] || input.keys['KeyS'] || input.keys['KeyD'])) {
        isTimeFrozen = false;
        freezePrompt.style.display = 'none';
      }
    }

    if (!isTimeFrozen) {
      if (currentStage !== '1' && !isVictory) {
        speedrunSeconds += dt;
      }

      const bossBullets = (currentStage !== '1' && enemyTarget.bullets) ? enemyTarget.bullets : null;
      player.update(dt, input, w, h, bossBullets);
      enemyTarget.update(dt, timestamp, player, freqMeter);
      freqMeter.update(timestamp);
      handleCollisions(timestamp);
    }

    updateHUD(timestamp);
  }

  enemyTarget.render(ctx);
  player.render(ctx);

  requestAnimationFrame(gameLoop);
}

// 启动
initGame();
