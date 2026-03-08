/**
 * AnimatedTabContent - Smooth tab transition wrapper using framer-motion
 * Provides native-like sliding/fading animations when switching tabs
 */
import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface AnimatedTabContentProps {
  tabKey: string;
  children: React.ReactNode;
  direction?: 'fade' | 'slide';
  className?: string;
}

const variants = {
  fade: {
    initial: { opacity: 0, y: 8 },
    animate: { opacity: 1, y: 0 },
    exit: { opacity: 0, y: -8 },
  },
  slide: {
    initial: { opacity: 0, x: 30 },
    animate: { opacity: 1, x: 0 },
    exit: { opacity: 0, x: -30 },
  },
};

const AnimatedTabContent: React.FC<AnimatedTabContentProps> = ({
  tabKey,
  children,
  direction = 'fade',
  className = '',
}) => {
  const v = variants[direction];

  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={tabKey}
        initial={v.initial}
        animate={v.animate}
        exit={v.exit}
        transition={{ duration: 0.2, ease: [0.25, 0.46, 0.45, 0.94] }}
        className={className}
      >
        {children}
      </motion.div>
    </AnimatePresence>
  );
};

export default AnimatedTabContent;
