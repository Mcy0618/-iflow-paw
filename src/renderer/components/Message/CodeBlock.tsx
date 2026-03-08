import React, { useState, useCallback, memo } from 'react'
import { ClipboardIcon, CheckIcon } from '@heroicons/react/24/outline'
import { useTheme } from '../../hooks/useTheme'
// @ts-ignore - react-syntax-highlighter types are incomplete
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter/dist/cjs'
// @ts-ignore - react-syntax-highlighter types are incomplete
import { oneDark } from 'react-syntax-highlighter/dist/cjs/styles/prism'

interface CodeBlockProps {
  language: string
  code: string
}

/**
 * 代码块组件 - 支持语法高亮和复制功能
 * 使用 memo 优化避免不必要的重渲染
 */
export const CodeBlock: React.FC<CodeBlockProps> = memo(({ language, code }) => {
  const [copied, setCopied] = useState(false)
  const { isDark } = useTheme()

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(code)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch (err) {
      console.error('Failed to copy:', err)
    }
  }, [code])

  // 计算代码行数 - 使用 memo 优化
  const lineCount = React.useMemo(() => code.split('\n').length, [code])

  return (
    <div className={`relative group rounded-xl overflow-hidden my-4 shadow-lg ${
      isDark ? 'border border-slate-700/50' : ''
    }`}>
      {/* 代码块头部 */}
      <div className={`flex items-center justify-between px-4 py-2.5 text-xs border-b ${
        isDark 
          ? 'bg-gradient-to-r from-slate-800 to-slate-800/95 text-slate-400 border-slate-700' 
          : 'bg-gradient-to-r from-gray-800 to-gray-750 text-gray-300 border-gray-700'
      }`}>
        <div className="flex items-center gap-2">
          <div className="flex gap-1.5">
            <span className="w-3 h-3 rounded-full bg-red-500/80" />
            <span className="w-3 h-3 rounded-full bg-yellow-500/80" />
            <span className="w-3 h-3 rounded-full bg-green-500/80" />
          </div>
          <span className={`font-mono ml-2 ${isDark ? 'text-slate-500' : 'text-gray-400'}`}>
            {language || 'text'}
          </span>
        </div>
        <button
          onClick={handleCopy}
          className={`flex items-center gap-1.5 px-2 py-1 rounded-md transition-all duration-200 ${
            isDark 
              ? 'hover:bg-slate-700/50 hover:text-white text-slate-400' 
              : 'hover:bg-gray-700/50 hover:text-white text-gray-300'
          }`}
        >
          {copied ? (
            <>
              <CheckIcon className="w-3.5 h-3.5 text-green-400" />
              <span className="text-green-400">已复制</span>
            </>
          ) : (
            <>
              <ClipboardIcon className="w-3.5 h-3.5" />
              复制
            </>
          )}
        </button>
      </div>
      
      {/* 代码内容 */}
      <SyntaxHighlighter
        language={language || 'text'}
        style={oneDark}
        customStyle={{
          margin: 0,
          padding: '1rem',
          fontSize: '0.85rem',
          lineHeight: '1.6',
          background: isDark ? '#0F172A' : '#1F2937',
        }}
        showLineNumbers={lineCount > 5}
        lineNumberStyle={{
          minWidth: '2.5em',
          paddingRight: '1em',
          color: isDark ? '#475569' : '#6B7280',
          textAlign: 'right',
        }}
      >
        {code}
      </SyntaxHighlighter>
    </div>
  )
})

CodeBlock.displayName = 'CodeBlock'