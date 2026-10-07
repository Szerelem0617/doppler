import { spawn } from 'child_process';

const chromePath = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const port = 9336;

const chrome = spawn(chromePath, [
  '--headless',
  `--remote-debugging-port=${port}`,
  '--no-sandbox',
  '--disable-gpu',
  '--disable-background-timer-throttling',
  '--disable-backgrounding-occluded-windows',
  '--disable-renderer-backgrounding',
  'about:blank'
]);

setTimeout(async () => {
  try {
    const listRes = await fetch(`http://127.0.0.1:${port}/json`);
    const pages = await listRes.json();
    const wsUrl = pages[0].webSocketDebuggerUrl;

    const ws = new WebSocket(wsUrl);

    ws.onopen = () => {
      ws.send(JSON.stringify({ id: 1, method: 'Runtime.enable' }));
      ws.send(JSON.stringify({ id: 2, method: 'Page.enable' }));
      ws.send(JSON.stringify({ id: 3, method: 'Page.navigate', params: { url: 'http://localhost:5173/' } }));
    };

    ws.onmessage = async (event) => {
      const msg = JSON.parse(event.data);
      if (msg.method === 'Page.loadEventFired') {
        console.log('Page loaded. Launching STAGE 1 TAS demonstration...');
        setTimeout(() => {
          ws.send(JSON.stringify({
            id: 10,
            method: 'Runtime.evaluate',
            params: {
              expression: `(() => {
                const cards = document.querySelectorAll('.mission-card');
                // Card 0 is STAGE 1
                if (cards[0]) cards[0].click();
                setTimeout(() => {
                  const tasBtn = document.getElementById('tas-run-btn');
                  if (tasBtn) tasBtn.click();
                }, 200);
                return 'Started STAGE 1 and clicked TAS demo';
              })()`,
              returnByValue: true
            }
          }));
        }, 500);

        let checkCount = 0;
        const interval = setInterval(() => {
          checkCount++;
          ws.send(JSON.stringify({
            id: 100 + checkCount,
            method: 'Runtime.evaluate',
            params: {
              expression: `(() => {
                const overlay = document.getElementById('game-overlay');
                const title = document.getElementById('overlay-title')?.textContent;
                const desc = document.getElementById('overlay-desc')?.innerHTML;
                const badge = document.getElementById('overlay-badge')?.textContent;
                const isVisible = overlay && overlay.style.display !== 'none' && !overlay.classList.contains('hidden');
                const timerVal = document.getElementById('timer-digits')?.textContent;
                return {
                  isVisible,
                  overlayDisplay: overlay?.style.display,
                  overlayClasses: overlay?.className,
                  title,
                  badge,
                  timerVal,
                  descSnippet: desc ? desc.substring(0, 150) : ''
                };
              })()`,
              returnByValue: true
            }
          }));

          if (checkCount >= 30) {
            clearInterval(interval);
            console.error('Timed out.');
            ws.close();
            chrome.kill();
            process.exit(1);
          }
        }, 500);
      }

      if (msg.id >= 101) {
        const val = msg.result?.result?.value;
        if (val && val.isVisible) {
          console.log('\n🎉 VICTORY OVERLAY DETECTED IN BROWSER!');
          console.log('Title:', val.title);
          console.log('Badge:', val.badge);
          console.log('Timer:', val.timerVal);
          console.log('Overlay display:', val.overlayDisplay);
          console.log('Desc:', val.descSnippet);
          ws.close();
          chrome.kill();
          process.exit(0);
        } else {
          process.stdout.write(`Waiting... timer=${val?.timerVal} visible=${val?.isVisible}\r`);
        }
      }
    };
  } catch (err) {
    console.error('Test error:', err);
    chrome.kill();
    process.exit(1);
  }
}, 1000);
