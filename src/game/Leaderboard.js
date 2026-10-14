/**
 * Leaderboard.js - 全服极速榜 TOP 1000 客户端管理器
 * 支持：
 * 1. 领航员代号（Nickname）本地持久化与修改；
 * 2. 自动提交用时与全服实时名次计算；
 * 3. TOP 1000 极速榜弹窗渲染与搜索筛选；
 * 4. 优雅的网络离线/本地回退保障。
 */

export class LeaderboardManager {
  constructor() {
    this.STORAGE_KEY_PILOT = 'doppler_pilot_name';
    this.STORAGE_KEY_CACHE = 'doppler_leaderboard_cache';
    this.STORAGE_KEY_BEST = 'doppler_pilot_best_time';

    this.apiUrl = window.LEADERBOARD_API_URL || '/api/leaderboard';
    this.cachedList = this.loadLocalCache();

    this.modalEl = null;
    this.listBodyEl = null;
    this.searchEl = null;
    this.countEl = null;
    this.statusEl = null;

    this.initDOM();
  }

  // 获取本地保存的领航员代号
  getPilotName() {
    try {
      return (localStorage.getItem(this.STORAGE_KEY_PILOT) || '').trim();
    } catch {
      return '';
    }
  }

  // 保存领航员代号
  setPilotName(name) {
    const clean = String(name || '').trim().slice(0, 20);
    try {
      localStorage.setItem(this.STORAGE_KEY_PILOT, clean);
    } catch {
      // ignore
    }
    return clean;
  }

  hasPilotName() {
    return Boolean(this.getPilotName());
  }

  // 读取本地缓存的榜单
  loadLocalCache() {
    try {
      const data = localStorage.getItem(this.STORAGE_KEY_CACHE);
      if (data) return JSON.parse(data);
    } catch {
      // ignore
    }
    return [
      { name: 'HyperNova', time: 13.820, date: Date.now() - 86400000 * 2 },
      { name: 'PhantomBlade', time: 15.410, date: Date.now() - 86400000 },
      { name: 'AeroZero', time: 17.650, date: Date.now() - 3600000 * 5 }
    ];
  }

  saveLocalCache(list) {
    try {
      localStorage.setItem(this.STORAGE_KEY_CACHE, JSON.stringify(list.slice(0, 1000)));
    } catch {
      // ignore
    }
  }

  // 格式化用时：分:秒.毫秒 (00:15.342)
  formatTime(secs) {
    if (typeof secs !== 'number' || isNaN(secs)) return '--:--.---';
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    const ms = Math.floor((secs % 1) * 1000);
    const mm = m < 10 ? '0' + m : m;
    const ss = s < 10 ? '0' + s : s;
    const mss = ms < 10 ? '00' + ms : (ms < 100 ? '0' + ms : ms);
    return `${mm}:${ss}.${mss}`;
  }

  // 格式化日期
  formatDate(timestamp) {
    if (!timestamp) return '未知时间';
    const date = new Date(timestamp);
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    const hh = String(date.getHours()).padStart(2, '0');
    const mm = String(date.getMinutes()).padStart(2, '0');
    return `${y}-${m}-${d} ${hh}:${mm}`;
  }

  // 拉取全服排行榜 (默认取前 1000 条)
  async fetchTopScores(limit = 1000) {
    try {
      const resp = await fetch(`${this.apiUrl}?limit=${limit}`, {
        method: 'GET',
        headers: { 'Accept': 'application/json' }
      });
      if (resp.ok) {
        const data = await resp.json();
        const items = data.items || [];
        if (items.length > 0) {
          this.cachedList = items;
          this.saveLocalCache(items);
        }
        return { total: data.total || items.length, items };
      }
    } catch (err) {
      console.warn('[Leaderboard] Network request failed, using cached list:', err);
    }
    return { total: this.cachedList.length, items: this.cachedList };
  }

