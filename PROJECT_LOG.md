# ImposterGameOnline.net — 项目进度与迭代记录

> 最后更新：2026-11-26  
> 项目定位：零下载、极速静态 HTML5 的欧美聚会推理小游戏大厅（SEO + GEO 自然流量 + AdSense 广告变现）

---

## 一、基础信息与线上地址
- **正式域名**：`https://impostergameonline.net/`（全新干净 `.net` 域名，Wayback 无黑历史）
- **Cloudflare Pages 临时域名**：`https://impostergameonline.pages.dev/`
- **GitHub 仓库**：`git@github.com:xuanxuyin/impostergameonline.git`（`main` 分支推送自动构建）
- **构建配置**：Build command `node build.mjs` ｜ Output directory `dist` ｜ 校验命令 `node check.mjs`
- **本地目录**：`d:\dev\impostergameonline`
- **流量统计**：PVUV（`data-site="gLYtLpxc"`，已全站接入并实测上报 `204`）

---

## 二、已锁定核心关键词与页面结构（上线后勿随意修改主标题）

| 页面路径 | 目标核心词（Semrush 美国数据） | 锁定 `<title>` |
| :--- | :--- | :--- |
| `/` | `imposter game` (201K / KD 36%) + `imposter game online` (14.8K / KD 23% / CPC $1.00) + `imposter word game` (5.4K / KD 29%) | `Imposter Game Online — Free Imposter Word Game (Play Now)` |
| `/imposter-game-words/` | `imposter game words` (1.9K / CPC $1.27) + `imposter words` (1.3K / KD 8%) + `imposter word generator` (880) | `Imposter Game Words — 200+ Free Imposter Words & Word Generator` |
| `/imposter-game-unblocked/` | `imposter game unblocked` (1.9K / KD 11%) | `Imposter Game Unblocked — Play Free Online at School` |
| `/question-imposter/` | `imposter questions` (110 / KD 2%) + `imposter question game` (90 / CPC $1.23) | `Imposter Question Game — Free Imposter Questions Online` |
| `/ranking-imposter/` | 差异化聚会留存玩法 | `Ranking Imposter Game — Free 1 to 10 Secret Scale Party Game` |
| `/daily-imposter/` | 每日打卡留存 + Wordle 式战绩分享 | `Daily Imposter Puzzle — Free Daily Deduction Game Online` |
| `/kids-edition/` & `/party-edition/` | 垂直家庭/聚会场景长尾词 | Kids Edition / Imposter Party Game |
| `/about/` `/privacy-policy/` `/terms-of-use/` `/contact/` | AdSense 合规必备页面 | 4 个完整合规页 |

---

## 三、已完成事项（v1.0 正式上线）
- [x] **选词与竞品拆解**：完成 `blockblastt.com` 与 `impostergames.io` 实测分析，锁定高量低 KD 的 `imposter game online` 赛道。
- [x] **域名与基础设施**：购买 `impostergameonline.net`，接入 Cloudflare DNS，配置 GitHub SSH 仓库与 Cloudflare Pages 自动构建，HTTPS 状态 `Active`。
- [x] **核心玩法开发（纯前端 0 后端成本）**：
  - **Word Imposter**：支持 `Solo vs AI Bots`（26 组智能线索/装懂词库，1 人可玩）+ `Pass & Play`（3–12 人、8 大主题 200 词、自定义词汇、3D 翻牌、倒计时、太空放逐动画、计分板、Web Audio 合成音效）。
  - **Question Imposter**：18 组错位问答卧底。
  - **Ranking Imposter**：14 组 1–10 秘密打分卧底。
  - **Daily Imposter Puzzle**：每日 UTC 刷新单人解谜 + 本地连胜 Streak + 一键复制分享战绩。
  - **Imposter Word Generator**：200 词随机生成器 + 分类目录。
- [x] **视觉与响应式打磨**：极简双层秘密卡牌矢量 `favicon.svg`、产品卡牌风 1200×630 `og-cover.png`、明暗主题切换、手机端 2 列网格导航与珊瑚红选中态、高对比度顶部标签。
- [x] **SEO & GEO 全家桶**：12 个预渲染静态页、256 条站内互链（0 死链）、8 块 JSON-LD（`WebApplication` / `FAQPage` / `BreadcrumbList`）、玩法对比表、`sitemap.xml`、`robots.txt`、`llms.txt`、`manifest.webmanifest`。
- [x] **统计与收录提交**：接入 PVUV 统计、提交 Google Search Console（网域验证 + Sitemap）、提交 Bing Webmaster Tools（全部 12 条 URL + Sitemap）。

---

## 四、接下来需要完成的事情（Roadmap）

### 阶段 1：收录与初期权重（未来 1–2 周）
- [ ] 在 Cloudflare Pages Custom Domains 顺手补绑 `www.impostergameonline.net`（可选，防手动输 `www.` 打不开）。
- [ ] 在 GSC 对首页 `/` 和 `/imposter-game-words/`、`/imposter-game-unblocked/` 手动点一次「请求编入索引」。
- [ ] 观察 7–14 天：通过 **GSC（曝光/点击词）** 和 **PVUV（真实访问）** 看哪些页面最先起量。
- [ ] 去几个免费海外游戏/工具导航站（如 itch.io 介绍页、AlternativeTo、Product Hunt / Indie Hackers 社区）留 3–5 条自然初始外链，加快谷歌出沙盒。

