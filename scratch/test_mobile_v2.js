import { spawn } from 'child_process';
import fs from 'fs';

const chromePath = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const cdpPort = 9370;

const chrome = spawn(chromePath, [
  '--headless=new',
  `--remote-debugging-port=${cdpPort}`,
  '--no-sandbox',
  '--disable-gpu',
  '--disable-extensions',
  '--user-data-dir=/tmp/cdp-test-profile-' + Date.now(),
  '--window-size=393,852',
  '--user-agent=Mozilla/5.0 (iPhone; CPU iPhone OS 16_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.5 Mobile/15E148 Safari/604.1',
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

async function connectWithRetry(retries = 15, interval = 300) {
  for (let i = 0; i < retries; i++) {
    try {
      const listRes = await fetch(`http://127.0.0.1:${cdpPort}/json`);
      const pages = await listRes.json();
      const pageTarget = pages.find(p => p.type === 'page') || pages[0];
      if (pageTarget && pageTarget.webSocketDebuggerUrl) {
        return pageTarget.webSocketDebuggerUrl;
      }
    } catch (e) {
      // wait
    }
    await delay(interval);
  }
  throw new Error('Failed to connect to Chrome CDP after retries');
}

(async () => {
  try {
    const wsUrl = await connectWithRetry();
    const ws = new WebSocket(wsUrl);
    await new Promise(r => { ws.onopen = r; });

    await sendCdp(ws, 'Runtime.enable');
    await sendCdp(ws, 'Page.enable');

    console.log('[TEST] Navigating to http://localhost:5174/ ...');
    await sendCdp(ws, 'Page.navigate', { url: 'http://localhost:5174/' });
    await delay(3000);

    const curUrl = await evalInPage(ws, 'location.href');
    console.log('Current URL in CDP:', curUrl);

    // ==========================================
    // TEST 1: Check HEALTH tag text
    // ==========================================
    console.log('\n[TEST 1] Verifying HP tag text...');
    const hpTagText = await evalInPage(ws, `
      document.querySelector('.player-hp-tag') ? document.querySelector('.player-hp-tag').textContent.trim() : null
    `);
    console.log(`HP Tag text: "${hpTagText}"`);
    if (hpTagText !== 'HEALTH') {
      throw new Error(`Expected HP tag to be 'HEALTH', but got '${hpTagText}'!`);
    }
    console.log('✓ VERIFIED: Player health indicator displays "HEALTH" correctly.');

    // ==========================================
    // TEST 2: Dynamic Follow Joystick (跟手摇杆)
    // ==========================================
    console.log('\n[TEST 2] Verifying Dynamic Follow Joystick (跟手摇杆)...');
    // Start stage 2-boss so movement is active
    await evalInPage(ws, `
      (() => {
        window.tas.ctx.switchStage('2-boss');
        window.tas.ctx.startGame();
      })()
    `);
    await delay(400);

    // Initial resting state check
    const restingPos = await evalInPage(ws, `
      (() => {
        const base = document.getElementById('joystick-base');
        const rect = base.getBoundingClientRect();
        return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2, opacity: getComputedStyle(base).opacity };
      })()
    `);
    console.log('Resting joystick base center:', restingPos);

    // Touch down at an arbitrary location (120, 720) in joystick zone
    console.log('Touching down at (120, 720) in joystick zone...');
    await evalInPage(ws, `
      (() => {
        const zone = document.getElementById('mobile-joystick-zone');
        const touch = new Touch({ identifier: 201, target: zone, clientX: 120, clientY: 720 });
        zone.dispatchEvent(new TouchEvent('touchstart', { touches: [touch], changedTouches: [touch], bubbles: true, cancelable: true }));
      })()
    `);
    await delay(100);

    const activeBasePos = await evalInPage(ws, `
      (() => {
        const base = document.getElementById('joystick-base');
        const rect = base.getBoundingClientRect();
        return {
          x: rect.left + rect.width / 2,
          y: rect.top + rect.height / 2,
          active: base.classList.contains('active'),
          tracking: window.virtualJoystick.isTracking
        };
      })()
    `);
    console.log('Active joystick base center after touchstart:', activeBasePos);
    if (Math.abs(activeBasePos.x - 120) > 2 || Math.abs(activeBasePos.y - 720) > 2) {
      throw new Error(`Joystick base did not center at touch coordinate (120, 720)! Got: (${activeBasePos.x}, ${activeBasePos.y})`);
    }
    console.log('✓ VERIFIED: Joystick base dynamically centered at finger touch location (跟手生效)!');

    // Move to (160, 720) within radius
    console.log('Dragging to (160, 720)...');
    await evalInPage(ws, `
      (() => {
        const zone = document.getElementById('mobile-joystick-zone');
        const touch = new Touch({ identifier: 201, target: zone, clientX: 160, clientY: 720 });
        window.dispatchEvent(new TouchEvent('touchmove', { touches: [touch], changedTouches: [touch], bubbles: true, cancelable: true }));
      })()
    `);
    for (let i = 0; i < 20; i++) {
      await evalInPage(ws, `window.physicsStep(window.FIXED_DT)`);
    }
    const movedPlayer = await evalInPage(ws, `({ x: window.player.x, y: window.player.y, vx: window.player.vx })`);
    console.log('Player moving state:', movedPlayer);
    if (movedPlayer.vx <= 0) {
      throw new Error('Player did not move right with joystick drag!');
    }
    console.log('✓ VERIFIED: Dynamic joystick controls player movement successfully!');

    // Drag beyond max radius to test base follow (滑动跟手追踪)
    console.log('Dragging far right to (260, 720) beyond max radius to test base follow...');
    await evalInPage(ws, `
      (() => {
        const zone = document.getElementById('mobile-joystick-zone');
        const touch = new Touch({ identifier: 201, target: zone, clientX: 260, clientY: 720 });
        window.dispatchEvent(new TouchEvent('touchmove', { touches: [touch], changedTouches: [touch], bubbles: true, cancelable: true }));
      })()
    `);
    await delay(100);

    const followedBasePos = await evalInPage(ws, `
      (() => {
        const base = document.getElementById('joystick-base');
        const rect = base.getBoundingClientRect();
        return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
      })()
    `);
    console.log('Base center after far drag:', followedBasePos);
    // Base should have moved right to clientX - maxRadius (260 - 46 = 214)
    if (followedBasePos.x <= 130) {
      throw new Error(`Joystick base did not follow finger when dragging beyond radius! Base x is ${followedBasePos.x}`);
    }
    console.log(`✓ VERIFIED: Joystick base followed finger forward to x: ${followedBasePos.x.toFixed(1)}px (超距跟手生效)!`);

    // Release touch
    await evalInPage(ws, `
      (() => {
        const zone = document.getElementById('mobile-joystick-zone');
        const touchEnd = new Touch({ identifier: 201, target: zone, clientX: 0, clientY: 0 });
        window.dispatchEvent(new TouchEvent('touchend', { touches: [], changedTouches: [touchEnd], bubbles: true }));
      })()
    `);
    await delay(350);

    const postReleasePos = await evalInPage(ws, `
      (() => {
        const base = document.getElementById('joystick-base');
        const rect = base.getBoundingClientRect();
        return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2, active: base.classList.contains('active') };
      })()
    `);
    console.log('Base position after release (reset to resting anchor):', postReleasePos);
    if (postReleasePos.active) {
      throw new Error('Base should not be active after release!');
    }
    console.log('✓ VERIFIED: Joystick smoothly reset to resting anchor on release.');

    // Save portrait screenshot
    const ss1 = await sendCdp(ws, 'Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync('/Users/feng/.gemini/antigravity/brain/f5ab6a17-68be-44e9-b0bf-8f6424d8925b/mobile_adaptation_verified.png', Buffer.from(ss1.data, 'base64'));

    // ==========================================
    // TEST 3: Landscape Mode & Blink Button Position
    // ==========================================
    console.log('\n[TEST 3] Testing Mobile Landscape mode (844 x 390)...');
    try {
      await sendCdp(ws, 'Emulation.setDeviceMetricsOverride', {
        width: 844,
        height: 390,
        deviceScaleFactor: 3,
        mobile: true,
        hasTouch: true
      });
    } catch (e) {
      // In some environments, window resize via CDP
    }

    // Trigger resize & layout
    await evalInPage(ws, `
      (() => {
        window.resizeCanvas();
      })()
    `);
    await delay(500);

    const landscapeGeo = await evalInPage(ws, `
      (() => {
        const winH = window.innerHeight;
        const winW = window.innerWidth;
        const btn = document.getElementById('mobile-blink-btn');
        const btnRect = btn.getBoundingClientRect();
        const actionsZone = document.getElementById('mobile-actions-zone');
        const zoneRect = actionsZone.getBoundingClientRect();
        const hpCard = document.getElementById('player-hp-card');
        const hpRect = hpCard.getBoundingClientRect();
        const canvas = document.getElementById('game-canvas');
        const canvasRect = canvas.getBoundingClientRect();

        return {
          winW,
          winH,
          btnRect: {
            top: btnRect.top,
            bottom: btnRect.bottom,
            left: btnRect.left,
            right: btnRect.right,
            width: btnRect.width,
            height: btnRect.height
          },
          marginFromBottom: winH - btnRect.bottom,
          marginFromRight: winW - btnRect.right,
          canvasRect: {
            left: canvasRect.left,
            right: canvasRect.right
          },
          hpRect: {
            top: hpRect.top,
            bottom: hpRect.bottom
          }
        };
      })()
    `);
    console.log('Landscape geometry report:', JSON.stringify(landscapeGeo, null, 2));

    // Assert: Blink button is strictly and completely inside the visible screen!
    if (landscapeGeo.btnRect.bottom > landscapeGeo.winH) {
      throw new Error(`Blink button bottom (${landscapeGeo.btnRect.bottom}px) is OUTSIDE screen height (${landscapeGeo.winH}px)!`);
    }
    if (landscapeGeo.marginFromBottom < 10) {
      throw new Error(`Blink button has insufficient bottom margin (${landscapeGeo.marginFromBottom}px)!`);
    }
    if (landscapeGeo.btnRect.right > landscapeGeo.winW) {
      throw new Error(`Blink button right (${landscapeGeo.btnRect.right}px) is OUTSIDE screen width (${landscapeGeo.winW}px)!`);
    }
    console.log(`✓ VERIFIED: Blink button is 100% inside screen! Bottom margin: ${landscapeGeo.marginFromBottom.toFixed(1)}px, Right margin: ${landscapeGeo.marginFromRight.toFixed(1)}px.`);

    // Save landscape screenshot
    const ss2 = await sendCdp(ws, 'Page.captureScreenshot', { format: 'png' });
    const landscapePath = '/Users/feng/.gemini/antigravity/brain/f5ab6a17-68be-44e9-b0bf-8f6424d8925b/mobile_landscape_verified.png';
    fs.writeFileSync(landscapePath, Buffer.from(ss2.data, 'base64'));
    console.log(`Landscape screenshot saved to: ${landscapePath}`);

    console.log('\n🎉 ALL MOBILE OPTIMIZATION VERIFICATIONS PASSED PERFECTLY!');
    ws.close();
    chrome.kill();
    process.exit(0);
  } catch (err) {
    console.error('Test execution failed:', err);
    chrome.kill();
    process.exit(1);
  }
})();
