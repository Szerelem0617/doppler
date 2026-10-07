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
    instruction: '静止打 6 发破盾！碎盾过载 0.3s 动画期间护盾无敌且偏转子弹，可按 S 键后撤降频节省输出；护盾彻底崩解后立刻按 W 键全速前冲蓝移极速斩杀！',
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
    name: '前4后4折跃一圈破盾',
    weakpoints: 8,
    mechanic: '前 4 发 W 前推 + A 左闪 + 后 4 发 W+D 斜切',
    instruction: '8 弱点间距 45° 顺时针旋转！开局 W 正向前推，前 4 发依次击破前 4 个弱点；0.82s 时按 A 键向左折跃瞬移，随后切 W+D 斜向右上切入回正瞄准轴线，后 4 发连破后 4 个弱点，1.31s 严格第一圈 8 盾全破！',
    tag: 'SPLIT-4 BLINK 1-REV'
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
let isVictoryPending = false;
let isGameOver = false;
let isTimeFrozen = false;
let hasShownFreezePrompt = false;
let lastTime = 0;
let speedrunSeconds = 0;
export const VIRTUAL_WIDTH = 800;
export const VIRTUAL_HEIGHT = 800;

let canvasScale = 1;
let canvasOffsetX = 0;
let canvasOffsetY = 0;
let backgroundStars = [];

function resizeCanvas() {
  const dpr = window.devicePixelRatio || 1;
  const winW = window.innerWidth;
  const winH = window.innerHeight;

  // 严格锁定 1:1 固定长宽比 (800x800 虚拟物理竞技场)，杜绝任何屏幕缩放导致的物理偏移
  canvasScale = Math.min(winW / VIRTUAL_WIDTH, winH / VIRTUAL_HEIGHT);
  const displayW = VIRTUAL_WIDTH * canvasScale;
  const displayH = VIRTUAL_HEIGHT * canvasScale;

  canvasOffsetX = (winW - displayW) / 2;
  canvasOffsetY = (winH - displayH) / 2;

  // 物理像素尺寸 (高清 Retina / DPR 渲染)
  canvas.width = displayW * dpr;
  canvas.height = displayH * dpr;

  // CSS 布局居中
  canvas.style.width = `${displayW}px`;
  canvas.style.height = `${displayH}px`;
  canvas.style.left = `${canvasOffsetX}px`;
  canvas.style.top = `${canvasOffsetY}px`;

  // 统一缩放上下文：使得所有绘图与物理坐标永远保持在严格的 [0, 800] 空间内！
  ctx.resetTransform();
  ctx.scale(canvasScale * dpr, canvasScale * dpr);
}

function initStars(count = 70) {
  backgroundStars = [];
  for (let i = 0; i < count; i++) {
    backgroundStars.push({
      x: Math.random() * VIRTUAL_WIDTH,
      y: Math.random() * VIRTUAL_HEIGHT,
      size: 0.8 + Math.random() * 1.5,
      alpha: 0.2 + Math.random() * 0.6,
      speed: 15 + Math.random() * 25
    });
  }
}

function openMissionHub() {
  isHubOpen = true;
  isRunning = false;
  missionHub.style.display = 'flex';
  missionHub.classList.remove('hidden');
  overlay.style.display = 'none';
  overlay.classList.add('hidden');
  renderMissionHub();
}