### 阶段 2（核心产品大升级 v2.0 — 优先级最高，对标 `imposter.app`）
- [x] **新增「Online 多人真联机模式」（Cloudflare Workers + Durable Objects WebSocket，免费额度起步）**：
  - 已实现 `worker/src/roomEngine.mjs` + `worker/src/index.mjs`（`RoomDO` + `LobbyDO`）+ `worker/wrangler.toml`，以及本地 `preview.mjs` 零依赖 WebSocket 联调服务。
  - **Private Room（私密房）**：房主一键创建生成 **6 位房间号** + 邀请链接（`impostergameonline.net/?room=XXXXXX`），服务端独立下发秘密身份卡（防 F12 偷看），支持回合制 1 词输入 + 实时匿名投票 + 太空放逐揭晓。
  - **Public Room（公共大厅）**：实时展示开放房间列表、叠加首字母头像与状态胶囊，附带房主一键 **「Add AI Bot 自动补位」**。
  - **首页与 UI v2.0 重构**：默认纯白 iOS 原生亮色 App 质感、聚焦单列手机优先布局、`Pass the phone` / `Play online` 双卡 + `Solo vs AI` 快捷入口、iOS 分组设置与子视图、原地展开输码与建房弹簧弹窗。
- [ ] **上线部署 Cloudflare Worker**：运行 `cd worker && npx wrangler deploy` 并绑定自定义域 `api.impostergameonline.net`（或在 `index.html` 中配置 `window.IMPOSTER_ONLINE_API`）。

### 阶段 3：内容与长尾矩阵扩张（第 3–4 周）
- [ ] **扩充词库**：从 200 词扩到 **600–1,000+ 词**（重点加欧美热搜词包：Anime、Minecraft、NBA/NFL、Disney、Food Brands、US States）。
- [ ] **新增高意图细分落地页**（根据 GSC 曝光词优先做）：
  - `/guides/how-to-play-imposter-game/`（图文攻略，模仿 `impostergames.io` 的 Guides 矩阵吃信息类长尾词）
  - 细分主题词库页（如 `/anime-imposter-words/`、`/funny-imposter-questions/`）。
- [ ] **扩充每日题库**：把 `DAILY_PUZZLES` 从 10 题扩到 60–100 题，避免老玩家两周后刷重。

### 阶段 4：更多玩法与变现（起量后）
- [ ] **新增「Drawing Imposter（画画卧底）」**：HTML5 Canvas 轮流添一笔玩法，极易在社媒传播。
- [ ] **申请 Google AdSense**：等日均自然访问稳定到 50–100+ UV、页面收录完整后提交审核（位置建议放在游戏框下方与攻略段落间，不遮挡游戏交互，保护留存）。

---

## 五、v2.0 美术风格与布局设计规范（深度对标 `imposter.app`）

### 1. 配色与视觉语言（iOS 原生亮色 App 质感）
- **主画布**：纯白 `#ffffff`（保留可选暗色切换，但默认切为干净亮色）。
- **主文字 / 辅助文字**：深藏蓝黑 `#00142f` / 中性灰 `#6a7280`。
- **品牌主色**：正红 `#ff0030`（顶部品牌圆角横幅，配黑白高对比剪影图标 + 白色粗体标题）。
- **交互强调色**：苹果蓝 `#007cff`（选中圆勾徽章、开关、链接、内联 Join 按钮、输入框聚焦描边）。
- **卡片与边框**：未选中卡片/输入框用浅冷灰 `#ecf0f3`，选中态切白底 + `1.5px solid #00142f`（或 `#dce2e6` 极细边框），大圆角 `16px–20px`，少阴影，重留白。
- **主行动按钮（CTA）**：纯黑 `#000000` 全圆角胶囊按钮（`border-radius: 99px`），按压微缩 `scale(0.97)`，弹窗使用弹簧曲线 `cubic-bezier(0.34, 1.56, 0.64, 1)`。
- **状态胶囊**：浅绿底 `#e7faea` + 深绿字 `#1f7a36`（`● Ready to start`）；浅橘底 + 琥珀字（`● Needs X players`）。

### 2. 布局与信息层级
- **桌面端也保持聚焦单列（约 `460px–520px` 居中）**：首屏零多余干扰，像直接打开一个原生手机 App；SEO 指南、玩法对比表、FAQ 全部收在首屏下方。
- **首屏模式双卡**：红色横幅下方直接并排 2 张大卡 —— **`Pass the phone`** vs **`Play online`**（选中态带右上角 `#007cff` 蓝色圆勾）。
- **iOS 设置风分组列表**：`Players`、`Imposters`、`Hints` 开关、`Categories`、`Timer` 分组呈现；点击 `Players` / `Categories` 原地切入子视图（带黑色圆形 `<` 返回键），不堆砌满屏表单。

### 3. Online 联机页交互规范
- **顶部双按钮**：全宽纯黑胶囊 **`+ Create Room`** + 全宽白底黑框胶囊 **`Join with a code`**。
- **原地变形输码**：点 `Join with a code` 后原地展开为圆角卡片 + `0 0 0 0 0 0` 宽距房间号输入框 + 内嵌蓝色 `Join` 按钮 + `Cancel`。
- **建房弹窗**：点 `+ Create Room` 弹出白底 `20px` 圆角弹窗，两张单选大卡（`Private Room` vs `Public Room`）+ 黑色 `Continue` 胶囊。
- **公共房间卡片**：显示 `#6位房号` + 房间名 + 蓝色 `Join` 胶囊 + 灰色主题/卧底数小标签 + 底部**彩色叠加首字母头像（白描边，超员折叠 `+N`）** + 状态胶囊 + 房主一键 `Add AI Bot` 补位。
