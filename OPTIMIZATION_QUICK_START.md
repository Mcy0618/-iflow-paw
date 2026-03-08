# 前端优化快速启动指南

## 概述

本次优化为 iflow-paw 项目添加了无障碍支持、加载体验优化和动画性能提升。以下是快速上手指南。

---

## 一、新组件使用

### 1.1 无障碍按钮组件

**基础使用**:
```tsx
import { AccessibleButton, AccessibleIconButton } from './components/common'

// 文本按钮
<AccessibleButton
  ariaLabel="发送消息"
  variant="primary"
  onClick={handleSend}
>
  发送
</AccessibleButton>

// 图标按钮
<AccessibleIconButton
  icon={<CopyIcon />}
  ariaLabel="复制内容"
  onClick={handleCopy}
  variant="ghost"
  size="sm"
/>
```

**高级特性**:
```tsx
<AccessibleButton
  ariaLabel="重新生成"
  ariaDescription="重新生成当前消息的内容"
  variant="secondary"
  size="md"
  loading={isRegenerating}
  shortcut="Ctrl+R"
  onClick={handleRegenerate}
>
  <ArrowPathIcon />
  重新生成
</AccessibleButton>
```

### 1.2 骨架屏组件

**基础使用**:
```tsx
import { Skeleton, MessageSkeleton, ChatSkeleton } from './components/common'

// 通用骨架
<Skeleton 
  variant="text" 
  width="100%" 
  height={16} 
  animation="pulse"
  count={3}
/>

// 消息骨架
<MessageSkeleton isUser={false} />

// 聊天骨架
<ChatSkeleton />
```

**在消息列表中使用**:
```tsx
{isLoading ? (
  <ChatSkeleton />
) : (
  messages.map(msg => <Message key={msg.id} message={msg} />)
)}
```

### 1.3 流式输出指示器

**基础使用**:
```tsx
import { StreamingCursor, StreamingIndicator, Typewriter } from './components/common'

// 光标指示器
<StreamingCursor size="md" visible={isStreaming} />

// 打字机指示器
<StreamingIndicator 
  type="typing" 
  text="正在生成..." 
  visible={isStreaming} 
/>

// 圆点指示器
<StreamingIndicator type="dots" visible={isStreaming} />

// 打字机效果
<Typewriter 
  text="Hello, World!" 
  speed={30}
  enabled={true}
  onComplete={() => console.log('完成')}
/>
```

**在消息组件中使用**:
```tsx
<div className="prose">
  {message.content}
  {isStreaming && <StreamingCursor size="md" />}
</div>
```

---

## 二、现有组件升级

### 2.1 使用无障碍消息组件

**替换现有消息组件**:
```tsx
// 原来的导入
// import { Message } from './components/Message'

// 新的导入
import { MessageWithA11y as Message } from './components/Message'

<Message
  message={message}
  isLast={isLast}
  sessionId={sessionId}
  onDelete={handleDelete}
  onRegenerate={handleRegenerate}
  onCopy={handleCopy}
/>
```

### 2.2 改进空状态

**使用智能推荐系统**:
```tsx
import { useRecommendations } from './hooks/useRecommendations'

const { recommendedActions } = useRecommendations()

<div className="mt-10 w-full max-w-lg">
  <p className="text-sm text-slate-400 mb-4 font-medium">试试这些提示：</p>
  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
    {recommendedActions.map((action, index) => (
      <button
        key={index}
        onClick={() => fillInput(action)}
        aria-label={`使用提示：${action}`}
      >
        💡 {action}
      </button>
    ))}
  </div>
</div>
```

---

## 三、CSS动画使用

### 3.1 基础动画类

```tsx
// 淡入
<div className="animate-fade-in">内容</div>

// 滑入
<div className="animate-slide-up">内容</div>

// 缩放
<div className="animate-scale-in">内容</div>

// 脉冲
<div className="animate-pulse">内容</div>

// 闪光
<div className="animate-shimmer">内容</div>

// 悬浮
<div className="animate-float">内容</div>
```

### 3.2 自定义动画延迟

```tsx
<div 
  className="animate-slide-up"
  style={{ animationDelay: '0.1s' }}
>
  第1个元素
</div>
<div 
  className="animate-slide-up"
  style={{ animationDelay: '0.2s' }}
>
  第2个元素
</div>
```

### 3.3 性能优化

```tsx
// 使用硬件加速
<div className="animate-slide-up hardware-accelerated">
  内容
</div>

// 响应式动画
<div className="animate-fade-in responsive-animation">
  内容
</div>
```

---

## 四、无障碍功能

### 4.1 键盘导航

**支持的快捷键**:
- `Tab`: 焦点移动
- `Shift+Tab`: 反向焦点移动
- `Enter` / `Space`: 激活按钮
- `Esc`: 关闭/取消
- `Ctrl+N`: 新建会话
- `Ctrl+Shift+N`: 新建会话（无工作区）
- `Ctrl+Shift+C`: 复制最后一条AI回复
- `Esc`: 取消流式响应

### 4.2 屏幕阅读器支持

**ARIA标签示例**:
```tsx
// 消息
<div 
  role="article"
  aria-label="用户消息"
  aria-live="polite"
>
  消息内容
</div>

// 按钮
<button
  aria-label="复制内容"
  aria-describedby="copy-desc"
>
  <CopyIcon />
</button>
<span id="copy-desc" className="sr-only">
  将消息内容复制到剪贴板
</span>

// 加载状态
<div
  role="status"
  aria-label="加载中"
  aria-busy="true"
>
  <Skeleton />
</div>
```

