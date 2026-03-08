import { useMemo } from 'react'

/**
 * 判断模型是否为推荐模型
 */
export const isRecommendedModel = (modelId: string, recommendedModel?: string): boolean => {
  if (!recommendedModel) return false
  return modelId === recommendedModel
}

/**
 * 判断模式是否为推荐模式
 */
export const isRecommendedMode = (modeId: string, recommendedMode?: string): boolean => {
  if (!recommendedMode) return false
  return modeId === recommendedMode
}

/**
 * 推荐系统 Hook
 * 根据上下文提供智能推荐的快捷操作
 */
export const useRecommendations = () => {
  // 默认推荐模型
  const recommendedModel = useMemo(() => {
    return 'claude-sonnet' // 默认推荐 Claude
  }, [])

  // 默认推荐操作
  const defaultActions = useMemo(() => [
    '解释这段代码',
    '帮我优化这个函数',
    '生成测试用例',
    '代码审查',
  ], [])

  // 智能推荐操作（可以扩展为基于历史记录的推荐）
  const recommendedActions = useMemo(() => {
    return defaultActions
  }, [defaultActions])

  return {
    recommendedModel,
    recommendedActions,
  }
}