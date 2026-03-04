import React, { useMemo } from 'react'
import ReactMarkdown from 'react-markdown'
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter/dist/cjs'
import { oneDark } from 'react-syntax-highlighter/dist/cjs/styles/prism'
import remarkGfm from 'remark-gfm'
import { Message as MessageType } from '../../store/useAppStore'
import { UserIcon, CpuChipIcon, ClipboardIcon, CheckIcon } from '@heroicons/react/24/outline'

interface MessageProps {
  message: MessageType
  isLast?: boolean
}

// 代码块组件
interface CodeBlockProps {
  language: string
  code: string
}

const CodeBlock: React.FC<CodeBlockProps> = ({ language, code }) => {
  const [copied, setCopied] = React.useState(false)

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(code)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch (err) {
      console.error('Failed to copy:', err)
    }
  }

  return (
    <div className="relative group rounded-lg overflow-hidden my-3">
      {/* 代码块头部 */}
      <div className="flex items-center justify-between px-4 py-2 bg-gray-800 text-gray-400 text-xs">
        <span className="font-mono">{language || 'text'}</span>
        <button
          onClick={handleCopy}
          className="flex items-center gap-1.5 hover:text-white transition-colors"
        >
          {copied ? (
            <>
              <CheckIcon className="w-3.5 h-3.5" />
              已复制
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
          background: '#1F2937',
        }}
        showLineNumbers={code.split('\n').length > 5}
        lineNumberStyle={{
          minWidth: '2.5em',
          paddingRight: '1em',
          color: '#6B7280',
          textAlign: 'right',
        }}
      >
        {code}
      </SyntaxHighlighter>
    </div>
  )
}

// Markdown 渲染组件
interface MarkdownRendererProps {
  content: string
}

const MarkdownRenderer: React.FC<MarkdownRendererProps> = ({ content }) => {
  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      components={{
        // 代码块
        code({ node, inline, className, children, ...props }) {
          const match = /language-(\w+)/.exec(className || '')
          const language = match ? match[1] : ''
          const code = String(children).replace(/\n$/, '')
          
          if (!inline && code) {
            return <CodeBlock language={language} code={code} />
          }
          
          return (
            <code
              className="px-1.5 py-0.5 bg-gray-100 text-primary-700 rounded text-sm font-mono"
              {...props}
            >
              {children}
            </code>
          )
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
            <blockquote className="border-l-4 border-primary-400 bg-primary-50/50 pl-4 py-2 my-3 text-gray-600">
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
              className="text-primary-600 hover:text-primary-700 underline"
            >
              {children}
            </a>
          )
        },
        
        // 表格
        table({ children }) {
          return (
            <div className="overflow-x-auto my-3">
              <table className="min-w-full border-collapse border border-gray-200 text-sm">
                {children}
              </table>
            </div>
          )
        },
        
        thead({ children }) {
          return <thead className="bg-gray-50">{children}</thead>
        },
        
        th({ children }) {
          return (
            <th className="border border-gray-200 px-3 py-2 text-left font-semibold text-gray-700">
              {children}
            </th>
          )
        },
        
        td({ children }) {
          return (
            <td className="border border-gray-200 px-3 py-2 text-gray-600">
              {children}
            </td>
          )
        },
        
        // 分隔线
        hr() {
          return <hr className="my-4 border-gray-200" />
        },
        
        // 标题
        h1({ children }) {
          return <h1 className="text-xl font-bold mt-6 mb-3">{children}</h1>
        },
        
        h2({ children }) {
          return <h2 className="text-lg font-bold mt-5 mb-2">{children}</h2>
        },
        
        h3({ children }) {
          return <h3 className="text-base font-bold mt-4 mb-2">{children}</h3>
        },
      }}
    >
      {content}
    </ReactMarkdown>
  )
}

// 主消息组件
export const Message: React.FC<MessageProps> = ({ message, isLast }) => {
  const isUser = message.role === 'user'
  const isStreaming = message.isStreaming
  
  // 格式化时间
  const formattedTime = useMemo(() => {
    return new Date(message.timestamp).toLocaleTimeString('zh-CN', {
      hour: '2-digit',
      minute: '2-digit',
    })
  }, [message.timestamp])

  if (isUser) {
    // 用户消息 - 右侧显示
    return (
      <div className="flex justify-end animate-fade-in">
        <div className="flex items-start gap-3 max-w-[80%]">
          <div className="flex flex-col items-end">
            <div className="px-4 py-3 bg-primary-50 text-gray-800 rounded-2xl rounded-tr-sm border border-primary-100">
              <div className="whitespace-pre-wrap leading-relaxed">
                {message.content}
              </div>
            </div>
            <span className="text-xs text-gray-400 mt-1.5 mr-1">
              {formattedTime}
            </span>
          </div>
          
          {/* 用户头像 */}
          <div className="flex-shrink-0 w-8 h-8 bg-primary-500 rounded-full flex items-center justify-center">
            <UserIcon className="w-4 h-4 text-white" />
          </div>
        </div>
      </div>
    )
  }

  // AI 消息 - 左侧显示
  return (
    <div className="flex justify-start animate-fade-in">
      <div className="flex items-start gap-3 max-w-[85%]">
        {/* AI 头像 */}
        <div className="flex-shrink-0 w-8 h-8 bg-gradient-to-br from-primary-400 to-primary-600 rounded-full flex items-center justify-center shadow-sm">
          <CpuChipIcon className="w-4 h-4 text-white" />
        </div>
        
        <div className="flex flex-col">
          <div className="px-4 py-3 bg-white rounded-2xl rounded-tl-sm border border-gray-200 shadow-sm">
            {message.content ? (
              <div className="markdown-content text-gray-800">
                <MarkdownRenderer content={message.content} />
              </div>
            ) : isStreaming ? (
              // 流式加载中
              <div className="flex items-center gap-2 py-2">
                <span className="w-2 h-2 bg-primary-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                <span className="w-2 h-2 bg-primary-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                <span className="w-2 h-2 bg-primary-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
              </div>
            ) : null}
          </div>
          
          <div className="flex items-center gap-2 mt-1.5 ml-1">
            <span className="text-xs text-gray-400">
              {formattedTime}
            </span>
            {isStreaming && (
              <span className="text-xs text-primary-500 flex items-center gap-1">
                <span className="w-1 h-1 bg-primary-500 rounded-full animate-pulse" />
                生成中
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
