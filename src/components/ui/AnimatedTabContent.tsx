/**
 * AnimatedTabContent - Smooth tab transition wrapper
 * Uses lightweight CSS transitions instead of framer-motion
 * to reduce bundle size and improve performance on low-end devices.
 */
import React, { useState, useEffect, useRef } from 'react';

interface AnimatedTabContentProps {
  tabKey: string;
  children: React.ReactNode;
  direction?: 'fade' | 'slide';
  className?: string;
}

const AnimatedTabContent: React.FC<AnimatedTabContentProps> = ({
  tabKey,
  children,
  direction = 'fade',
  className = '',
}) => {
  const [displayKey, setDisplayKey] = useState(tabKey);
  const [phase, setPhase] = useState<'enter' | 'exit'>('enter');
  const contentRef = useRef<HTMLDivElement>(null);
  const prevKeyRef = useRef(tabKey);

  useEffect(() => {
    if (tabKey === prevKeyRef.current) return;
    prevKeyRef.current = tabKey;

    // Start exit
    setPhase('exit');

    const timer = setTimeout(() => {
      setDisplayKey(tabKey);
      setPhase('enter');
    }, 150); // Match CSS transition duration

    return () => clearTimeout(timer);
  }, [tabKey]);

  const baseStyle: React.CSSProperties = {
    transition: 'opacity 150ms ease-out, transform 150ms ease-out',
    willChange: 'opacity, transform',
  };

  const getTransformStyle = (): React.CSSProperties => {
    if (phase === 'exit') {
      return {
        ...baseStyle,
        opacity: 0,
        transform: direction === 'slide' ? 'translateX(-16px)' : 'translateY(-4px)',
      };
    }
    return {
      ...baseStyle,
      opacity: 1,
      transform: 'translate(0)',
    };
  };

  return (
    <div
      ref={contentRef}
      key={displayKey}
      style={getTransformStyle()}
      className={className}
    >
      {children}
    </div>
  );
};

export default AnimatedTabContent;
