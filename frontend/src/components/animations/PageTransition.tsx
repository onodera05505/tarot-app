import { motion } from 'framer-motion'
import type { HTMLMotionProps } from 'framer-motion'

type Props = Omit<HTMLMotionProps<'main'>, 'initial' | 'animate' | 'exit' | 'transition'>

// 全ページ共通のフェード遷移ラッパー。
// AnimatePresence (App.tsx) 配下で mode="wait" → 退場完了後に入場するクロスフェード。
export function PageTransition(props: Props) {
  return (
    <motion.main
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.25, ease: 'easeOut' }}
      {...props}
    />
  )
}