function closeMissionHub() {
  isHubOpen = false;
  missionHub.style.display = 'none';
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
        <div class="card-btn-group">
          <button class="card-tas-btn" data-stage="${stg}" title="观看该阶段理论最优解演示">TAS 演示 ▶</button>
          <button class="card-play-btn" data-stage="${stg}">START ▶</button>
        </div>
      </div>
    `;

    const tasBtn = card.querySelector('.card-tas-btn');
    if (tasBtn) {
      tasBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        closeMissionHub();
        switchStage(stg, false);
        startGame();
        if (tas) {
          tas.start(stg, (timeStr) => {
            if (tasRunBtn) tasRunBtn.classList.remove('active');
          });
        }
      });
    }

    const playBtn = card.querySelector('.card-play-btn');
    if (playBtn) {
      playBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        startStageFromHub(stg);
      });
    }

    card.addEventListener('click', () => {
      startStageFromHub(stg);
    });

    missionCardsGrid.appendChild(card);
  });
}

function startStageFromHub(stg) {
  closeMissionHub();
  switchStage(stg, false);
  startGame();
}

function initGame() {
  input = new InputManager(canvas);
  freqMeter = new FrequencyMeter(freqCanvas, 3.33);

  initStars(80);
  resizeCanvas();
  window.addEventListener('resize', resizeCanvas);

  // 初始化底层 Stage 1 模型（不弹窗）
  initStage('1');
  overlay.style.display = 'none';
  overlay.classList.add('hidden');

  // 绑定顶部独立验证阶段切换点击：点击直接开始该阶段
  Object.keys(stageTabs).forEach(stg => {
    stageTabs[stg].addEventListener('click', (e) => {
      e.stopPropagation();
      closeMissionHub();
      switchStage(stg, false);
      startGame();
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
    switchStage: (stg) => switchStage(stg, false),
    startGame: () => startGame()
  });
  window.tas = tas;

  if (tasRunBtn) {
    tasRunBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      closeMissionHub();
      overlay.style.display = 'none';
      overlay.classList.add('hidden');
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
      overlay.style.display = 'none';
      overlay.classList.add('hidden');
      tasRunAllBtn.classList.add('active');
      tas.startTour(null, (results) => {
        tasRunAllBtn.classList.remove('active');
      });
    });
  }

  // 默认启动直接打开全景选关大厅！
  openMissionHub();

  requestAnimationFrame(gameLoop);
}

function handleStartBtnClick() {
  overlay.style.display = 'none';
  overlay.classList.add('hidden');

  if (nextStageTarget) {
    const target = nextStageTarget;
    nextStageTarget = null;
    switchStage(target, false);
    startGame();
    return;
  }

  // 终极 Boss 决战结算后点击直接返回战术大厅
  if (currentStage === '2-boss' && isVictory) {
    openMissionHub();
    return;
  }

  // 点击直接开局（重试关卡）
  startGame();
}

function switchStage(stg, showOverlay = false) {
  currentStage = stg;
  nextStageTarget = null;

  Object.keys(stageTabs).forEach(k => {
    stageTabs[k].classList.toggle('active', k === stg);
  });

  speedrunTimerCard.style.display = stg !== '1' ? 'flex' : 'none';

  initStage(stg);

  if (showOverlay) {
    const meta = STAGE_META[stg] || STAGE_META['1'];
    overlayBadge.textContent = `${meta.code.toUpperCase()} // ${meta.tag}`;
    overlayTitle.textContent = `${meta.name}`;
    overlayDesc.innerHTML = `
      <strong>【核心机制】${meta.mechanic}</strong><br/>
      <span style="color:#00ffff;font-weight:700">【破盾走位指南】</span> ${meta.instruction}<br/>
      <span style="color:#ffaa00">【战斗须知】</span> 全自动火控系统已就绪，按 <strong>[J]</strong> 键折跃闪现调整站位，按 <strong>[K]</strong> 键开启反射力场抵御弹幕！
    `;
    startBtn.textContent = '开始挑战 [CLICK TO START]';
    overlay.style.display = 'flex';
    overlay.classList.remove('hidden');
  } else {
    overlay.style.display = 'none';
    overlay.classList.add('hidden');
  }

  isRunning = false;
  isGameOver = false;
  isVictory = false;
  isVictoryPending = false;
}

