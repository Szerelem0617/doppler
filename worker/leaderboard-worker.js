/**
 * Cloudflare Worker: 全服极速挑战 TOP 1000 排行榜
 * 
 * 部署指引：
 * 1. 在 Cloudflare 控制台 -> Workers & Pages -> 创建 Worker。
 * 2. 将此代码完全复制粘贴并点击 Save & Deploy。
 * 3. 在 Worker 的 Settings -> Variables -> KV Namespace Bindings 中：
 *    添加变量名称为 `GAME_KV`，绑定到你创建的 KV 命名空间。
 */

export default {
  async fetch(request, env) {
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    };

    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

    if (!env || !env.GAME_KV) {
      if (request.method === 'GET') {
        return Response.json({
          total: 0,
          items: [],
          warning: 'GAME_KV 未在 Cloudflare 后台绑定，请在 Worker Settings 中添加 KV 绑定 GAME_KV'
        }, { headers: corsHeaders });
      }
      if (request.method === 'POST') {
        return Response.json({
          rank: 1,
          total: 1,
          items: [],
          warning: 'GAME_KV 未绑定'
        }, { headers: corsHeaders });
      }
    }

    // 1. 获取前 1000 名极速榜数据
    if (request.method === 'GET') {
      const url = new URL(request.url);
      const limit = Math.min(parseInt(url.searchParams.get('limit') || '1000', 10), 1000);

      let list = [];
      try {
        list = (await env.GAME_KV.get('speedrun_board', 'json')) || [];
      } catch {
        list = [];
      }

      return Response.json({
        total: list.length,
        items: list.slice(0, limit)
      }, { headers: corsHeaders });
    }

    // 2. 提交玩家通关成绩
    if (request.method === 'POST') {
      let payload;
      try {
        payload = await request.json();
      } catch {
        return new Response('Invalid JSON payload', { status: 400, headers: corsHeaders });
      }

      const { name, time } = payload;
      if (!name || typeof time !== 'number' || isNaN(time) || time <= 0) {
        return new Response('Invalid data: valid pilot name and positive clear time required', {
          status: 400,
          headers: corsHeaders
        });
      }

      const cleanName = String(name).trim().slice(0, 20) || 'UNKNOWN PILOT';
      const cleanTime = Number(time.toFixed(3));
      const now = Date.now();

      let list = [];
      try {
        list = (await env.GAME_KV.get('speedrun_board', 'json')) || [];
      } catch {
        list = [];
      }

      // 同名飞行员自动更新逻辑：保留其个人历史最好用时（更短越好）
      const existingIdx = list.findIndex(r => r.name.toLowerCase() === cleanName.toLowerCase());
      let isNewBest = false;

      if (existingIdx !== -1) {
        if (cleanTime < list[existingIdx].time) {
          list[existingIdx].time = cleanTime;
          list[existingIdx].date = now;
          isNewBest = true;
        }
      } else {
        list.push({
          name: cleanName,
          time: cleanTime,
          date: now
        });
        isNewBest = true;
      }

      // 升序排列：用时越短排名越靠前；若用时完全一致，先通关者优先
      list.sort((a, b) => a.time - b.time || a.date - b.date);

      // 计算当前玩家在总榜中的实时排名（1-based）
      const myRank = list.findIndex(r => r.name.toLowerCase() === cleanName.toLowerCase()) + 1;

      // 保留全服前 1000 名
      if (list.length > 1000) {
        list = list.slice(0, 1000);
      }

      await env.GAME_KV.put('speedrun_board', JSON.stringify(list));

      return Response.json({
        rank: myRank,
        total: list.length,
        isNewBest,
        items: list.slice(0, 1000)
      }, { headers: corsHeaders });
    }

    return new Response('Method Not Allowed', { status: 405, headers: corsHeaders });
  }
};
