# 📚 Project Golem 文件索引

> 本目錄包含 Project Golem 的所有技術與使用文件。

---

## 🗂️ 文件清單

| 文件 | 說明 | 適合對象 |
|------|------|---------|
| [系統架構說明](./系統架構說明.md) | 整體架構、訊息流、核心元件、協議格式 | 開發者 |
| [開發者實作指南](./開發者實作指南.md) | 新增技能、Golem Protocol 格式、FAQ | 開發者 |
| [記憶系統架構說明](./記憶系統架構說明.md) | 金字塔記憶壓縮、Single/Multi 路徑、向量記憶 | 開發者 |
| [Web Dashboard 使用說明](./Web-Dashboard-使用說明.md) | 7 個頁面功能、多代理會議室、API 路由 | 使用者/開發者 |
| [golem 指令說明一覽表](./golem指令說明一覽表.md) | 所有 `/command` 指令速查 | 使用者 |
| [如何獲取 TG/DC Token](./如何獲取TG或DC的Token及開啟權限.md) | 取得 Bot Token 的步驟說明 | 使用者 |
| [README (繁中)](./README_ZH.md) | 專案介紹 | 所有人 |
| [README (EN)](./README_EN.md) | 專案介紹（英文版） | 所有人 |

---

## 🏗️ 架構速覽

```
Telegram / Discord
      ↓
UniversalContext         平台抽象層
      ↓
ConversationManager      防抖隊列 (1.5s)
      ↓
GolemBrain               Web Gemini 大腦
      ↓
NeuroShunter             回應分流中樞
      ↓
reply / skills / memory  執行層
```

> 詳細架構請見 [系統架構說明](./系統架構說明.md)

---

## 🧠 記憶金字塔速覽

```
Tier 0  hourly    72h → 壓縮  ↓
Tier 1  daily     90d → 壓縮  ↓
Tier 2  monthly   5yr → 壓縮  ↓
Tier 3  yearly    永久保留     ↓
Tier 4  era       永久保留
```

> 詳細說明請見 [記憶系統架構說明](./記憶系統架構說明.md)

---

## ⚡ 快速啟動

```bash
# 1. 複製 .env.example → .env 並填入 Token
cp .env.example .env

# 2. 安裝依賴
npm install

# 3. 啟動 Bot
node index.js

# 4. 啟動 Dashboard (選用)
cd web-dashboard && npm run dev
```

---

## 📝 文件更新記錄

| 日期 | 更新內容 |
|------|---------|
| 2026-03-04 | 初版文件建立（架構、記憶系統、開發指南、Dashboard 說明） |
| 2026-03-04 | 記憶系統補充 Single/Multi 模式路徑適配說明 |