function initStage(stg) {
  const enemyX = VIRTUAL_WIDTH / 2; // 400
  const enemyY = 130;
  const playerStartY = 710; // 800 - 90

  if (stg === '1') {
    enemyTarget = new Enemy(enemyX, enemyY);
    bossTag.textContent = 'TARGET 01 // SENTINEL CORE';
  } else if (stg === '2-s7') {
    enemyTarget = new Boss(enemyX, enemyY, { hp: 120, weakpoints: 7, enableBullets: false });
    bossTag.textContent = 'STAGE 2-s7 // 7 WEAKPOINTS (FORWARD PUSH)';
  } else if (stg === '2-s5') {
    enemyTarget = new Boss(enemyX, enemyY, { hp: 120, weakpoints: 5, enableBullets: false });
    bossTag.textContent = 'STAGE 2-s5 // 5 WEAKPOINTS (BACK + ORBIT)';
  } else if (stg === '2-s8') {
    enemyTarget = new Boss(enemyX, enemyY, { hp: 120, weakpoints: 8, enableBullets: false });
    bossTag.textContent = 'STAGE 2-s8 // 8 WEAKPOINTS (SPLIT-4 BLINK 1-REV)';
  } else if (stg === '2-s4') {
    enemyTarget = new Boss(enemyX, enemyY, { hp: 120, weakpoints: 4, enableBullets: false });
    bossTag.textContent = 'STAGE 2-s4 // 4 WEAKPOINTS (SPRING PUNCH)';
  } else if (stg === '2-s9') {
    // 9 弱点专属关：40° 密位极限多普勒高频击穿 (无冲锋)
    enemyTarget = new Boss(enemyX, enemyY, { hp: 150, weakpoints: 9, enableBullets: false });
    bossTag.textContent = 'STAGE 2-s9 // 9 WEAKPOINTS (HIGH FREQ BURST)';
  } else if (stg === '2-boss') {
    // 2-boss 综合终极决战：五阶段顺序 [7, 5, 8, 4, 9]，破盾转阶，血量 [7, 7, 8, 9, 11]
    enemyTarget = new Boss(enemyX, enemyY, {
      phaseSequence: [7, 5, 8, 4, 9],
      phaseHps: [7, 7, 8, 9, 11],
      enableBullets: true
    });
    bossTag.textContent = 'STAGE 2-BOSS // TITAN MATRIX (PHASE 1/5: 7 WP | 7 HP)';
  }

  if (!player) {
    player = new Player(enemyX, playerStartY, enemyTarget);
  } else {
    player.setEnemy(enemyTarget);
    player.reset(enemyX, playerStartY);
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

  const playerStartY = 710;

  enemyTarget.reset();
  player.reset(VIRTUAL_WIDTH / 2, playerStartY);
  player.heal(3);

  freqMeter.reset();

  isVictory = false;
  isVictoryPending = false;
  isGameOver = false;
  isRunning = true;
  isTimeFrozen = false;
  hasShownFreezePrompt = false;
  speedrunSeconds = 0;
  timerDigits.textContent = '00:00.00';
  freezePrompt.style.display = 'none';
  overlay.classList.add('hidden');
  updatePlayerHpUI();
}

function showVictory() {
  isVictory = true;
  isVictoryPending = true;
  isRunning = false;
  isTimeFrozen = false;
  freezePrompt.style.display = 'none';

  completedStages.add(currentStage);

  const timeStr = formatTimer(speedrunSeconds);
  timerDigits.textContent = timeStr;

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
      测试耗时：<strong style="color:#00ff88;font-size:18px;">${timeStr}</strong><br/>
      你已成功掌握该阶段破盾机制。<br/>
      点击下方按钮直接挺进 <strong>${next.toUpperCase()}</strong>！
    `;
    startBtn.textContent = `进入下一测试关 ${next.toUpperCase()} [CLICK]`;
  } else {
    overlayDesc.innerHTML = `
      <strong>五阶段终极泰坦决战全部通关！</strong><br/><br/>
      总挑战耗时：<strong style="color:#00ff88;font-size:20px;">${timeStr}</strong><br/>
      恭喜完整击破 [7 → 5 → 8 → 4 → 9] 全部多普勒护盾阶段，成为真正的多普勒王牌飞行员！
    `;
    startBtn.textContent = '返回战术大厅 [CLICK]';
    nextStageTarget = null;
  }

  overlay.style.display = 'flex';
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
    按 <strong>[J] 瞬移折跃</strong> 调整站位，按 <strong>[K] 开启力场护盾</strong> 抵御反弹致命弹幕！
  `;
  startBtn.textContent = '重试本关 [点击重开]';
  overlay.style.display = 'flex';
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
  // 0. 敌方已阵亡即时检测 (包含被力场护盾反弹高能弹幕击杀的情况)
  if (enemyTarget.isDead && !isVictoryPending) {
    isVictory = true;
    isVictoryPending = true;
    timerDigits.textContent = formatTimer(speedrunSeconds);
    setTimeout(showVictory, 800);
    return;
  }

  // 破盾事件即时响应 (击碎最后一处弱点瞬时回血并触发时停引导)
  if (enemyTarget.shield.justBroken) {
    enemyTarget.shield.justBroken = false;
    player.heal(1);
    updatePlayerHpUI();

    if (currentStage === '1' && !hasShownFreezePrompt) {
      hasShownFreezePrompt = true;
      isTimeFrozen = true;
      freezePrompt.style.display = 'flex';
    }
  }

  // 1. 我方子弹打击敌方
  for (const bullet of player.bullets) {
    if (!bullet.alive) continue;

    // 护盾未彻底破裂 (包含正常防御态与 0.3s 碎裂顿挫动画态)
    if (!enemyTarget.shield.isBroken) {
      const hitShield = enemyTarget.shield.checkBulletCollision(bullet, freqMeter, now);
      if (hitShield) continue;

      // 仅当玩家确实已通过折跃闪现置身于护盾内部深处 (player.isInsideShield) 且未处于碎盾顿挫无敌态，才允许近身打击核心！
      if (!enemyTarget.shield.isShattering && player.isInsideShield) {
        const playerDist = Math.hypot(player.x - enemyTarget.x, player.y - enemyTarget.y);
        if (playerDist <= enemyTarget.shield.radius * 0.75) {
          const dx = bullet.x - enemyTarget.x;
          const dy = bullet.y - enemyTarget.y;
          const dist = Math.hypot(dx, dy);

          if (dist <= enemyTarget.radius + 6) {
            bullet.alive = false;
            const dmg = (enemyTarget.phaseHps) ? 1 : bullet.damage;
            enemyTarget.takeDamage(dmg, freqMeter, now);

            if (enemyTarget.isDead && !isVictoryPending) {
              isVictory = true;
              isVictoryPending = true;
              timerDigits.textContent = formatTimer(speedrunSeconds);
              setTimeout(showVictory, 800);
            }
            continue;
          }
        }
      }
    } else {
      const dx = bullet.x - enemyTarget.x;
      const dy = bullet.y - enemyTarget.y;
      const dist = Math.hypot(dx, dy);

      if (dist <= enemyTarget.radius + 6) {
        bullet.alive = false;
        // 具备多阶段血量的 Boss (2-boss)：每发子弹命中扣除 1 点阶段血量与总血量；普通目标扣除 bullet.damage
        const dmg = (enemyTarget.phaseHps) ? 1 : bullet.damage;
        enemyTarget.takeDamage(dmg, freqMeter, now);

        if (enemyTarget.isDead && !isVictoryPending) {
          isVictory = true;
          isVictoryPending = true;
          timerDigits.textContent = formatTimer(speedrunSeconds);
          setTimeout(showVictory, 800);
        }
      }
    }
  }

  // 2. 检测玩家是否损毁 (若胜利已触发，不判定游戏结束)
  if (player.isDead && !isGameOver && !isVictory && !isVictoryPending) {
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

  if (enemyTarget.phaseHps && enemyTarget.currentPhaseHp !== undefined) {
    const curIdx = Math.min((enemyTarget.phaseWeakpoints?.length || 1) - 1, enemyTarget.currentPhaseIndex || 0);
    const curHp = enemyTarget.currentPhaseHp;
    const curMaxHp = enemyTarget.phaseMaxHps ? enemyTarget.phaseMaxHps[curIdx] : curHp;
    const hpPercent = Math.max(0, (curHp / curMaxHp) * 100);
    bossHpBar.style.width = `${hpPercent}%`;
    bossHpText.textContent = `HP: ${Math.round(curHp)} / ${curMaxHp}`;
  } else {
    const hpPercent = Math.max(0, (enemyTarget.hp / enemyTarget.maxHp) * 100);
    bossHpBar.style.width = `${hpPercent}%`;
    bossHpText.textContent = `HP: ${Math.round(enemyTarget.hp)} / ${enemyTarget.maxHp}`;
  }

  // 动态更新 Boss 标签 (针对 2-boss 呈现阶段进度与当前阶段血量)
  if (currentStage === '2-boss' && enemyTarget.phaseWeakpoints) {
    if (enemyTarget.isDead) {
      bossTag.textContent = `STAGE 2-BOSS // TITAN MATRIX (ALL PHASES DESTROYED // VICTORY)`;
    } else {
      const curIdx = Math.min(enemyTarget.phaseWeakpoints.length - 1, enemyTarget.currentPhaseIndex);
      const phaseNum = curIdx + 1;
      const curWp = enemyTarget.phaseWeakpoints[curIdx];
      const curHp = enemyTarget.currentPhaseHp !== undefined ? enemyTarget.currentPhaseHp : Math.round(enemyTarget.hp);
      const maxHp = enemyTarget.phaseMaxHps ? enemyTarget.phaseMaxHps[curIdx] : curHp;
      bossTag.textContent = `STAGE 2-BOSS // TITAN MATRIX (PHASE ${phaseNum}/5: ${curWp} WP | ${curHp}/${maxHp} HP)`;
    }
  }

  const shield = enemyTarget.shield;
  const statusDot = shieldStatusLine.querySelector('.status-dot');

  if (enemyTarget.isDead) {
    statusDot.className = 'status-dot';
    shieldStatusText.innerHTML = `<span style="color:#00ff88;font-weight:700;">✦ 核心防御彻底摧毁 · 目标已歼灭</span>`;
    shieldRechargeContainer.style.display = 'none';
  } else if (shield.isShattering) {
    statusDot.className = 'status-dot shield-shattering';
    const remainSec = Math.max(0, shield.shatterDuration - shield.shatterTimer).toFixed(2);
    shieldStatusText.innerHTML = `<span style="color:#ffaa00;font-weight:700;">⚡ 护盾过载崩解中！[${remainSec}s] 偏转不可穿透 · 战术后撤</span>`;
    shieldRechargeContainer.style.display = 'block';
    const shatterPercent = (shield.shatterTimer / shield.shatterDuration) * 100;
    shieldRechargeBar.style.width = `${100 - shatterPercent}%`;
    shieldRechargeBar.style.background = 'linear-gradient(90deg, #ffaa00, #ff2a6d)';
    shieldRechargeBar.style.boxShadow = '0 0 10px #ff2a6d';
  } else if (shield.isBroken) {
    statusDot.className = 'status-dot shield-off';
    const remainSec = Math.max(0, shield.rechargeDuration - shield.rechargeTimer).toFixed(1);
    shieldStatusText.textContent = `护盾过载！暴露虚弱倒计时: ${remainSec}s`;
    shieldRechargeContainer.style.display = 'block';
    const rechargePercent = (shield.rechargeTimer / shield.rechargeDuration) * 100;
    shieldRechargeBar.style.width = `${rechargePercent}%`;
    shieldRechargeBar.style.background = 'linear-gradient(90deg, #00f0ff, #ffea70)';
    shieldRechargeBar.style.boxShadow = '0 0 10px var(--amber-glow)';
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

  // J 键折跃闪现 HUD 状态
  if (player.blinkCdTimer > 0) {
    slotSkill1.classList.remove('active');
    skill1Status.textContent = `CD: ${player.blinkCdTimer.toFixed(1)}s`;
    skill1Status.className = 'skill-status cooling';
  } else {
    slotSkill1.classList.remove('active');
    skill1Status.textContent = 'READY';
    skill1Status.className = 'skill-status';
  }

  // K 键反射力场 HUD 状态
  if (player.skill1Active) {
    slotSkill2.classList.add('active');
    skill2Status.textContent = 'SHIELDING';
    skill2Status.className = 'skill-status fire-on';
  } else if (player.shieldCdTimer > 0) {
    slotSkill2.classList.remove('active');
    skill2Status.textContent = `CD: ${player.shieldCdTimer.toFixed(1)}s`;
    skill2Status.className = 'skill-status cooling';
  } else {
    slotSkill2.classList.remove('active');
    skill2Status.textContent = 'READY';
    skill2Status.className = 'skill-status';
  }

  if (currentStage !== '1' && isRunning && !isVictory) {
    timerDigits.textContent = formatTimer(speedrunSeconds);
  }
}

function renderBackground(ctx, dt) {
  const w = VIRTUAL_WIDTH;
  const h = VIRTUAL_HEIGHT;

  ctx.save();
  ctx.strokeStyle = currentStage !== '1' ? 'rgba(255, 0, 85, 0.04)' : 'rgba(0, 240, 255, 0.035)';
  ctx.lineWidth = 1;
  const gridSize = 50;
  for (let x = 0; x <= w; x += gridSize) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, h);
    ctx.stroke();
  }
  for (let y = 0; y <= h; y += gridSize) {
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

  ctx.clearRect(0, 0, VIRTUAL_WIDTH, VIRTUAL_HEIGHT);

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
      if (currentStage !== '1' && !isVictory && !isVictoryPending) {
        speedrunSeconds += dt;
      }

      const bossBullets = (currentStage !== '1' && enemyTarget.bullets) ? enemyTarget.bullets : null;
      player.update(dt, input, VIRTUAL_WIDTH, VIRTUAL_HEIGHT, bossBullets);
      enemyTarget.update(dt, timestamp, player, freqMeter);
      freqMeter.update(timestamp);
      handleCollisions(timestamp);

      // 敌方击毁全局实时检测：无论敌方因何种伤害（自导激光直击或力场反弹弹幕）阵亡，立即锁定通关用时并触发结算弹窗！
      if (enemyTarget.isDead && !isVictoryPending) {
        isVictory = true;
        isVictoryPending = true;
        timerDigits.textContent = formatTimer(speedrunSeconds);
        setTimeout(showVictory, 800);
      }
    }

    updateHUD(timestamp);
  }

  enemyTarget.render(ctx);
  player.render(ctx);

  requestAnimationFrame(gameLoop);
}

// 启动
initGame();
