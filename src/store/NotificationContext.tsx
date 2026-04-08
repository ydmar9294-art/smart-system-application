/**
 * NotificationContext - Handles in-app notifications
 * - Max 50 notifications cap to prevent memory leaks
 * - Auto TTL cleanup (10 minutes)
 * - Separated to prevent re-renders when notifications change
 */
import React, { createContext, useContext, useState, useCallback, useEffect, useRef } from 'react';
import { Notification } from '@/types';
import { useGuestOverride } from './GuestProviders';

const MAX_NOTIFICATIONS = 50;
const NOTIFICATION_TTL_MS = 10 * 60 * 1000; // 10 minutes
const CLEANUP_INTERVAL_MS = 60 * 1000; // check every 60s

interface TimestampedNotification extends Notification {
  _addedAt: number;
}

interface NotificationContextType {
  notifications: Notification[];
  addNotification: (message: string, type: 'success' | 'error' | 'warning') => void;
}

const NotificationContext = createContext<NotificationContextType | null>(null);

export const NotificationProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [notifications, setNotifications] = useState<TimestampedNotification[]>([]);
  const cleanupRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const addNotification = useCallback((message: string, type: 'success' | 'error' | 'warning') => {
    setNotifications(prev => {
      const next: TimestampedNotification[] = [
        { id: Date.now(), message, type, _addedAt: Date.now() },
        ...prev,
      ];
      // Cap at MAX_NOTIFICATIONS — trim oldest
      return next.length > MAX_NOTIFICATIONS ? next.slice(0, MAX_NOTIFICATIONS) : next;
    });
  }, []);

  // TTL cleanup — remove notifications older than 10 minutes
  useEffect(() => {
    cleanupRef.current = setInterval(() => {
      const cutoff = Date.now() - NOTIFICATION_TTL_MS;
      setNotifications(prev => {
        const filtered = prev.filter(n => n._addedAt > cutoff);
        return filtered.length === prev.length ? prev : filtered;
      });
    }, CLEANUP_INTERVAL_MS);

    return () => {
      if (cleanupRef.current) clearInterval(cleanupRef.current);
    };
  }, []);

  // Strip internal _addedAt before exposing to consumers
  const publicNotifications: Notification[] = notifications;

  return (
    <NotificationContext.Provider value={{ notifications: publicNotifications, addNotification }}>
      {children}
    </NotificationContext.Provider>
  );
};

export const useNotifications = () => {
  const ctx = useContext(NotificationContext);
  const guest = useGuestOverride();
  if (!ctx) {
    if (guest) return { notifications: [] as Notification[], addNotification: () => {} };
    throw new Error('useNotifications must be used within NotificationProvider');
  }
  return ctx;
};