  // 提交通关成绩
  async submitScore(name, clearTime) {
    const cleanName = this.setPilotName(name);
    const cleanTime = Number(Number(clearTime).toFixed(3));

    try {
      const resp = await fetch(this.apiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: cleanName, time: cleanTime })
      });

      if (resp.ok) {
        const res = await resp.json();
        if (res.items && res.items.length > 0) {
          this.cachedList = res.items;
          this.saveLocalCache(res.items);
        }
        return {
          rank: res.rank || 1,
          total: res.total || this.cachedList.length,
          isNewBest: Boolean(res.isNewBest),
          items: res.items || this.cachedList
        };
      }
    } catch (err) {
      console.warn('[Leaderboard] Submit network error, updating local simulation:', err);
    }

    // 离线/开发环境本地模拟更新
    const now = Date.now();
    const existing = this.cachedList.find(r => r.name.toLowerCase() === cleanName.toLowerCase());
    let isNewBest = false;
    if (existing) {
      if (cleanTime < existing.time) {
        existing.time = cleanTime;
        existing.date = now;
        isNewBest = true;
      }
    } else {
      this.cachedList.push({ name: cleanName, time: cleanTime, date: now });
      isNewBest = true;
    }
    this.cachedList.sort((a, b) => a.time - b.time || a.date - b.date);
    const rank = this.cachedList.findIndex(r => r.name.toLowerCase() === cleanName.toLowerCase()) + 1;
    this.saveLocalCache(this.cachedList);

    return {
      rank,
      total: this.cachedList.length,
      isNewBest,
      items: this.cachedList
    };
  }

  // 初始化 DOM 结构 (排行榜独立弹窗)
  initDOM() {
    if (document.getElementById('leaderboard-modal')) {
      this.modalEl = document.getElementById('leaderboard-modal');
      this.listBodyEl = document.getElementById('lb-table-body');
      this.searchEl = document.getElementById('lb-search-input');
      this.countEl = document.getElementById('lb-total-count');
      this.statusEl = document.getElementById('lb-pilot-status');
      return;
    }

    const modal = document.createElement('div');
    modal.id = 'leaderboard-modal';
    modal.className = 'leaderboard-modal hidden';
    modal.style.display = 'none';

    modal.innerHTML = `
      <div class="lb-card">
        <div class="lb-header">
          <div class="lb-title-box">
            <span class="lb-icon">🏆</span>
            <div>
              <h2 class="lb-title">全服极速挑战榜 // TOP 1000</h2>
              <div class="lb-subtitle" id="lb-total-count">已收录 -- 位领航员</div>
            </div>
          </div>
          <button class="lb-close-btn" id="lb-close-btn" title="关闭 (ESC)">✕</button>
        </div>

        <div class="lb-toolbar">
          <div class="lb-search-box">
            <span class="search-icon">🔍</span>
            <input type="text" id="lb-search-input" placeholder="输入代号快速定位..." autocomplete="off" />
          </div>
          <div class="lb-pilot-badge" id="lb-pilot-status">
            当前代号: <strong id="lb-pilot-name-display">未登记</strong>
            <button class="lb-edit-btn" id="lb-edit-pilot-btn" title="更换代号">✎</button>
          </div>
          <button class="lb-refresh-btn" id="lb-refresh-btn" title="刷新最新排名">↻ 刷新</button>
        </div>

        <div class="lb-table-container">
          <table class="lb-table">
            <thead>
              <tr>
                <th style="width: 70px; text-align: center;">排名</th>
                <th>领航员代号</th>
                <th style="width: 130px; text-align: right;">通关用时</th>
                <th style="width: 150px; text-align: right;">达成时间</th>
              </tr>
            </thead>
            <tbody id="lb-table-body">
              <tr><td colspan="4" class="lb-loading">正在拉取全服极速榜数据...</td></tr>
            </tbody>
          </table>
        </div>

        <div class="lb-footer">
          <div class="lb-footer-tip">按用时升序排行 // 相同用时先达成者在前</div>
          <button class="action-btn lb-bottom-close" id="lb-bottom-close">返回游戏 [ESC]</button>
        </div>
      </div>
    `;

    document.getElementById('app').appendChild(modal);

    this.modalEl = modal;
    this.listBodyEl = modal.querySelector('#lb-table-body');
    this.searchEl = modal.querySelector('#lb-search-input');
    this.countEl = modal.querySelector('#lb-total-count');
    this.statusEl = modal.querySelector('#lb-pilot-name-display');

    // 事件绑定
    modal.querySelector('#lb-close-btn').addEventListener('click', (e) => {
      e.stopPropagation();
      this.closeModal();
    });
    modal.querySelector('#lb-bottom-close').addEventListener('click', (e) => {
      e.stopPropagation();
      this.closeModal();
    });
    modal.addEventListener('click', (e) => {
      if (e.target === modal) this.closeModal();
    });

    // 刷新按钮
    modal.querySelector('#lb-refresh-btn').addEventListener('click', async (e) => {
      e.stopPropagation();
      await this.refreshBoard();
    });

    // 搜索实时筛选
    this.searchEl.addEventListener('input', () => {
      this.renderTable(this.cachedList, this.searchEl.value.trim());
    });

    // 修改代号
    modal.querySelector('#lb-edit-pilot-btn').addEventListener('click', (e) => {
      e.stopPropagation();
      this.promptChangePilotName();
    });
  }

  // 打开排行榜弹窗
  async openModal() {
    this.initDOM();
    this.modalEl.style.display = 'flex';
    void this.modalEl.offsetWidth;
    this.modalEl.classList.remove('hidden');

    this.updatePilotBadge();
    await this.refreshBoard();
  }

  // 关闭排行榜弹窗
  closeModal() {
    if (!this.modalEl) return;
    this.modalEl.classList.add('hidden');
    setTimeout(() => {
      if (this.modalEl.classList.contains('hidden')) {
        this.modalEl.style.display = 'none';
      }
    }, 200);
  }

  isModalOpen() {
    return this.modalEl && this.modalEl.style.display !== 'none' && !this.modalEl.classList.contains('hidden');
  }

  // 刷新榜单数据
  async refreshBoard() {
    if (this.listBodyEl) {
      this.listBodyEl.innerHTML = `<tr><td colspan="4" class="lb-loading">⚡ 正在拉取全服 TOP 1000 极速榜...</td></tr>`;
    }
    const { total, items } = await this.fetchTopScores(1000);
    if (this.countEl) {
      this.countEl.textContent = `全服共收录 ${total} 位顶级飞行员`;
    }
    this.renderTable(items, this.searchEl ? this.searchEl.value.trim() : '');
  }

  // 渲染排行榜表格行
  renderTable(list, filterText = '') {
    if (!this.listBodyEl) return;

    const myName = this.getPilotName().toLowerCase();
    const query = filterText.toLowerCase();

    const filtered = query
      ? list.filter(item => item.name.toLowerCase().includes(query))
      : list;

    if (filtered.length === 0) {
      this.listBodyEl.innerHTML = `<tr><td colspan="4" class="lb-empty">未找到匹配的领航员记录</td></tr>`;
      return;
    }

    let rowsHtml = '';
    filtered.forEach((item, index) => {
      // 如果经过搜索过滤，排名用它在总表中的真实排名
      const realRank = list.indexOf(item) + 1;
      const isMe = Boolean(myName && item.name.toLowerCase() === myName);

      let rankBadge = `<span class="rank-num">${realRank}</span>`;
      let rowClass = 'lb-row';
      if (realRank === 1) {
        rankBadge = `<span class="rank-medal gold">🥇 1</span>`;
        rowClass += ' rank-1';
      } else if (realRank === 2) {
        rankBadge = `<span class="rank-medal silver">🥈 2</span>`;
        rowClass += ' rank-2';
      } else if (realRank === 3) {
        rankBadge = `<span class="rank-medal bronze">🥉 3</span>`;
        rowClass += ' rank-3';
      }

      if (isMe) {
        rowClass += ' is-me';
      }

      rowsHtml += `
        <tr class="${rowClass}">
          <td style="text-align: center;">${rankBadge}</td>
          <td>
            <span class="pilot-callsign">${this.escapeHtml(item.name)}</span>
            ${isMe ? '<span class="you-tag">YOU</span>' : ''}
          </td>
          <td style="text-align: right; font-family: var(--font-display); font-weight: 700; color: #00ff88;">
            ${this.formatTime(item.time)}
          </td>
          <td style="text-align: right; color: var(--text-secondary); font-size: 13px;">
            ${this.formatDate(item.date)}
          </td>
        </tr>
      `;
    });

    this.listBodyEl.innerHTML = rowsHtml;

    // 若当前用户在榜中，自动平滑滚动让其可见
    if (myName && !query) {
      setTimeout(() => {
        const myRow = this.listBodyEl.querySelector('.is-me');
        if (myRow) {
          myRow.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }
      }, 100);
    }
  }

  updatePilotBadge() {
    if (!this.statusEl) return;
    const name = this.getPilotName();
    this.statusEl.textContent = name || '未登记';
    this.statusEl.style.color = name ? '#00f0ff' : '#8899aa';
  }

  // 快捷更换代号
  promptChangePilotName() {
    const current = this.getPilotName();
    const newName = window.prompt('请输入新的领航员代号 (1-16 字符):', current);
    if (newName !== null) {
      const clean = newName.trim();
      if (clean) {
        this.setPilotName(clean);
        this.updatePilotBadge();
        this.renderTable(this.cachedList, this.searchEl ? this.searchEl.value.trim() : '');
      }
    }
  }

  escapeHtml(str) {
    return String(str || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }
}

export const leaderboard = new LeaderboardManager();
