# AGENT.md - iflow paw 长期协作者系统

## 🎯 项目定位
iflow paw 是一个基于 ACP 协议的 Electron 桌面应用，为 iflow CLI 提供直观的 GUI 交互界面。

## 🧠 长期协作特点（继承 @oh-my-iflow）

### 1. 多智能体工作流
本项目采用与 oh-my-iflow 类似的多智能体协作模式：

```
需求分析 (Architect) → 任务规划 (Planner) → 代码实现 (Executor) 
                                                        ↓
            ← 代码审查 (Reviewer) ← 测试验证 (Verifier) ←
```

### 2. SubAgent 调用规范
- **并发限制**：最多 2 个 subagent 同时运行
- **典型分工**：
  - Frontend SubAgent：负责渲染进程 UI 组件开发
  - Backend SubAgent：负责主进程 ACP 通信逻辑
  - Review SubAgent：负责代码审查（单独调用）

### 3. 记忆管理
遵循 iflow 工作区的记忆管理模式：
- `.iflow/paw/memory/` - 项目记忆目录
- `user_profile.md` - 用户偏好与技术栈
- `session_summaries/` - 每次会话摘要

## 🏗️ 技术栈

- **框架**：Electron 28 + React 18 + TypeScript 5
- **构建工具**：Vite 5 (electron-vite 2)
- **UI 方案**：Headless UI 1.7 + Heroicons 2 + Tailwind CSS 3.4
- **状态管理**：Zustand 4.4
- **Markdown**：react-markdown 9 + remark-gfm 4 + react-syntax-highlighter 15
- **通信**：WebSocket (ws 8) + Electron IPC
- **工具库**：Electron Toolkit Utils 3 + UUID 9

## 📁 目录结构

```
iflow-paw/
├── src/
│   ├── main/                    # Electron 主进程
│   │   ├── acp/                # ACP 通信层 (connection.ts, types.ts)
│   │   ├── ipc/                # IPC 通信 (handlers.ts)
│   │   ├── store/              # 数据存储 (sessions.ts)
│   │   └── index.ts            # 主进程入口
│   ├── renderer/                # 渲染进程 (React)
│   │   ├── components/         # UI 组件
│   │   │   ├── ChatArea/       # 聊天区域组件
│   │   │   ├── InputBox/       # 输入框组件
│   │   │   ├── Message/        # 消息组件
│   │   │   └── Sidebar/        # 侧边栏组件 (含 utils.ts)
│   │   ├── hooks/              # 自定义 Hooks
│   │   │   ├── useAcp.ts      # ACP 连接 Hook
│   │   │   └── useSessions.ts # 会话管理 Hook
│   │   ├── store/              # 状态管理
│   │   │   └── useAppStore.ts # Zustand store
│   │   ├── styles/             # 样式文件
│   │   │   └── index.css      # Tailwind 入口
│   │   ├── types/              # 类型定义
│   │   │   └── electron.d.ts    # Electron 类型
│   │   ├── App.tsx             # 主应用组件
│   │   ├── index.html          # HTML 入口
│   │   └── index.tsx          # React 入口
│   └── preload/                 # 预加载脚本
│       └── index.ts            # 预加载入口
├── out/                        # 构建输出目录
├── electron.vite.config.ts    # Vite 配置
├── tailwind.config.js         # Tailwind 配置
├── postcss.config.mjs         # PostCSS 配置
├── tsconfig.json              # TypeScript 配置
├── tsconfig.node.json         # Node TypeScript 配置
└── AGENT.md                   # 本文件
```

## 🔄 开发工作流

### 构建命令
```bash
npm run dev          # 开发模式 (热重载)
npm run build        # 生产构建
npm run preview      # 预览构建结果
npm run postinstall  # 安装 Electron 依赖 (自动运行)
```

### 开发流程
1. 运行 `npm run dev` 启动开发服务器
2. 修改代码后会自动热重载
3. 使用 `npm run build` 进行生产构建
4. 构建产物输出到 `out/` 目录

## 🎨 UI 主题规范

```css
/* iflow paw 主题色 */
:root {
  /* 主色 - iFlow 紫色 */
  --color-primary: #6366F1;
  --color-primary-light: #818CF8;
  --color-primary-dark: #4F46E5;
  
  /* 背景 - 浅色系 */
  --bg-primary: #FFFFFF;
  --bg-secondary: #F9FAFB;
  --bg-tertiary: #F3F4F6;
  
  /* 文字 */
  --text-primary: #111827;
  --text-secondary: #6B7280;
  --text-muted: #9CA3AF;
  
  /* 消息气泡 */
  --user-bubble: #EEF2FF;        /* 浅紫色 */
  --ai-bubble: #FFFFFF;          /* 白色 */
  --bubble-border: #E5E7EB;
}
```

## ✅ 功能清单

### 核心功能
- [x] ACP 协议通信（JSON-RPC 2.0）
- [x] 会话管理（JSON 文件存储，自动恢复）
- [x] 模型选择（9个模型）
- [x] 模式切换（YOLO/Plan/Smart/Ask）
- [x] 深度思考开关（支持多级别）
- [x] 工作区选择
- [x] 实时消息流（流式响应）
- [x] Markdown 渲染支持
- [x] 代码高亮显示

