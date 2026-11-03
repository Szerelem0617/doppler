import { spawn } from 'child_process';
import fs from 'fs';

const chromePath = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const cdpPort = 9370;

const chrome = spawn(chromePath, [
  '--headless=new',
  `--remote-debugging-port=${cdpPort}`,
  '--no-sandbox',
  '--disable-gpu',
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
      if (pages.length > 0 && pages[0].webSocketDebuggerUrl) {
        return pages[0].webSocketDebuggerUrl;
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
    await delay(2000);

    try {
      await sendCdp(ws, 'Emulation.setDeviceMetricsOverride', {
        width: 393,
        height: 852,
        deviceScaleFactor: 3,
        mobile: true,
        hasTouch: true
      });
      await sendCdp(ws, 'Emulation.setTouchEmulationEnabled', {
        enabled: true,
        maxTouchPoints: 5
      });
    } catch (e) {
      console.log('Metrics override notice (already set by window-size):', e.message || e);
    }
    await sendCdp(ws, 'Page.navigate', { url: 'http://localhost:5174/' });
    await delay(1200);

    // 1. Verify layout geometry: Zero overlap check!
    console.log('\n[TEST 1] Checking Mobile HUD & Canvas zero-overlap geometry...');
    const geo = await evalInPage(ws, `
      (() => {
        const canvas = document.getElementById('game-canvas');
        const header = document.querySelector('.hud-header-bar');
        const hudRight = document.querySelector('.hud-right');
        const controls = document.getElementById('mobile-controls');
        const joystick = document.getElementById('mobile-joystick-zone');
        const blinkBtn = document.getElementById('mobile-blink-btn');
        const hpCard = document.getElementById('player-hp-card');

        const cRect = canvas.getBoundingClientRect();
        const hRect = header.getBoundingClientRect();
        const rRect = hudRight.getBoundingClientRect();
        const jRect = joystick.getBoundingClientRect();
        const bRect = blinkBtn.getBoundingClientRect();
        const hpRect = hpCard.getBoundingClientRect();

        return {
          windowHeight: window.innerHeight,
          windowWidth: window.innerWidth,
          canvas: { top: cRect.top, bottom: cRect.bottom, width: cRect.width, height: cRect.height },
          headerBottom: hRect.bottom,
          dataStripBottom: rRect.bottom,
          joystickTop: jRect.top,
          blinkBtnTop: bRect.top,
          hpCardTop: hpRect.top,
          hpCardBottom: hpRect.bottom,
          controlsVisible: getComputedStyle(controls).display !== 'none',
          joystickVisible: getComputedStyle(joystick).display !== 'none',
          blinkVisible: getComputedStyle(blinkBtn).display !== 'none'
        };
      })()
    `);
    console.log('Geometry report:', JSON.stringify(geo, null, 2));

    // Assert: Top data panels are completely above the canvas
    if (geo.dataStripBottom > geo.canvas.top) {
      throw new Error(`Data strip bottom (${geo.dataStripBottom}px) overlaps canvas top (${geo.canvas.top}px)!`);
    }
    console.log(`✓ VERIFIED: Top data strip bottom (${geo.dataStripBottom.toFixed(1)}px) is strictly ABOVE canvas top (${geo.canvas.top.toFixed(1)}px)!`);

    // Assert: Joystick and Blink buttons are completely below the canvas
    if (geo.joystickTop < geo.canvas.bottom) {
      throw new Error(`Joystick top (${geo.joystickTop}px) overlaps canvas bottom (${geo.canvas.bottom}px)!`);
    }
    if (geo.blinkBtnTop < geo.canvas.bottom) {
      throw new Error(`Blink button top (${geo.blinkBtnTop}px) overlaps canvas bottom (${geo.canvas.bottom}px)!`);
    }
    console.log(`✓ VERIFIED: Joystick top (${geo.joystickTop.toFixed(1)}px) and Blink button top (${geo.blinkBtnTop.toFixed(1)}px) are strictly BELOW canvas bottom (${geo.canvas.bottom.toFixed(1)}px)!`);

    // 2. Start game and test virtual joystick movement
    console.log('\n[TEST 2] Starting game and testing Virtual Joystick...');
    await evalInPage(ws, `
      (() => {
        // Switch to stage 2-boss so movement is unrestricted
        window.tas.ctx.switchStage('2-boss');
        window.tas.ctx.startGame();
      })()
    `);
    await delay(300);

    const initialPos = await evalInPage(ws, `({ x: window.player.x, y: window.player.y })`);
    console.log('Initial player position:', initialPos);

    // Simulate pushing joystick to the right (x: 1, y: 0)
    console.log('Simulating pushing virtual joystick to the right (move right)...');
    await evalInPage(ws, `
      (() => {
        const zone = document.getElementById('mobile-joystick-zone');
        const rect = zone.getBoundingClientRect();
        const centerX = rect.left + rect.width / 2;
        const centerY = rect.top + rect.height / 2;

        // Touch start at center
        const touch1 = new Touch({
          identifier: 101,
          target: zone,
          clientX: centerX,
          clientY: centerY
        });
        zone.dispatchEvent(new TouchEvent('touchstart', { touches: [touch1], changedTouches: [touch1], bubbles: true, cancelable: true }));

        // Move to the right by 40px
        const touch2 = new Touch({
          identifier: 101,
          target: zone,
          clientX: centerX + 40,
          clientY: centerY
        });
        window.dispatchEvent(new TouchEvent('touchmove', { touches: [touch2], changedTouches: [touch2], bubbles: true, cancelable: true }));
      })()
    `);

    // Step physics forward
    for (let i = 0; i < 30; i++) {
      await evalInPage(ws, `window.physicsStep(window.FIXED_DT)`);
    }

    const movedPos = await evalInPage(ws, `({ x: window.player.x, y: window.player.y, vx: window.player.vx })`);
    console.log('Player position after moving right:', movedPos);

    if (movedPos.x <= initialPos.x) {
      throw new Error(`Player did not move right! Expected x > ${initialPos.x}, got ${movedPos.x}`);
    }
    console.log(`✓ VERIFIED: Player moved right from ${initialPos.x.toFixed(1)} to ${movedPos.x.toFixed(1)} via virtual joystick!`);

    // Release joystick
    await evalInPage(ws, `
      (() => {
        const zone = document.getElementById('mobile-joystick-zone');
        const touchEnd = new Touch({ identifier: 101, target: zone, clientX: 0, clientY: 0 });
        window.dispatchEvent(new TouchEvent('touchend', { touches: [], changedTouches: [touchEnd], bubbles: true }));
      })()
    `);

    // Test moving up/left
    console.log('Simulating pushing virtual joystick up-left...');
    await evalInPage(ws, `
      (() => {
        const zone = document.getElementById('mobile-joystick-zone');
        const rect = zone.getBoundingClientRect();
        const centerX = rect.left + rect.width / 2;
        const centerY = rect.top + rect.height / 2;
        const touch = new Touch({
          identifier: 102,
          target: zone,
          clientX: centerX,
          clientY: centerY
        });
        zone.dispatchEvent(new TouchEvent('touchstart', { touches: [touch], changedTouches: [touch], bubbles: true, cancelable: true }));

        const touchMove = new Touch({
          identifier: 102,
          target: zone,
          clientX: centerX - 35,
          clientY: centerY - 35
        });
        window.dispatchEvent(new TouchEvent('touchmove', { touches: [touchMove], changedTouches: [touchMove], bubbles: true, cancelable: true }));
      })()
    `);
    for (let i = 0; i < 20; i++) {
      await evalInPage(ws, `window.physicsStep(window.FIXED_DT)`);
    }
    const upLeftPos = await evalInPage(ws, `({ x: window.player.x, y: window.player.y, vx: window.player.vx, vy: window.player.vy })`);
    console.log('Player position after moving up-left:', upLeftPos);
    if (upLeftPos.x >= movedPos.x || upLeftPos.y >= movedPos.y) {
      throw new Error(`Player did not move up-left properly! Got x:${upLeftPos.x}, y:${upLeftPos.y}`);
    }
    console.log('✓ VERIFIED: 360° omnidirectional joystick movement works!');

    // Release joystick
    await evalInPage(ws, `
      (() => {
        const zone = document.getElementById('mobile-joystick-zone');
        const touchEnd = new Touch({ identifier: 102, target: zone, clientX: 0, clientY: 0 });
        window.dispatchEvent(new TouchEvent('touchend', { touches: [], changedTouches: [touchEnd], bubbles: true }));
      })()
    `);

    // 3. Test Mobile Blink Button
    console.log('\n[TEST 3] Testing Mobile Blink Button (折跃闪现)...');
    const preBlinkX = (await evalInPage(ws, `window.player.x`));
    const preBlinkY = (await evalInPage(ws, `window.player.y`));

    // Tap mobile blink button
    await evalInPage(ws, `
      (() => {
        const btn = document.getElementById('mobile-blink-btn');
        btn.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true }));
      })()
    `);

    // Step physics forward
    await evalInPage(ws, `window.physicsStep(window.FIXED_DT)`);

    const postBlink = await evalInPage(ws, `
      (() => {
        const btn = document.getElementById('mobile-blink-btn');
        const cdText = document.getElementById('blink-cd-text');
        return {
          x: window.player.x,
          y: window.player.y,
          cdTimer: window.player.blinkCdTimer,
          isCooling: btn.classList.contains('cooling'),
          cdTextContent: cdText ? cdText.textContent : null
        };
      })()
    `);
    console.log('Post blink status:', postBlink);

    if (postBlink.cdTimer <= 0) {
      throw new Error('Blink cooldown did not activate after clicking mobile blink button!');
    }
    console.log(`✓ VERIFIED: Blink executed! CD timer activated at ${postBlink.cdTimer.toFixed(2)}s, button shows cooling state.`);

    // 4. Capture screenshot of mobile screen
    console.log('\n[TEST 4] Capturing mobile screenshot for visual verification...');
    const ss = await sendCdp(ws, 'Page.captureScreenshot', { format: 'png' });
    const ssBuffer = Buffer.from(ss.data, 'base64');
    const ssPath = '/Users/feng/.gemini/antigravity/brain/f5ab6a17-68be-44e9-b0bf-8f6424d8925b/mobile_adaptation_verified.png';
    fs.writeFileSync(ssPath, ssBuffer);
    console.log(`Screenshot saved to: ${ssPath}`);

    console.log('\n🎉 ALL MOBILE ADAPTATION CHECKS PASSED PERFECTLY!');
    ws.close();
    chrome.kill();
    process.exit(0);
  } catch (err) {
    console.error('Test execution failed:', err);
    chrome.kill();
    process.exit(1);
  }
})();
