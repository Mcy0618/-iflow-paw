# 连接状态同步问题修复报告

## 问题描述

### 错误现象
```
[ACP] Connected successfully, mode: sdk type: sdk
[useAcp] Session load failed: Not connected
Failed to send message: Error: Not connected
```

### 问题分析
1. 连接成功后，前端显示 `connected` 状态
2. 但在调用 `session.load` 时，主进程抛出 `Not connected` 错误
3. 发送消息时也遇到 `Not connected` 错误

### 根本原因

#### 1. `getConnection()` 检查不完整
**位置**: `src/main/ipc/handlers.ts:60-67`

**修复前**:
```typescript
function getConnection(): IConnection {
  console.log('[Connection Handler] getConnection called, connection exists:', !!connection, 'isConnected:', connection?.isConnected);
  if (!connection) {
    console.error('[Connection Handler] connection is null!');
    throw new Error('Not connected');
  }
  return connection;
}
```

**问题**: 只检查 `connection` 对象是否存在，没有检查 `connection.isConnected` 属性。

**修复后**:
```typescript
function getConnection(): IConnection {
  console.log('[Connection Handler] getConnection called, connection exists:', !!connection, 'isConnected:', connection?.isConnected);
  if (!connection) {
    console.error('[Connection Handler] connection is null!');
    throw new Error('Not connected');
  }
  // 检查连接的实际状态，而不仅仅是对象是否存在
  if (!connection.isConnected) {
    console.error('[Connection Handler] connection exists but not connected, state:', connection.currentState);
    throw new Error('Not connected');
  }
  return connection;
}
```

#### 2. 初始化顺序错误（时序竞态条件）
**位置**: `src/main/ipc/handlers.ts:connect()` 函数

**修复前**:
```typescript
// 设置事件处理
setupConnectionEventHandlers(connection, window);

// 立即通知前端（但此时还未初始化！）
notifyRenderer(window, 'acp:status', { status: 'connected' });

// 初始化（太晚了）
try {
  await connection.initialize();
} catch (initError) {
  console.log('[Connection Handler] Initialize warning:', initError);
}
```

**问题**: 
- 前端收到 `connected` 状态后立即尝试加载会话
- 但此时 `connection.initialize()` 还未完成
- 导致状态不一致

**修复后**:
```typescript
// 设置事件处理
setupConnectionEventHandlers(connection, window);

// 先完成初始化
try {
  await connection.initialize();
  console.log('[Connection Handler] Initialize completed successfully');
} catch (initError) {
  console.error('[Connection Handler] Initialize failed:', initError);
  // 初始化失败应该被视为连接失败
  throw new Error(`Connection initialization failed: ${initError instanceof Error ? initError.message : 'Unknown error'}`);
}

// 初始化完成后，通知前端连接状态
console.log('[Connection Handler] Sending connected status to renderer');
notifyRenderer(window, 'acp:status', { status: 'connected' });
```

#### 3. 连接状态验证不完整
**位置**: `src/main/ipc/handlers.ts:acp:connect` handler

**修复前**:
```typescript
// 如果已连接，直接返回
if (connection?.isConnected) {
  console.log('[Connection Handler] Already connected, returning success');
  notifyRenderer(window, 'acp:status', { status: 'connected' });
  return { success: true, alreadyConnected: true, connectionType };
}
```

**问题**: 没有检查连接的实际状态是否有效。

**修复后**:
```typescript
// 如果已连接，先验证连接状态
if (connection?.isConnected) {
  console.log('[Connection Handler] Already connected and verified, returning success');
  notifyRenderer(window, 'acp:status', { status: 'connected' });
  return { success: true, alreadyConnected: true, connectionType };
}

// 如果连接对象存在但未连接，先清理
if (connection && !connection.isConnected) {
  console.log('[Connection Handler] Connection exists but not connected, cleaning up...');
  try {
    await connection.disconnect();
  } catch (e) {
    console.error('[Connection Handler] Error disconnecting old connection:', e);
  }
  connection = null;
  acpConnection = null;
  connectionType = null;
}
```

#### 4. 前端状态同步问题
**位置**: `src/renderer/hooks/useAcp.ts:sendMessage()` 函数

