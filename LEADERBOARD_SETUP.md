# 🏆 Doppler Strike 全服极速榜 (Cloudflare KV) 配置指引

本项目已全面集成基于 **Cloudflare KV** 的全服前 1000 名极速挑战排行榜（Speedrun Leaderboard）。

---

## ⚡ 极速部署方案 A：Cloudflare Pages 零配置集成（极力推荐）

由于当前项目已部署在 **Cloudflare Pages**，代码库中已内置 `/functions/api/leaderboard.js`。你只需要在 Cloudflare 控制台绑定一次 KV 即可：

### 步骤 1：创建 KV 命名空间
1. 登录 [Cloudflare 控制台](https://dash.cloudflare.com/)；
2. 在左侧菜单点击 **Workers & Pages** -> **KV**；
3. 点击 **创建命名空间 (Create a namespace)**；
4. 命名为 `doppler-kv`（或任意你喜欢的名字），点击 **添加 (Add)**。

### 步骤 2：在 Pages 项目中绑定 `GAME_KV`
1. 在左侧菜单进入 **Workers & Pages** -> 找到你的 Pages 项目 `doppler-axe`；
2. 点击顶部的 **设置 (Settings)** -> 选择 **函数 (Functions)**；
3. 向下滚动找到 **KV 命名空间绑定 (KV namespace bindings)** -> 点击 **添加绑定 (Add binding)**；
4. 填写配置：
   - **变量名称 (Variable name)**：必须填 `GAME_KV`（大写）
   - **KV 命名空间 (KV namespace)**：选择刚刚在步骤 1 创建的命名空间（如 `doppler-kv`）
5. 点击 **保存 (Save)**。
6. 在 **部署 (Deployments)** 页面触发一次重新部署（或者直接推送代码到 GitHub），绑定即刻生效！

> ✅ **生效效果**：无需配置额外域名，前端会自动请求同源的 `/api/leaderboard`，完全无跨域问题！

---

## 🌐 方案 B：独立 Cloudflare Worker 部署（可选）

如果你想把排行榜部署为独立的 Cloudflare Worker：

1. 打开 Cloudflare 控制台 -> **Workers & Pages** -> **创建应用程序 (Create Application)** -> **创建 Worker**；
2. 将项目中的 [`worker/leaderboard-worker.js`](file:///Users/feng/Desktop/项目/web项目/doppler/worker/leaderboard-worker.js) 完整代码复制粘贴到 Worker 在线编辑器中，点击 **部署 (Deploy)**；
3. 进入该 Worker 的 **Settings** -> **Variables and Secrets** -> **KV Namespace Bindings**：
   - 添加变量名 `GAME_KV`，绑定到你的 KV 命名空间；
4. 如果绑定了自定义 Worker 域名，在前端全局注入即可：
   ```html
   <script>
     window.LEADERBOARD_API_URL = "https://你的worker.workers.dev";
   </script>
   ```

---

## 🎮 玩家体验机制说明

1. **首次击破第二关（终极泰坦）**：
   - 结算弹窗提示输入 **领航员代号（Nickname）**；
   - 输入代号并按下回车或点击确认后，成绩立即上传至云端 KV，并实时计算返回全服名次（例如 `RANK #1`）；
   - 代号自动保存在本地，方便后续无感流转。

2. **后续通关**：
   - 自动携带已登记的代号静默提交成绩，自动刷新全服排名；
   - 同名玩家只保留**个人历史最优用时**（更快的成绩会自动覆盖刷新，较慢的成绩不会冲掉你的最高记录）；
   - 结算界面提供 `[ ✎ 更换代号 ]` 按钮，玩家可随时修改代号。

3. **查看前 1000 名**：
   - 游戏顶部 HUD 栏常驻 `[ 🏆 极速榜 ]` 按钮，随时可点击查看；
   - 通关结算卡片提供 `[ 🏆 查看全服 TOP 1000 极速榜 ]` 按钮；
   - 排行榜支持实时按代号快速搜索过滤，前三名带有金银铜奖牌标，当前玩家记录带有青色高亮及 `[ YOU ]` 标识。
