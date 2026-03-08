import React, { useCallback } from 'react';
import { ImpactStyle } from '@capacitor/haptics';
import { useHaptics } from '@/platform/hooks/useHaptics';
import { motion, AnimatePresence } from 'motion/react';

export interface BottomTab {
  id: string;
  label: string;
  icon: React.ReactNode;
  activeIcon?: React.ReactNode;
  badge?: number;
}

interface BottomTabNavProps {
  tabs: BottomTab[];
  activeTab: string;
  onTabChange: (tabId: string) => void;
}

export const BottomTabNav: React.FC<BottomTabNavProps> = ({ tabs, activeTab, onTabChange }) => {
  const { impact } = useHaptics();

  const handleTab = useCallback((tabId: string) => {
    if (tabId !== activeTab) {
      impact(ImpactStyle.Light);
      onTabChange(tabId);
    }
  }, [activeTab, onTabChange, impact]);

  return (
    <nav className="native-bottom-nav safe-area-bottom" role="tablist" aria-label="Main navigation">
      <motion.div
        className="native-bottom-nav-inner"
        initial={{ y: 40, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ type: 'spring', stiffness: 300, damping: 28, delay: 0.1 }}
      >
        {tabs.map((tab) => {
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => handleTab(tab.id)}
              className={`native-tab-item ${isActive ? 'native-tab-active' : 'native-tab-inactive'}`}
              aria-selected={isActive}
              role="tab"
            >
              <div className={`native-tab-icon ${isActive ? 'native-tab-icon-lit' : ''}`}>
                <AnimatePresence mode="wait">
                  <motion.div
                    key={isActive ? 'active' : 'inactive'}
                    initial={{ scale: 0.7, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    exit={{ scale: 0.7, opacity: 0 }}
                    transition={{ type: 'spring', stiffness: 400, damping: 20 }}
                  >
                    {isActive && tab.activeIcon ? tab.activeIcon : tab.icon}
                  </motion.div>
                </AnimatePresence>
                {tab.badge != null && tab.badge > 0 && (
                  <motion.span
                    className="native-tab-badge"
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ type: 'spring', stiffness: 500, damping: 15 }}
                  >
                    {tab.badge > 99 ? '99+' : tab.badge}
                  </motion.span>
                )}
              </div>
              <span className={`native-tab-label ${isActive ? 'native-tab-label-lit' : ''}`}>
                {tab.label}
              </span>
              <AnimatePresence>
                {isActive && (
                  <motion.div
                    className="native-tab-dot"
                    layoutId="tab-dot-indicator"
                    initial={{ scale: 0, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    exit={{ scale: 0, opacity: 0 }}
                    transition={{ type: 'spring', stiffness: 500, damping: 25 }}
                  />
                )}
              </AnimatePresence>
            </button>
          );
        })}
      </motion.div>
    </nav>
  );
};
