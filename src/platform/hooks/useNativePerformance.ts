import { useEffect, useState } from 'react';
import { Capacitor } from '@capacitor/core';
import { App } from '@capacitor/app';

export const useNativePerformance = () => {
  const [isActive, setIsActive] = useState(true);

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;

    const resumeListener = App.addListener('appStateChange', ({ isActive: active }) => {
      setIsActive(active);
    });

    return () => {
      resumeListener.then(l => l.remove());
    };
  }, []);

  return { isActive };
};
