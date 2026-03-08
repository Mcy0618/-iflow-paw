/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./src/renderer/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // 主色调 - 与 Logo 蓝紫渐变完美匹配
        primary: {
          DEFAULT: '#6366F1',
          light: '#818CF8',
          dark: '#4F46E5',
          50: '#EEF2FF',
          100: '#E0E7FF',
          200: '#C7D2FE',
          300: '#A5B4FC',
          400: '#818CF8',
          500: '#6366F1',
          600: '#4F46E5',
          700: '#4338CA',
          800: '#3730A3',
          900: '#312E81',
          950: '#1E1B4B',
        },
        // 渐变中间色
        violet: {
          450: '#7C3AED',
        },
        // 语义化强调色
        accent: {
          purple: '#8B5CF6',
          blue: '#3B82F6',
          cyan: '#06B6D4',
          green: '#10B981',
          amber: '#F59E0B',
          orange: '#F97316',
          red: '#EF4444',
          pink: '#EC4899',
        },
        // 背景色系统
        surface: {
          DEFAULT: '#FFFFFF',
          secondary: '#F8FAFC',
          tertiary: '#F1F5F9',
          elevated: '#FFFFFF',
        },
        // 深色模式背景色
        dark: {
          bg: '#0F172A',
          card: '#1E293B',
          elevated: '#334155',
          border: '#334155',
        },
      },
      borderRadius: {
        'sm': '6px',
        'DEFAULT': '8px',
        'md': '10px',
        'lg': '12px',
        'xl': '16px',
        '2xl': '20px',
        '3xl': '24px',
      },
      boxShadow: {
        'soft': '0 2px 15px -3px rgba(0, 0, 0, 0.07), 0 10px 20px -2px rgba(0, 0, 0, 0.04)',
        'soft-lg': '0 10px 40px -10px rgba(0, 0, 0, 0.08)',
        'glow': '0 0 20px rgba(99, 102, 241, 0.3)',
        'glow-lg': '0 0 40px rgba(99, 102, 241, 0.4)',
        'inner-light': 'inset 0 2px 4px 0 rgba(0, 0, 0, 0.02)',
        'glow-purple': '0 0 30px rgba(139, 92, 246, 0.4)',
        'glow-cyan': '0 0 30px rgba(6, 182, 212, 0.4)',
      },
      animation: {
        'fade-in': 'fadeIn 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
        'fade-in-up': 'fadeInUp 0.4s cubic-bezier(0.4, 0, 0.2, 1)',
        'slide-in-right': 'slideInRight 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
        'slide-in-left': 'slideInLeft 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
        'pulse-soft': 'pulseSoft 2s ease-in-out infinite',
        'bounce-soft': 'bounceSoft 1s ease-in-out infinite',
        'shimmer': 'shimmer 2s linear infinite',
        'float': 'float 3s ease-in-out infinite',
        'pulse-glow': 'pulseGlow 2s ease-in-out infinite',
        'pulse-glow-dark': 'pulseGlowDark 2s ease-in-out infinite',
        'border-glow': 'borderGlow 3s ease-in-out infinite',
        'gradient-shift': 'gradientShift 3s ease infinite',
        'spin-slow': 'spin 8s linear infinite',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        fadeInUp: {
          '0%': { opacity: '0', transform: 'translateY(10px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        slideInRight: {
          '0%': { opacity: '0', transform: 'translateX(10px)' },
          '100%': { opacity: '1', transform: 'translateX(0)' },
        },
        slideInLeft: {
          '0%': { opacity: '0', transform: 'translateX(-10px)' },
          '100%': { opacity: '1', transform: 'translateX(0)' },
        },
        pulseSoft: {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.7' },
        },
        bounceSoft: {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-3px)' },
        },
        shimmer: {
          '0%': { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
        float: {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-6px)' },
        },
        pulseGlow: {
          '0%, 100%': { 
            opacity: '0.6',
            transform: 'scale(1)',
          },
          '50%': { 
            opacity: '1',
            transform: 'scale(1.1)',
          },
        },
        pulseGlowDark: {
          '0%, 100%': { 
            opacity: '0.4',
            transform: 'scale(1)',
          },
          '50%': { 
            opacity: '0.8',
            transform: 'scale(1.15)',
          },
        },
        borderGlow: {
          '0%, 100%': { 
            boxShadow: '0 0 5px rgba(99, 102, 241, 0.3), inset 0 0 5px rgba(99, 102, 241, 0.1)',
          },
          '50%': { 
            boxShadow: '0 0 20px rgba(99, 102, 241, 0.5), inset 0 0 10px rgba(99, 102, 241, 0.2)',
          },
        },
        gradientShift: {
          '0%, 100%': { backgroundPosition: '0% 50%' },
          '50%': { backgroundPosition: '100% 50%' },
        },
      },
      backdropBlur: {
        'xs': '2px',
      },
      backgroundImage: {
        'gradient-radial': 'radial-gradient(var(--tw-gradient-stops))',
        'gradient-conic': 'conic-gradient(from 180deg at 50% 50%, var(--tw-gradient-stops))',
      },
    },
  },
  plugins: [
    // 自定义插件：玻璃拟态和科技感效果
    function({ addComponents }) {
      addComponents({
        '.glass': {
          backgroundColor: 'rgba(255, 255, 255, 0.8)',
          backdropFilter: 'blur(20px)',
          border: '1px solid rgba(255, 255, 255, 0.2)',
        },
        '.glass-dark': {
          backgroundColor: 'rgba(15, 23, 42, 0.8)',
          backdropFilter: 'blur(20px)',
          border: '1px solid rgba(255, 255, 255, 0.1)',
        },
        '.gradient-primary': {
          background: 'linear-gradient(135deg, #6366F1 0%, #8B5CF6 100%)',
        },
        '.gradient-primary-hover': {
          background: 'linear-gradient(135deg, #4F46E5 0%, #7C3AED 100%)',
        },
        '.text-gradient': {
          background: 'linear-gradient(135deg, #6366F1 0%, #8B5CF6 100%)',
          '-webkit-background-clip': 'text',
          '-webkit-text-fill-color': 'transparent',
        },
        '.shadow-glow': {
          boxShadow: '0 0 20px rgba(99, 102, 241, 0.3)',
        },
        // 科技感边框
        '.border-glow': {
          position: 'relative',
          '&::before': {
            content: '""',
            position: 'absolute',
            inset: '-1px',
            borderRadius: 'inherit',
            padding: '1px',
            background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.5), rgba(139, 92, 246, 0.5))',
            '-webkit-mask': 'linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)',
            '-webkit-mask-composite': 'xor',
            'mask-composite': 'exclude',
            pointerEvents: 'none',
          },
        },
        // 霓虹文字效果
        '.text-neon': {
          textShadow: '0 0 10px rgba(99, 102, 241, 0.8), 0 0 20px rgba(99, 102, 241, 0.6), 0 0 30px rgba(99, 102, 241, 0.4)',
        },
        // 网格背景
        '.bg-grid': {
          backgroundImage: 'linear-gradient(rgba(99, 102, 241, 0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(99, 102, 241, 0.03) 1px, transparent 1px)',
          backgroundSize: '50px 50px',
        },
        '.bg-grid-dark': {
          backgroundImage: 'linear-gradient(rgba(99, 102, 241, 0.05) 1px, transparent 1px), linear-gradient(90deg, rgba(99, 102, 241, 0.05) 1px, transparent 1px)',
          backgroundSize: '50px 50px',
        },
      })
    },
  ],
}