### 支持模型
| 模型 ID | 模型名称 | 状态 |
|---------|----------|------|
| glm-4.7 | GLM-4.7 | 推荐 |
| iflow-rome-30ba3b | iFlow-ROME-30BA3B | 预览版 |
| deepseek-v3.2 | DeepSeek-V3.2 | 支持 |
| glm-5 | GLM-5 | 支持 |
| qwen3-coder-plus | Qwen3-Coder-Plus | 支持 |
| kimi-k2-thinking | Kimi-K2-Thinking | 支持 |
| minimax-m2.5 | MiniMax-M2.5 | 支持 |
| kimi-k2.5 | Kimi-K2.5 | 支持 |
| kimi-k2-0905 | Kimi-K2-0905 | 支持 |

### 支持模式
| 模式 | 说明 |
|------|------|
| **YOLO** | 自动执行，无需确认 |
| **Plan** | 先制定计划，用户审批后执行 |
| **Smart** | 智能判断（默认） |
| **Ask** | 每个操作都询问用户 |

### 深度思考
- 支持开关控制
- 支持多级别调整（level 1-5）
- 与模型能力自动适配

## ⚠️ 约束条件
- 每次最多启动 2 个 subagent
- 必须遵循 iflow 工作区的长期协作模式
- 必须支持浅色系主题（iFlow 风格）
- 会话数据使用 JSON 文件存储（src/main/store/sessions.ts）
- 应用重启后会话自动恢复
- ACP 协议基于 JSON-RPC 2.0
- 使用 WebSocket 进行实时通信
- 主进程使用 IPC 与渲染进程通信

---

## 📋 实施计划

> **更新日期**: 2026-03-06
> **状态**: 进行中

### 技术决策

| 决策项 | 选择 | 理由 |
|-------|------|------|
| SDK方案 | TypeScript SDK + ACP降级 | 统一技术栈，稳定性优先 |
| API扩展 | OpenAI 兼容 Provider | 支持多供应商，易于扩展 |
| UI方案 | 深色模式 + 科技感动效 | 用户体验提升 |

---

### Phase 1: SDK 集成与适配层

**目标**: 引入 `@iflow-ai/iflow-cli-sdk`，保留 ACP 作为降级机制

| 状态 | 任务 | 文件 |
|-----|------|------|
| ⬜ | 创建 IConnection 统一接口 | `src/main/acp/interface.ts` |
| ⬜ | 创建 SDK 客户端实现 | `src/main/acp/sdkClient.ts` |
| ⬜ | 创建连接工厂（配置切换） | `src/main/acp/connectionFactory.ts` |
| ⬜ | 修改 IPC handlers 使用工厂 | `src/main/ipc/handlers.ts` |

**验收标准**:
- [ ] SDK 模式下 model/deepThinking 能同步到服务器
- [ ] 配置可切换 SDK/ACP 模式
- [ ] SDK 失败时自动降级

---

### Phase 2: 进程管理优化

**目标**: 解决 Windows 内存爆满问题

| 状态 | 任务 | 说明 |
|-----|------|------|
| ⬜ | SDK 模式进程管理 | 利用 SDK 自动管理 |
| ⬜ | ACP 模式进程优化 | 优化现有 taskkill 逻辑 |
| ⬜ | 添加进程监控 | 内存使用监控 + 自动重连 |

---

### Phase 3: OpenAI 兼容 API Provider

**目标**: 支持多模型供应商（OpenAI、DeepSeek、Moonshot 等）

| 状态 | 任务 | 文件 |
|-----|------|------|
| ⬜ | Provider 类型定义 | `src/main/providers/types.ts` |
| ⬜ | OpenAI 兼容 Provider | `src/main/providers/openai-provider.ts` |
| ⬜ | Provider 管理器 | `src/main/providers/provider-manager.ts` |
| ⬜ | 扩展 types.ts | 添加 Provider 类型 |
| ⬜ | 扩展 useAppStore | 添加 providers 状态 |
| ⬜ | 创建设置页面 | `src/renderer/components/Settings/` |
| ⬜ | 添加 openai 依赖 | `package.json` |

**预设供应商**:
- iFlow (内置)
- OpenAI (`https://api.openai.com/v1`)
- DeepSeek (`https://api.deepseek.com/v1`)
- Moonshot (`https://api.moonshot.cn/v1`)
- 自定义 (用户配置 API Key + Base URL)

---

### Phase 4: 前端 UI 重构

**目标**: 深色模式 + 科技感动态效果

| 状态 | 任务 | 文件 |
|-----|------|------|
| ⬜ | 添加 theme 状态 | `src/renderer/store/useAppStore.ts` |
| ⬜ | 主题切换逻辑 | `src/renderer/App.tsx` |
| ⬜ | 动态背景组件 | `src/renderer/components/Background/` |
| ⬜ | Logo 呼吸光效 | `src/renderer/components/Logo/` |
| ⬜ | 消息边框光效 | `src/renderer/components/Message/` |
| ⬜ | 深色模式配色 | `tailwind.config.js` |

---

### Phase 5: 测试与验证

| 状态 | 任务 |
|-----|------|
| ⬜ | 功能测试：双模式 IPC 接口正常 |
| ⬜ | 降级测试：SDK 失败时自动切换 |
| ⬜ | 内存测试：连续运行 4 小时无泄漏 |
| ⬜ | 跨平台验证：Windows 10/11 兼容 |

---

### 执行策略

使用 **最多 2 个 subagent** 并行处理：
1. **Backend Agent**: SDK集成 + 进程管理 + Provider实现
2. **Frontend Agent**: UI重构 + 深色模式 + 设置页面
3. **Review Agent**: 代码审查 + 测试验证（单独调用）
