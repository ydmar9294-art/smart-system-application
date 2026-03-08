import React from 'react';

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
  return (
    <div className="bottom-tab-nav safe-area-bottom">
      <div className="bottom-tab-nav-inner">
        {tabs.map((tab) => {
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => onTabChange(tab.id)}
              className={`bottom-tab-item ${isActive ? 'bottom-tab-active' : 'bottom-tab-inactive'}`}
            >
              <div className={`bottom-tab-icon-wrap ${isActive ? 'bottom-tab-icon-active' : ''}`}>
                {isActive && tab.activeIcon ? tab.activeIcon : tab.icon}
                {tab.badge && tab.badge > 0 && (
                  <span className="bottom-tab-badge">{tab.badge > 99 ? '99+' : tab.badge}</span>
                )}
              </div>
              <span className={`bottom-tab-label ${isActive ? 'bottom-tab-label-active' : ''}`}>
                {tab.label}
              </span>
              {isActive && <div className="bottom-tab-indicator" />}
            </button>
          );
        })}
      </div>
    </div>
  );
};
