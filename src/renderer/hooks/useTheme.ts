import { useEffect, useCallback } from 'react'
import { useAppStore, Theme } from '../store/useAppStore'

// 重新导出 Theme 类型供其他组件使用
export type { Theme }

/**
 * 主题管理 Hook
 * 处理主题切换、系统主题跟随等功能
 */
export function useTheme() {
  const theme = useAppStore((state) => state.theme)
  const resolvedTheme = useAppStore((state) => state.resolvedTheme)
  const setTheme = useAppStore((state) => state.setTheme)
  const setResolvedTheme = useAppStore((state) => state.setResolvedTheme)

  // 解析实际主题
  const resolveTheme = useCallback((currentTheme: Theme): 'light' | 'dark' => {
    if (currentTheme === 'system') {
      // 检测系统主题
      if (typeof window !== 'undefined' && window.matchMedia) {
        return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
      }
      return 'light'
    }
    return currentTheme
  }, [])

  // 应用主题到 DOM
  const applyTheme = useCallback((resolved: 'light' | 'dark') => {
    const root = document.documentElement
    
    if (resolved === 'dark') {
      root.classList.add('dark')
      root.setAttribute('data-theme', 'dark')
    } else {
      root.classList.remove('dark')
      root.setAttribute('data-theme', 'light')
    }
    
    // 更新 CSS 变量
    updateCSSVariables(resolved)
  }, [])

  // 更新 CSS 变量
  const updateCSSVariables = (theme: 'light' | 'dark') => {
    const root = document.documentElement
    
    if (theme === 'dark') {
      // 深色模式变量
      root.style.setProperty('--bg-primary', '#0F172A')
      root.style.setProperty('--bg-secondary', '#1E293B')
      root.style.setProperty('--bg-tertiary', '#334155')
      root.style.setProperty('--bg-elevated', '#1E293B')
      
      root.style.setProperty('--text-primary', '#F1F5F9')
      root.style.setProperty('--text-secondary', '#94A3B8')
      root.style.setProperty('--text-tertiary', '#64748B')
      root.style.setProperty('--text-muted', '#475569')
      
      root.style.setProperty('--border-color', '#334155')
      root.style.setProperty('--border-light', '#1E293B')
      
      root.style.setProperty('--ai-bubble', '#1E293B')
      root.style.setProperty('--user-bubble', 'linear-gradient(135deg, #6366F1 0%, #4F46E5 100%)')
    } else {
      // 浅色模式变量
      root.style.setProperty('--bg-primary', '#FFFFFF')
      root.style.setProperty('--bg-secondary', '#F8FAFC')
      root.style.setProperty('--bg-tertiary', '#F1F5F9')
      root.style.setProperty('--bg-elevated', '#FFFFFF')
      
      root.style.setProperty('--text-primary', '#0F172A')
      root.style.setProperty('--text-secondary', '#475569')
      root.style.setProperty('--text-tertiary', '#94A3B8')
      root.style.setProperty('--text-muted', '#CBD5E1')
      
      root.style.setProperty('--border-color', '#E2E8F0')
      root.style.setProperty('--border-light', '#F1F5F9')
      
      root.style.setProperty('--ai-bubble', '#FFFFFF')
      root.style.setProperty('--user-bubble', 'linear-gradient(135deg, #6366F1 0%, #4F46E5 100%)')
    }
  }

  // 监听系统主题变化
  useEffect(() => {
    if (theme !== 'system') return
    
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')
    
    const handleChange = (e: MediaQueryListEvent) => {
      const newResolved = e.matches ? 'dark' : 'light'
      setResolvedTheme(newResolved)
      applyTheme(newResolved)
    }
    
    mediaQuery.addEventListener('change', handleChange)
    return () => mediaQuery.removeEventListener('change', handleChange)
  }, [theme, setResolvedTheme, applyTheme])

  // 初始化和主题变化时应用主题
  useEffect(() => {
    const resolved = resolveTheme(theme)
    setResolvedTheme(resolved)
    applyTheme(resolved)
  }, [theme, resolveTheme, setResolvedTheme, applyTheme])

  // 切换主题
  const toggleTheme = useCallback(() => {
    const nextTheme = theme === 'light' ? 'dark' : theme === 'dark' ? 'system' : 'light'
    setTheme(nextTheme)
  }, [theme, setTheme])

  // 设置特定主题
  const setSpecificTheme = useCallback((newTheme: Theme) => {
    setTheme(newTheme)
  }, [setTheme])

  return {
    theme,
    resolvedTheme,
    isDark: resolvedTheme === 'dark',
    isLight: resolvedTheme === 'light',
    isSystem: theme === 'system',
    toggleTheme,
    setTheme: setSpecificTheme,
  }
}
