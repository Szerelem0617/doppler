import { spawn } from 'child_process';

const chromePath = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const port = 9335;

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
        console.log('Page loaded. Launching 2-boss TAS demonstration...');
        // Select 2-boss card or tab, and click tas-run-btn
        setTimeout(() => {
          ws.send(JSON.stringify({
            id: 10,
            method: 'Runtime.evaluate',
            params: {
              expression: `(() => {
                const hub = document.getElementById('mission-hub');
                const cards = document.querySelectorAll('.mission-card');
                // Card 6 is 2-boss
                if (cards[6]) cards[6].click();
                // Then trigger TAS demo
                setTimeout(() => {
                  const tasBtn = document.getElementById('tas-run-btn');
                  if (tasBtn) tasBtn.click();
                }, 200);
                return 'Started 2-boss and clicked TAS demo';
              })()`,
              returnByValue: true
            }
          }));
        }, 500);

        // Poll every second until victory popup appears or timeout
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

          if (checkCount >= 60) {
            clearInterval(interval);
            console.error('Timed out waiting for victory popup.');
            ws.close();
            chrome.kill();
            process.exit(1);
          }
        }, 1000);
      }

      if (msg.id >= 101) {
        const val = msg.result?.result?.value;
        if (val && val.isVisible) {
          console.log('\n🎉 VICTORY OVERLAY DETECTED IN BROWSER!');
          console.log('Title:', val.title);
          console.log('Badge:', val.badge);
          console.log('Timer:', val.timerVal);
          console.log('Overlay display:', val.overlayDisplay);
          console.log('Overlay class:', val.overlayClasses);
          console.log('Desc:', val.descSnippet);

          // Capture screenshot of victory popup
          ws.send(JSON.stringify({
            id: 999,
            method: 'Page.captureScreenshot',
            params: { format: 'png' }
          }));
        } else {
          process.stdout.write(`Waiting... timer=${val?.timerVal} visible=${val?.isVisible}\r`);
        }
      }

      if (msg.id === 999) {
        const base64Data = msg.result.data;
        const fs = await import('fs');
        fs.writeFileSync('/Users/feng/Desktop/项目/web项目/doppler/scratch/victory_popup_browser.png', Buffer.from(base64Data, 'base64'));
        console.log('\nSaved screenshot to scratch/victory_popup_browser.png');
        ws.close();
        chrome.kill();
        process.exit(0);
      }
    };
  } catch (err) {
    console.error('Test error:', err);
    chrome.kill();
    process.exit(1);
  }
}, 1000);