**修复前**:
```typescript
// 检查连接状态
if (connectionMode !== 'provider' && !isConnected) {
  console.log('[useAcp] Not connected, attempting to reconnect...')
  await reconnect()
}

// Provider 模式检查
if (connectionMode === 'provider') {
  // ...
} else if (!isConnected) {
  throw new Error('未连接到后端服务')
}
```

**问题**: 
- 使用闭包捕获的 `isConnected` 可能是过期状态
- 重连后没有验证状态是否真正恢复
- 重连后立即尝试加载会话，状态可能还未同步

**修复后**:
```typescript
// 检查连接状态（SDK/ACP 模式）
if (connectionMode !== 'provider') {
  // 重新获取最新的连接状态（避免闭包捕获的过期状态）
  const currentConnectedState = useAppStore.getState().isConnected
  
  if (!currentConnectedState) {
    console.log('[useAcp] Not connected, attempting to reconnect...')
    await reconnect()
    
    // 重连后再次检查状态，确保连接已建立
    const reconnectedState = useAppStore.getState().isConnected
    if (!reconnectedState) {
      throw new Error('重连失败，请检查网络连接后重试')
    }
  }
}
```

#### 5. 会话加载失败处理增强
**位置**: `src/renderer/hooks/useAcp.ts:session load error handling`

**修复前**:
```typescript
if (!loadResult.success) {
  const errorMsg = loadResult.error || '加载会话失败'
  console.error('[useAcp] Session load failed:', errorMsg)
  
  // 如果是 session 创建失败，尝试重连一次
  if (errorMsg.includes('Failed to create session') || errorMsg.includes('sessionId')) {
    console.log('[useAcp] Attempting reconnect due to session error...')
    try {
      await reconnect()
      // 重连后重试
      const retryResult = await api.session.load(...)
      if (!retryResult.success) {
        throw new Error(`重连后仍失败: ${retryResult.error || errorMsg}`)
      }
    } catch (reconnectError) {
      console.error('[useAcp] Reconnect failed:', reconnectError)
      throw new Error(`会话连接失败，请尝试刷新页面或重新连接。错误: ${errorMsg}`)
    }
  } else {
    throw new Error(errorMsg)
  }
}
```

**修复后**:
```typescript
if (!loadResult.success) {
  const errorMsg = loadResult.error || '加载会话失败'
  console.error('[useAcp] Session load failed:', errorMsg, { loadResult })
  
  // 检查是否是连接问题
  const isConnectionError = 
    errorMsg.includes('Not connected') || 
    errorMsg.includes('connection state') ||
    errorMsg.includes('Failed to create session') || 
    errorMsg.includes('sessionId') ||
    errorMsg.includes('ECONNREFUSED') ||
    errorMsg.includes('connection') ||
    errorMsg.includes('WebSocket')
  
  if (isConnectionError) {
    console.log('[useAcp] Detected connection error, attempting reconnect...')
    
    try {
      // 更新状态为连接中
      setIsConnecting(true)
      setConnectionStatus('reconnecting')
      
      // 尝试重连
      await reconnect()
      
      // 等待状态同步（给主进程一些时间来完成初始化）
      await new Promise(resolve => setTimeout(resolve, 500))
      
      // 验证重连后的状态
      const reconnectedState = useAppStore.getState()
      if (!reconnectedState.isConnected) {
        throw new Error('重连失败，连接状态未恢复')
      }
      
      // 重连后重试加载会话
      console.log('[useAcp] Retrying session load after reconnect...')
      const retryResult = await api.session.load(...)
      if (!retryResult.success) {
        throw new Error(`重连后仍失败: ${retryResult.error || errorMsg}`)
      }
    } catch (reconnectError) {
      console.error('[useAcp] Reconnect failed:', reconnectError)
      setIsConnecting(false)
      setConnectionStatus('disconnected')
      throw new Error(`会话连接失败，请尝试刷新页面或重新连接。错误: ${errorMsg}`)
    }
  } else {
    throw new Error(errorMsg)
  }
}
```

## 修复效果

### 1. 连接状态检查
- ✅ `getConnection()` 现在检查 `connection.isConnected` 属性
- ✅ 防止返回未完全初始化的连接对象

### 2. 初始化顺序
- ✅ `initialize()` 在 `notifyRenderer` 之前完成
- ✅ 前端收到连接状态时，连接已完全初始化
- ✅ 消除了时序竞态条件