### 4.3 跳过导航

**添加跳过链接**:
```tsx
<a
  href="#main-content"
  className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-50"
>
  跳转到主内容
</a>

<main id="main-content" tabIndex={-1}>
  主内容
</main>
```

---

## 五、最佳实践

### 5.1 性能优化

**使用React.memo**:
```tsx
export const MyComponent = React.memo(({ data }) => {
  return <div>{data}</div>
})
```

**使用useMemo和useCallback**:
```tsx
const expensiveValue = useMemo(() => {
  return computeExpensiveValue(data)
}, [data])

const handleClick = useCallback(() => {
  console.log('clicked')
}, [])
```

**虚拟列表**:
```tsx
import { useVirtualizer } from '@tanstack/react-virtual'

const virtualizer = useVirtualizer({
  count: items.length,
  getScrollElement: () => containerRef.current,
  estimateSize: () => 120,
  overscan: 5,
})
```

### 5.2 无障碍最佳实践

**提供清晰的标签**:
```tsx
// ❌ 不好
<button onClick={handleCopy}>
  <CopyIcon />
</button>

// ✅ 好
<button 
  onClick={handleCopy}
  aria-label="复制内容"
>
  <CopyIcon />
</button>
```

**使用语义化HTML**:
```tsx
// ❌ 不好
<div onClick={handleClick}>按钮</div>

// ✅ 好
<button onClick={handleClick}>按钮</button>
```

**提供焦点管理**:
```tsx
// 模态框打开时聚焦
useEffect(() => {
  if (isOpen) {
    modalRef.current?.focus()
  }
}, [isOpen])
```

### 5.3 动画最佳实践

**使用CSS动画**:
```tsx
// ❌ 不好 - JavaScript动画
const [scale, setScale] = useState(1)
useEffect(() => {
  const interval = setInterval(() => {
    setScale(prev => prev === 1 ? 1.1 : 1)
  }, 1000)
  return () => clearInterval(interval)
}, [])

// ✅ 好 - CSS动画
<div className="animate-pulse">内容</div>
```

**使用transform和opacity**:
```tsx
// ❌ 不好 - 触发布局变化
<div style={{ top: y }} />

// ✅ 好 - 不触发布局变化
<div style={{ transform: `translateY(${y}px)` }} />
```

---

## 六、故障排除

### 6.1 动画不生效

**问题**: CSS动画没有显示

**解决方案**:
1. 确保导入了动画CSS：
```tsx
// styles/index.css
@import './animations.css'
```

2. 检查类名是否正确：
```tsx
<div className="animate-fade-in"> // 正确
<div className="animate fade-in"> // 错误
```

3. 检查浏览器兼容性

### 6.2 无障碍功能不工作

**问题**: 屏幕阅读器无法读取内容

**解决方案**:
1. 检查ARIA标签是否正确：
```tsx
<div aria-label="描述">内容</div>
```

2. 确保使用语义化HTML：
```tsx
<button>按钮</button> // 而不是 <div>按钮</div>
```

3. 测试键盘导航

### 6.3 性能问题

**问题**: 页面卡顿

**解决方案**:
1. 使用React.memo避免不必要的重渲染
2. 使用虚拟列表处理长列表
3. 优化动画（使用GPU加速）
4. 检查是否有内存泄漏

---

## 七、浏览器兼容性

### 7.1 支持的浏览器

- Chrome/Edge: 90+
- Firefox: 88+
- Safari: 14+
- 移动浏览器: iOS 14+, Android 10+

### 7.2 Polyfills

如果需要支持旧浏览器，添加以下polyfills：

```bash
npm install core-js
```

```tsx
// index.tsx
import 'core-js/stable'
import 'regenerator-runtime/runtime'
```

---

## 八、测试清单

### 8.1 功能测试

- [ ] 所有按钮都可以点击
- [ ] 键盘导航正常工作
- [ ] 骨架屏正确显示
- [ ] 流式输出光标正常闪烁
- [ ] 动画流畅播放

### 8.2 无障碍测试

- [ ] 屏幕阅读器可以读取所有内容
- [ ] 键盘可以访问所有交互元素
- [ ] 焦点指示器清晰可见
- [ ] ARIA标签正确显示

### 8.3 性能测试

- [ ] 页面加载时间 < 2秒
- [ ] 动画帧率 > 60fps
- [ ] 内存占用 < 100MB
- [ ] CPU使用率 < 30%

---

## 九、资源链接

- [完整实施报告](./FRONTEND_OPTIMIZATION_IMPLEMENTATION.md)
- [WCAG 2.1 指南](https://www.w3.org/WAI/WCAG21/quickref/)
- [ARIA 实践指南](https://www.w3.org/WAI/ARIA/apg/)
- [Web 动画性能](https://web.dev/animations-guide/)
- [React 无障碍最佳实践](https://react.dev/learn/accessibility)

---

## 十、获取帮助

如果遇到问题：

1. 查看完整实施报告
2. 检查浏览器控制台错误
3. 测试无障碍功能
4. 检查性能指标

---

**最后更新**: 2026-03-08
**版本**: 1.0.0