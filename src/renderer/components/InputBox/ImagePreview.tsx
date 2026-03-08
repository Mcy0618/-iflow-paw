import React from 'react'
import { PhotoIcon, XMarkIcon } from '@heroicons/react/24/outline'
import { Attachment } from '../../store/useAppStore'

interface ImagePreviewProps {
  attachments: Attachment[]
  onRemove: (index: number) => void
}

/**
 * 图片预览组件 - 显示已选择的图片附件
 */
export const ImagePreview: React.FC<ImagePreviewProps> = ({ attachments, onRemove }) => {
  if (!attachments || attachments.length === 0) return null

  return (
    <div className="flex flex-wrap gap-2 mb-3">
      {attachments.map((attachment, index) => (
        <div key={index} className="relative group">
          <div className="w-16 h-16 rounded-lg overflow-hidden border border-gray-200 bg-gray-50">
            {attachment.content ? (
              <img
                src={attachment.content}
                alt={attachment.name}
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center">
                <PhotoIcon className="w-6 h-6 text-gray-400" />
              </div>
            )}
          </div>
          <button
            onClick={() => onRemove(index)}
            className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity shadow-sm hover:bg-red-600"
          >
            <XMarkIcon className="w-3 h-3" />
          </button>
          <span className="absolute bottom-0 left-0 right-0 text-[8px] text-white bg-black/50 truncate px-1 rounded-b-lg">
            {attachment.name}
          </span>
        </div>
      ))}
    </div>
  )
}
