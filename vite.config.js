import { defineConfig } from 'vite';

let devLeaderboard = [];

export default defineConfig({
  server: {
    port: 5173,
    open: false,
    host: true
  },
  plugins: [
    {
      name: 'dev-leaderboard-api',
      configureServer(server) {
        server.middlewares.use('/api/leaderboard', (req, res) => {
          res.setHeader('Content-Type', 'application/json');
          res.setHeader('Access-Control-Allow-Origin', '*');
          res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
          res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

          if (req.method === 'OPTIONS') {
            res.statusCode = 204;
            return res.end();
          }

          if (req.method === 'GET') {
            return res.end(JSON.stringify({
              total: devLeaderboard.length,
              items: devLeaderboard.slice(0, 1000)
            }));
          }

          if (req.method === 'POST') {
            let body = '';
            req.on('data', chunk => { body += chunk; });
            req.on('end', () => {
              try {
                const { name, time } = JSON.parse(body || '{}');
                if (!name || typeof time !== 'number' || isNaN(time) || time <= 0) {
                  res.statusCode = 400;
                  return res.end(JSON.stringify({ error: 'Invalid name or time' }));
                }
                const cleanName = String(name).trim().slice(0, 20) || 'PILOT';
                const cleanTime = Number(time.toFixed(3));
                const now = Date.now();

                const existingIdx = devLeaderboard.findIndex(r => r.name.toLowerCase() === cleanName.toLowerCase());
                let isNewBest = false;
                if (existingIdx !== -1) {
                  if (cleanTime < devLeaderboard[existingIdx].time) {
                    devLeaderboard[existingIdx].time = cleanTime;
                    devLeaderboard[existingIdx].date = now;
                    isNewBest = true;
                  }
                } else {
                  devLeaderboard.push({ name: cleanName, time: cleanTime, date: now });
                  isNewBest = true;
                }

                devLeaderboard.sort((a, b) => a.time - b.time || a.date - b.date);
                const rank = devLeaderboard.findIndex(r => r.name.toLowerCase() === cleanName.toLowerCase()) + 1;
                if (devLeaderboard.length > 1000) {
                  devLeaderboard = devLeaderboard.slice(0, 1000);
                }

                return res.end(JSON.stringify({
                  rank,
                  total: devLeaderboard.length,
                  isNewBest,
                  items: devLeaderboard.slice(0, 1000)
                }));
              } catch (e) {
                res.statusCode = 400;
                return res.end(JSON.stringify({ error: e.message }));
              }
            });
            return;
          }

          res.statusCode = 405;
          res.end(JSON.stringify({ error: 'Method Not Allowed' }));
        });
      }
    }
  ]
});
