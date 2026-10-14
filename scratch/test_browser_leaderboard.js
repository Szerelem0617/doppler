import { spawn } from 'child_process';

const chromePath = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const cdpPort = 9360;

const chrome = spawn(chromePath, [
  '--headless=new',
  `--remote-debugging-port=${cdpPort}`,
  '--no-sandbox',
  '--disable-gpu',
  'about:blank'
]);

async function delay(ms) {
  return new Promise(r => setTimeout(r, ms));
}

let msgId = 1;
function sendCdp(ws, method, params = {}) {
  const id = msgId++;
  return new Promise((resolve, reject) => {
    const handler = (event) => {
      const data = JSON.parse(event.data);
      if (data.id === id) {
        ws.removeEventListener('message', handler);
        if (data.error) reject(data.error);
        else resolve(data.result);
      }
    };
    ws.addEventListener('message', handler);
    ws.send(JSON.stringify({ id, method, params }));
  });
}

async function evalInPage(ws, expr) {
  const res = await sendCdp(ws, 'Runtime.evaluate', {
    expression: expr,
    returnByValue: true,
    awaitPromise: true
  });
  return res.result ? res.result.value : res;
}

setTimeout(async () => {
  try {
    const listRes = await fetch(`http://127.0.0.1:${cdpPort}/json`);
    const pages = await listRes.json();
    const wsUrl = pages[0].webSocketDebuggerUrl;

    const ws = new WebSocket(wsUrl);
    await new Promise(r => { ws.onopen = r; });

    await sendCdp(ws, 'Runtime.enable');
    await sendCdp(ws, 'Page.enable');
    await sendCdp(ws, 'Emulation.setFocusEmulationEnabled', { enabled: true });

    console.log('Navigating to http://localhost:5174/?dev ...');
    await sendCdp(ws, 'Page.navigate', { url: 'http://localhost:5174/?dev' });
    await delay(1200);

    // 1. 测试 HUD 极速榜按钮
    console.log('\n[TEST 1] 点击 HUD 排行榜按钮...');
    const hudRes = await evalInPage(ws, `
      (() => {
        const btn = document.getElementById('hud-leaderboard-btn');
        btn.click();
        const modal = document.getElementById('leaderboard-modal');
        return {
          modalExists: Boolean(modal),
          modalDisplay: modal ? modal.style.display : null,
          hasHidden: modal ? modal.classList.contains('hidden') : null
        };
      })()
    `);
    console.log('HUD 排行榜弹窗状态:', hudRes);
    if (hudRes.modalDisplay !== 'flex' || hudRes.hasHidden) {
      throw new Error('HUD leaderboard modal failed to open');
    }

    await delay(300);

    // 验证榜单表格已有记录
    const rowsInfo = await evalInPage(ws, `
      (() => {
        const rows = document.querySelectorAll('#lb-table-body tr');
        document.getElementById('lb-close-btn').click();
        return {
          rowCount: rows.length,
          firstRow: rows[0] ? rows[0].innerText.replace(/\\n/g, ' | ') : ''
        };
      })()
    `);
    console.log('榜单首行数据:', rowsInfo);

    // 2. 测试第二关终极泰坦结算（首次通关：尚未登记昵称）
    console.log('\n[TEST 2] 模拟第二关（终极泰坦）首次通关...');
    await evalInPage(ws, `
      (() => {
        localStorage.removeItem('doppler_pilot_name');
        document.getElementById('tab-stg2boss').click();
      })()
    `);
    await delay(300);

    // 终极泰坦阵亡触发通关
    await evalInPage(ws, `window.enemyTarget.die()`);
    for (let i = 0; i < 40; i++) {
      await evalInPage(ws, `for (let s = 0; s < 6; s++) window.physicsStep(window.FIXED_DT)`);
      await delay(30);
    }
    await delay(800);

    const firstVictoryUI = await evalInPage(ws, `
      (() => {
        const inputEl = document.getElementById('pilot-name-input');
        const submitBtn = document.getElementById('pilot-name-submit');
        const startBtn = document.getElementById('start-btn');
        const title = document.getElementById('overlay-title');
        return {
          title: title.innerText.trim(),
          hasInput: Boolean(inputEl),
          submitBtnText: submitBtn ? submitBtn.innerText.trim() : null,
          startBtnHidden: startBtn ? startBtn.style.display === 'none' : false
        };
      })()
    `);
    console.log('首次通关结算界面状态:', firstVictoryUI);
    if (!firstVictoryUI.hasInput) {
      throw new Error('Expected nickname input on first stage 2 clear');
    }
    if (!firstVictoryUI.startBtnHidden) {
      throw new Error('Expected start-btn hidden until nickname entered');
    }

    // 3. 输入昵称并提交登榜
    console.log('\n[TEST 3] 玩家输入代号 "Maverick_77" 登榜...');
    const submitResult = await evalInPage(ws, `
      (async () => {
        const inputEl = document.getElementById('pilot-name-input');
        const submitBtn = document.getElementById('pilot-name-submit');
        inputEl.value = 'Maverick_77';
        submitBtn.click();
        await new Promise(r => setTimeout(r, 800));

        const saved = localStorage.getItem('doppler_pilot_name');
        const rankBanner = document.querySelector('.rank-banner');
        const startBtn = document.getElementById('start-btn');
        const viewBtn = document.getElementById('view-leaderboard-btn');

        return {
          savedPilot: saved,
          rankBannerText: rankBanner ? rankBanner.innerText.replace(/\\n/g, ' ') : null,
          startBtnText: startBtn ? startBtn.innerText.trim() : null,
          startBtnVisible: startBtn ? startBtn.style.display !== 'none' : false,
          hasViewBoardBtn: Boolean(viewBtn)
        };
      })()
    `);
    console.log('登榜结果与结算状态:', submitResult);
    if (submitResult.savedPilot !== 'Maverick_77') {
      throw new Error('Pilot nickname was not saved to localStorage');
    }
    if (!submitResult.startBtnVisible || submitResult.startBtnText !== '按任意键重新开始') {
      throw new Error('Start button was not restored with expected text');
    }

    // 4. 测试后续再次通关（已有昵称：自动更新）
    console.log('\n[TEST 4] 模拟再次击破第二关（自动同步成绩，无需重新输入）...');
    await evalInPage(ws, `document.getElementById('tab-stg2boss').click()`);
    await delay(300);

    // 击败终极泰坦
    await evalInPage(ws, `window.enemyTarget.die()`);
    for (let i = 0; i < 40; i++) {
      await evalInPage(ws, `for (let s = 0; s < 6; s++) window.physicsStep(window.FIXED_DT)`);
      await delay(30);
    }
    await delay(800);

    const autoSyncUI = await evalInPage(ws, `
      (() => {
        const inputEl = document.getElementById('pilot-name-input');
        const pilotBadge = document.querySelector('.pilot-badge-row');
        const rankBanner = document.querySelector('.rank-banner');
        const startBtn = document.getElementById('start-btn');
        return {
          hasInput: Boolean(inputEl),
          pilotText: pilotBadge ? pilotBadge.innerText.replace(/\\n/g, ' ') : null,
          rankText: rankBanner ? rankBanner.innerText.replace(/\\n/g, ' ') : null,
          startBtnText: startBtn ? startBtn.innerText.trim() : null
        };
      })()
    `);
    console.log('自动同步状态:', autoSyncUI);
    if (autoSyncUI.hasInput) {
      throw new Error('Subsequent victory should NOT prompt for nickname input');
    }
    if (!autoSyncUI.pilotText || !autoSyncUI.pilotText.includes('Maverick_77')) {
      throw new Error('Expected pilot badge to show Maverick_77');
    }

    // 5. 打开排行榜验证当前玩家高亮行
    console.log('\n[TEST 5] 查看 TOP 1000 排行榜并验证当前玩家高亮与 YOU 标签...');
    const viewBoardCheck = await evalInPage(ws, `
      (async () => {
        const viewBtn = document.getElementById('view-leaderboard-btn');
        viewBtn.click();
        await new Promise(r => setTimeout(r, 600));

        const myRow = document.querySelector('.lb-row.is-me');
        const youTag = document.querySelector('.you-tag');
        return {
          hasMyRow: Boolean(myRow),
          hasYouTag: Boolean(youTag),
          myRowText: myRow ? myRow.innerText.replace(/\\n/g, ' | ') : null
        };
      })()
    `);
    console.log('排行榜自身高亮检查:', viewBoardCheck);
    if (!viewBoardCheck.hasMyRow || !viewBoardCheck.hasYouTag) {
      throw new Error('Current pilot was not highlighted with YOU tag in leaderboard modal');
    }

    console.log('\n🎉 ALL 5 LEADERBOARD VERIFICATION TESTS PASSED FLAWLESSLY!');
    ws.close();
    chrome.kill();
    process.exit(0);
  } catch (err) {
    console.error('Test execution failed:', err);
    chrome.kill();
    process.exit(1);
  }
}, 800);
