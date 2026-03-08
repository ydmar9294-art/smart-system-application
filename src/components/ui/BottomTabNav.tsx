import React, { useCallback } from 'react';
import { ImpactStyle } from '@capacitor/haptics';
import { useHaptics } from '@/platform/hooks/useHaptics';

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
      impact('light');
      onTabChange(tabId);
    }
  }, [activeTab, onTabChange, impact]);

  return (
    <nav className="native-bottom-nav safe-area-bottom" role="tablist" aria-label="Main navigation">
      <div className="native-bottom-nav-inner">
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
              {/* Icon container */}
              <div className={`native-tab-icon ${isActive ? 'native-tab-icon-lit' : ''}`}>
                {isActive && tab.activeIcon ? tab.activeIcon : tab.icon}
                {tab.badge != null && tab.badge > 0 && (
                  <span className="native-tab-badge">{tab.badge > 99 ? '99+' : tab.badge}</span>
                )}
              </div>
              {/* Label */}
              <span className={`native-tab-label ${isActive ? 'native-tab-label-lit' : ''}`}>
                {tab.label}
              </span>
              {/* Active indicator dot */}
              {isActive && <div className="native-tab-dot" />}
            </button>
          );
        })}
      </div>
    </nav>
  );
};
