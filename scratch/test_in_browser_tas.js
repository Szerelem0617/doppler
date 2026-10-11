import { spawn } from 'child_process';

const chromePath = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const port = 9445;

console.log('Launching headless Chrome to test in-game TAS Demo for 2-boss...');
const tmpDir = `/tmp/chrome-tas-${Date.now()}`;
const chrome = spawn(chromePath, [
  '--headless',
  `--remote-debugging-port=${port}`,
  `--user-data-dir=${tmpDir}`,
  '--no-sandbox',
  '--disable-gpu',
  'about:blank'
]);

setTimeout(async () => {
  try {
    const listRes = await fetch(`http://127.0.0.1:${port}/json`);
    const pages = await listRes.json();
    const wsUrl = pages[0].webSocketDebuggerUrl;
    const ws = new WebSocket(wsUrl);

    let msgId = 1;
    function send(method, params = {}) {
      return new Promise((resolve) => {
        const id = msgId++;
        const handler = (event) => {
          const res = JSON.parse(event.data);
          if (res.id === id) {
            ws.removeEventListener('message', handler);
            resolve(res.result);
          }
        };
        ws.addEventListener('message', handler);
        ws.send(JSON.stringify({ id, method, params }));
      });
    }

    ws.onopen = async () => {
      await send('Runtime.enable');
      await send('Page.enable');
      await send('Page.navigate', { url: 'http://localhost:5173/' });

      ws.onmessage = (event) => {
        const msg = JSON.parse(event.data);
        if (msg.method === 'Runtime.consoleAPICalled') {
          const text = msg.params.args.map(a => a.value || a.description || '').join(' ');
          console.log('[BROWSER CONSOLE]', text);
        }
      };

      // Wait 1.5s for page to load Mission Hub
      setTimeout(async () => {
        console.log('Page loaded. Finding 2-boss card and clicking TAS 演示 button...');
        const clickRes = await send('Runtime.evaluate', {
          expression: `(() => {
            const btn = document.querySelector('.card-tas-btn[data-stage="2-boss"]');
            if (btn) {
              btn.click();
              return 'Clicked TAS button for 2-boss';
            }
            return 'Button not found';
          })()`
        });
        console.log('Click result:', clickRes.result.value);

        // Monitor game state every 2 seconds
        let elapsed = 0;
        const interval = setInterval(async () => {
          elapsed += 2;
          const statusRes = await send('Runtime.evaluate', {
            expression: `(() => {
              const timerEl = document.getElementById('timer-digits');
              const overlay = document.getElementById('game-overlay');
              const isOverlayVisible = overlay && getComputedStyle(overlay).display !== 'none';
              const overlayTitle = document.getElementById('overlay-title');
              const titleText = overlayTitle ? overlayTitle.textContent : '';
              const bossTag = document.getElementById('boss-tag');
              const bossHpText = document.getElementById('boss-hp-text');
              return {
                timer: timerEl ? timerEl.textContent : '--',
                isOverlayVisible,
                titleText,
                bossTag: bossTag ? bossTag.textContent : '',
                bossHp: bossHpText ? bossHpText.textContent : ''
              };
            })()`,
            returnByValue: true
          });
          const val = statusRes.result.value;
          console.log(`[T+${elapsed}s] Timer: ${val.timer} | Tag: ${val.bossTag} | BossHP: ${val.bossHp} | Overlay: ${val.isOverlayVisible} (${val.titleText})`);

          if (val.isOverlayVisible && val.titleText.includes('通关') || elapsed >= 28) {
            clearInterval(interval);
            console.log('\n>>> BROWSER TAS TEST FINISHED! Final Result:', val);
            ws.close();
            chrome.kill();
            process.exit(0);
          }
        }, 2000);
      }, 1500);
    };
  } catch (err) {
    console.error('Error:', err);
    chrome.kill();
    process.exit(1);
  }
}, 1000);