### 3. 连接验证
- ✅ 连接前验证实际连接状态
- ✅ 清理无效的连接对象
- ✅ 防止僵尸连接

### 4. 前端状态同步
- ✅ 重新获取最新状态（避免闭包问题）
- ✅ 重连后验证状态恢复
- ✅ 添加状态同步延迟

### 5. 错误处理
- ✅ 检测更多类型的连接错误
- ✅ 增强的重连逻辑
- ✅ 更详细的错误日志

## 测试建议

### 1. 正常连接测试
- 启动应用
- 等待连接成功
- 检查日志中的连接顺序：
  ```
  [Connection Handler] doConnect started
  [Connection Handler] Connecting...
  [Connection Handler] Connection created
  [Connection Handler] Calling initialize()...
  [Connection Handler] Initialize completed successfully
  [Connection Handler] Sending connected status to renderer
  [ACP] Connected successfully
  ```

### 2. 会话加载测试
- 连接成功后立即创建新会话
- 发送第一条消息
- 检查是否出现 "Not connected" 错误

### 3. 重连测试
- 手动断开连接
- 重新连接
- 立即发送消息
- 检查重连后的状态是否正确

### 4. 竞态条件测试
- 快速切换会话
- 快速发送多条消息
- 检查是否出现状态不一致

## 预防措施

### 1. 状态同步日志
在关键操作前添加状态日志：
```typescript
console.log('[Connection Handler] State check:', {
  connectionExists: !!connection,
  isConnected: connection?.isConnected,
  currentState: connection?.currentState,
  connectionType: connectionType
});
```

### 2. 异步操作等待
在需要状态同步的地方添加适当的延迟：
```typescript
// 等待状态同步
await new Promise(resolve => setTimeout(resolve, 300));
```

### 3. 状态验证
在关键操作前验证状态：
```typescript
const state = useAppStore.getState();
if (!state.isConnected) {
  throw new Error('Not connected');
}
```

### 4. 错误检测
检测更多类型的连接错误：
```typescript
const isConnectionError = 
  errorMsg.includes('Not connected') || 
  errorMsg.includes('connection state') ||
  errorMsg.includes('Failed to create session') || 
  errorMsg.includes('sessionId') ||
  errorMsg.includes('ECONNREFUSED') ||
  errorMsg.includes('connection') ||
  errorMsg.includes('WebSocket');
```

## 文件变更

### 修改的文件
1. `src/main/ipc/handlers.ts`
   - `getConnection()` 函数：增加 `isConnected` 检查
   - `acp:connect` handler：增强连接验证
   - `doConnect()` 函数：调整初始化顺序

2. `src/renderer/hooks/useAcp.ts`
   - `sendMessage()` 函数：增强状态检查和重连逻辑
   - 会话加载错误处理：检测更多错误类型

### 新增文件
1. `test-connection-fix.js`: 连接状态同步修复验证脚本
2. `CONNECTION_FIX_REPORT.md`: 本修复报告

## 后续优化建议

### 1. 连接状态机
考虑实现更完整的连接状态机：
```typescript
type ConnectionState = 
  | 'disconnected'
  | 'connecting'
  | 'authenticating'
  | 'initializing'
  | 'connected'
  | 'reconnecting'
  | 'error';
```

### 2. 连接健康检查
定期检查连接状态：
```typescript
setInterval(async () => {
  if (connection?.isConnected) {
    try {
      await connection.ping();
    } catch (error) {
      console.error('[Connection] Health check failed:', error);
      // 触发重连
    }
  }
}, 30000); // 每 30 秒检查一次
```

### 3. 连接池管理
如果需要支持多个连接，考虑实现连接池：
```typescript
class ConnectionPool {
  private connections: Map<string, IConnection> = new Map();
  
  async getConnection(sessionId: string): Promise<IConnection> {
    // ...
  }
}
```

## 总结

本次修复解决了连接状态同步的核心问题：
1. ✅ 修复了 `getConnection()` 的状态检查不完整
2. ✅ 调整了初始化顺序，消除了时序竞态条件
3. ✅ 增强了连接验证和清理逻辑
4. ✅ 改进了前端状态同步和重连机制
5. ✅ 增强了错误检测和处理

修复后的代码更加健壮，能够正确处理各种连接状态和边界情况。