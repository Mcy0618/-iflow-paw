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

- **框架**：Electron + React + TypeScript
- **构建工具**：Vite (electron-vite)
- **UI 方案**：Headless UI + Tailwind CSS
- **状态管理**：Zustand
- **Markdown**：react-markdown + remark-gfm
- **代码高亮**：react-syntax-highlighter

## 📁 目录结构

```
iflow-paw/
├── src/
│   ├── main/              # Electron 主进程
│   │   ├── acp/           # ACP 通信层
│   │   ├── store/         # 数据存储
│   │   └── ipc/           # IPC 通信
│   ├── renderer/          # 渲染进程 (React)
│   │   ├── components/    # UI 组件
│   │   ├── hooks/         # 自定义 Hooks
│   │   └── styles/        # 样式文件
│   └── preload/           # 预加载脚本
├── sessions/              # 会话数据 (JSON)
├── assets/                # 静态资源
└── AGENT.md               # 本文件
```

## 🔄 开发工作流

### Phase 1: 基础框架
SubAgent 1: 初始化 Electron + Vite 项目结构
SubAgent 2: 配置 Tailwind CSS 和基础 UI

### Phase 2: ACP 层
SubAgent 1: 实现 ACP 连接管理和 JSON-RPC 协议
SubAgent 2: 实现会话存储和恢复机制

### Phase 3: UI 实现
SubAgent 1: 开发 Sidebar 和 ChatArea 组件
SubAgent 2: 开发 InputBox 和 Message 组件

### Phase 4: 集成测试
SubAgent 1: 集成测试和 bug 修复
SubAgent 2: UI 美化和 iFlow 主题适配

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
- [ ] ACP 协议通信（JSON-RPC 2.0）
- [ ] 会话管理（JSON 文件存储，自动恢复）
- [ ] 模型选择（9个模型）
- [ ] 模式切换（YOLO/Plan/Smart/Ask）
- [ ] 深度思考开关
- [ ] 工作区选择

### 支持模型
- GLM-4.7 (推荐)
- iFlow-ROME-30BA3B (预览版)
- DeepSeek-V3.2
- GLM-5
- Qwen3-Coder-Plus
- Kimi-K2-Thinking
- MiniMax-M2.5
- Kimi-K2.5
- Kimi-K2-0905

### 支持模式
- **YOLO** - 自动执行，无需确认
- **Plan** - 先制定计划，用户审批后执行
- **Smart** - 智能判断
- **Ask** - 每个操作都询问用户

## ⚠️ 约束条件
- 每次最多启动 2 个 subagent
- 必须遵循 iflow 工作区的长期协作模式
- 必须支持浅色系主题（iFlow 风格）
- 会话数据使用 JSON 文件存储
- 应用重启后会话自动恢复
