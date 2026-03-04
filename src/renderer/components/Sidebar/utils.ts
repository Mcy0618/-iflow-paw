/**
 * 格式化时间戳为相对时间
 */
export function formatDistanceToNow(timestamp: number): string {
  const now = Date.now()
  const diff = now - timestamp
  
  const minute = 60 * 1000
  const hour = 60 * minute
  const day = 24 * hour
  const week = 7 * day
  const month = 30 * day
  const year = 365 * day
  
  if (diff < minute) {
    return '刚刚'
  } else if (diff < hour) {
    const minutes = Math.floor(diff / minute)
    return `${minutes} 分钟前`
  } else if (diff < day) {
    const hours = Math.floor(diff / hour)
    return `${hours} 小时前`
  } else if (diff < week) {
    const days = Math.floor(diff / day)
    return `${days} 天前`
  } else if (diff < month) {
    const weeks = Math.floor(diff / week)
    return `${weeks} 周前`
  } else if (diff < year) {
    const months = Math.floor(diff / month)
    return `${months} 个月前`
  } else {
    const years = Math.floor(diff / year)
    return `${years} 年前`
  }
}

/**
 * 格式化日期为本地字符串
 */
export function formatDate(timestamp: number): string {
  return new Date(timestamp).toLocaleDateString('zh-CN', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}
