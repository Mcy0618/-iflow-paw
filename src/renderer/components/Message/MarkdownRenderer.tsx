import React from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { useTheme } from '../../hooks/useTheme'
import { CodeBlock } from './CodeBlock'

interface MarkdownRendererProps {
  content: string
}

/**
 * Markdown 渲染组件 - 支持代码高亮、表格、引用等
 */
export const MarkdownRenderer: React.FC<MarkdownRendererProps> = React.memo(({ content }) => {
  const { isDark } = useTheme()

  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      components={{
        // 使用 pre 组件处理代码块（避免 DOM 嵌套警告）
        pre({ children }) {
          // 检查 children 是否是代码块
          if (React.isValidElement(children) && children.type === 'code') {
            const codeProps = children.props as { className?: string; children?: string }
            const match = /language-(\w+)/.exec(codeProps.className || '')
            const language = match ? match[1] : ''
            const code = String(codeProps.children || '').replace(/\n$/, '')
            
            if (code) {
              return <CodeBlock language={language} code={code} />
            }
          }
          // 非代码块，返回原始 pre
          return <pre>{children}</pre>
        },
        
        // 内联代码
        code({ className, children, ...props }: { className?: string; children?: React.ReactNode }) {
          const isInline = !className;
          if (isInline) {
            return (
              <code
                className={`px-1.5 py-0.5 rounded text-sm font-mono ${
                  isDark 
                    ? 'bg-slate-700/50 text-primary-400' 
                    : 'bg-gray-100 text-primary-700'
                }`}
                {...props}
              >
                {children}
              </code>
            )
          }
          // 非内联代码由 pre 组件处理，这里返回原始 code
          return <code className={className} {...props}>{children}</code>
        },
        
        // 段落
        p({ children }) {
          return <p className="mb-3 last:mb-0">{children}</p>
        },
        
        // 列表
        ul({ children }) {
          return <ul className="list-disc pl-5 mb-3 space-y-1">{children}</ul>
        },
        
        ol({ children }) {
          return <ol className="list-decimal pl-5 mb-3 space-y-1">{children}</ol>
        },
        
        // 引用块
        blockquote({ children }) {
          return (
            <blockquote className={`border-l-4 py-2 my-3 ${
              isDark 
                ? 'border-primary-500/50 bg-primary-950/30 text-slate-400' 
                : 'border-primary-400 bg-primary-50/50 text-gray-600'
            } pl-4`}>
              {children}
            </blockquote>
          )
        },
        
        // 链接
        a({ href, children }) {
          return (
            <a
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              className={`underline ${
                isDark 
                  ? 'text-primary-400 hover:text-primary-300' 
                  : 'text-primary-600 hover:text-primary-700'
              }`}
            >
              {children}
            </a>
          )
        },
        
        // 表格
        table({ children }) {
          return (
            <div className="overflow-x-auto my-3">
              <table className={`min-w-full border-collapse border text-sm ${
                isDark ? 'border-slate-700' : 'border-gray-200'
              }`}>
                {children}
              </table>
            </div>
          )
        },
        
        thead({ children }) {
          return <thead className={isDark ? 'bg-slate-800' : 'bg-gray-50'}>{children}</thead>
        },
        
        th({ children }) {
          return (
            <th className={`border px-3 py-2 text-left font-semibold ${
              isDark 
                ? 'border-slate-700 text-slate-200' 
                : 'border-gray-200 text-gray-700'
            }`}>
              {children}
            </th>
          )
        },
        
        td({ children }) {
          return (
            <td className={`border px-3 py-2 ${
              isDark ? 'border-slate-700 text-slate-300' : 'border-gray-200 text-gray-600'
            }`}>
              {children}
            </td>
          )
        },
        
        // 分隔线
        hr() {
          return <hr className={`my-4 ${isDark ? 'border-slate-700' : 'border-gray-200'}`} />
        },
        
        // 标题
        h1({ children }) {
          return <h1 className={`text-xl font-bold mt-6 mb-3 ${
            isDark ? 'text-slate-100' : ''
          }`}>{children}</h1>
        },
        
        h2({ children }) {
          return <h2 className={`text-lg font-bold mt-5 mb-2 ${
            isDark ? 'text-slate-100' : ''
          }`}>{children}</h2>
        },
        
        h3({ children }) {
          return <h3 className={`text-base font-bold mt-4 mb-2 ${
            isDark ? 'text-slate-100' : ''
          }`}>{children}</h3>
        },
      }}
    >
      {content}
    </ReactMarkdown>
  )
})

MarkdownRenderer.displayName = 'MarkdownRenderer'
