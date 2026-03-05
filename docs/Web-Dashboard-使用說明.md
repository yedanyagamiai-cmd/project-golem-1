# 🖥️ Project Golem Web Dashboard 使用說明

> 最後更新：2026-03-04  
> Dashboard 技術棧：Next.js (Static Export) + Tailwind CSS + Socket.IO

## 一、啟動方式

```bash
# 開發模式 (含熱更新)
cd web-dashboard
npm run dev        # 預設：http://localhost:3000

# 生產模式 (靜態匯出)
npm run build
# 由 project root 的 server.js 提供服務
node server.js     # 預設：http://localhost:3000
```

> Dashboard 與主 Bot (`index.js`) 是**獨立進程**，可分別啟動。Dashboard 透過 Socket.IO 與 Bot 即時通訊。

---

## 二、頁面功能說明

### 🎛️ 戰術控制台 (`/dashboard`)

首頁概覽，呈現：
- 目前 Active Golem 的狀態
- 動態情境圖像（依使用技能/多代理場景切換）
- 快速操作入口

---

### 💻 終端機控制台 (`/dashboard/terminal`)

**直接向 Golem 傳送訊息並觀察即時回應**，等同於管理員頻道的 Terminal 介面。

功能：
- 即時對話輸入
- 顯示 Golem 完整輸出（含 Action 執行記錄）
- 支援 Golem 切換

---

### 📚 技能說明書 (`/dashboard/skills`)

技能管理中心：

| 功能 | 說明 |
|------|------|
| 列出所有技能 | 顯示 CORE / USER 技能及描述 |
| 開關技能 | 啟用/停用特定技能 |
| 注入技能書 | 重新將技能書注入 Gemini（相當於 `/reload`） |
| 匯出/匯入膠囊 | 透過 `GOLEM_SKILL::` 字串分享技能 |

---

### 👥 Agent 會議室 (`/dashboard/agents`)

**InteractiveMultiAgent 系統的視覺化介面**。

功能：
- 設定參與協作的 Agent 列表（名稱/角色/個性）
- 設定最大討論輪次
- 啟動多代理圓桌討論
- 即時顯示每個 Agent 的發言與共識摘要

---

### 🏢 辦公室模式 (`/dashboard/office`)

模擬多 Golem 協作的**辦公室場景**，每個 Golem 扮演不同職能角色（研究員、編輯、評審等），以接力方式完成複雜任務。

---

### 🧠 記憶核心 (`/dashboard/memory`)

向量記憶庫的管理介面：

| 功能 | 說明 |
|------|------|
| 瀏覽記憶 | 列出所有已存入的長期記憶條目 |
| 搜尋召回 | 輸入關鍵字測試語意搜尋 |
| 刪除記憶 | 移除特定記憶條目 |
| 清空重置 | 清除全部向量記憶 |

---

### ⚙️ 系統總表 (`/dashboard/settings`)

系統設定與狀態監控：

| 功能 | 說明 |
|------|------|
| Golem 清單 | 顯示所有 Golem 實例及運行狀態 |
| 環境變數管理 | 查看/修改 `.env` 設定 |
| 日誌管理 | 觸發日誌壓縮、查看壓縮歷史 |
| 系統升級 | 觸發 GitHub 熱更新 |

---

## 三、Golem Switcher

左側側欄頂部有一個 **Active Golem 下拉選單**，所有操作（終端機、記憶查詢、技能管理）均針對當前選擇的 Golem 實例。

```
左側欄
 ┌─────────────────┐
 │ Active Golem    │
 │ [golem_A  ▼]   │  ← 切換後，所有頁面的操作對象改變
 ├─────────────────┤
 │ 戰術控制台       │
 │ 終端機控制台     │
 │ ...             │
 └─────────────────┘
```

---

## 四、Setup 流程 (`/dashboard/setup`)

首次使用或 Golem 未初始化時，會自動導向 Setup 頁面：

1. 輸入 Telegram Bot Token
2. 輸入管理員 ID
3. 選擇運行模式（SINGLE / MULTI）
4. 確認 → 寫入 `.env` → 重啟 Bot

> 若 `activeGolemStatus === 'pending_setup'`，系統會自動重導向至 `/dashboard/setup`。

---

## 五、後端 API (server.js)

Dashboard 後端由 `web-dashboard/server.js` 提供，主要功能：

| 路由 | 說明 |
|------|------|
| `GET /api/golems` | 取得 Golem 列表 |
| `GET /api/status/:id` | 取得指定 Golem 狀態 |
| `POST /api/message` | 向 Golem 傳送訊息 |
| `GET /api/memory/:id` | 讀取記憶清單 |
| `POST /api/skills/reload` | 重新注入技能書 |
| `Socket.IO` | 即時推送 Golem 回應與系統事件 |

---

## 六、Multi-Agent 會議室運作流程

```
用戶設定：
  任務描述、Agent 名稱/角色、最大輪次
       ↓
InteractiveMultiAgent.startConversation()
       ↓
  Round 1: Agent A 發言 → Agent B 發言 → Agent C 發言
  Round 2: 各 Agent 回應彼此 + 用戶可插話 (@ 標記)
  ...
  早期共識偵測 → 提前結束討論
       ↓
_generateSummary() → 產生最終共識摘要傳回用戶
```

**用戶介入**：在任何輪次用戶都可以發言，透過 `@AgentName` 點名特定 Agent 回應，或發送全體廣播。
