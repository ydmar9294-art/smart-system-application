import { Capacitor } from '@capacitor/core';
import { PushNotifications, Token, ActionPerformed, PushNotificationSchema } from '@capacitor/push-notifications';
import { LocalNotifications } from '@capacitor/local-notifications';

export interface NotificationData {
  title: string;
  body: string;
  data?: Record<string, unknown>;
}

class PushNotificationService {
  private isInitialized = false;
  private deviceToken: string | null = null;
  private webNotificationPermission: NotificationPermission = 'default';

  async initialize(): Promise<void> {
    if (this.isInitialized) return;
    
    // Initialize for web browsers
    if (!Capacitor.isNativePlatform()) {
      await this.initializeWebNotifications();
      this.isInitialized = true;
      return;
    }

    // Native platform initialization
    try {
      // Request permission
      const permStatus = await PushNotifications.requestPermissions();
      
      if (permStatus.receive === 'granted') {
        // Register for push notifications
        await PushNotifications.register();
        
        // Listen for registration success
        PushNotifications.addListener('registration', (token: Token) => {
          this.deviceToken = token.value;
          console.log('Push registration success, token: ' + token.value);
        });

        // Listen for registration errors
        PushNotifications.addListener('registrationError', (error: any) => {
          console.error('Push registration error:', error);
        });

        // Listen for push notifications received while app is in foreground
        PushNotifications.addListener('pushNotificationReceived', (notification: PushNotificationSchema) => {
          console.log('Push notification received:', notification);
          // Show local notification when in foreground
          this.showLocalNotification({
            title: notification.title || 'إشعار جديد',
            body: notification.body || '',
            data: notification.data
          });
        });

        // Listen for notification action (when user taps notification)
        PushNotifications.addListener('pushNotificationActionPerformed', (action: ActionPerformed) => {
          console.log('Push notification action performed:', action);
          this.handleNotificationAction(action.notification.data);
        });

        // Initialize local notifications for background/killed state
        await this.initializeLocalNotifications();
        
        this.isInitialized = true;
        console.log('Push notification service initialized (native)');
      } else {
        console.log('Push notification permission denied');
      }
    } catch (error) {
      console.error('Error initializing push notifications:', error);
    }
  }

  private async initializeWebNotifications(): Promise<void> {
    if (!('Notification' in window)) {
      console.log('This browser does not support notifications');
      return;
    }

    try {
      // Request permission
      const permission = await Notification.requestPermission();
      this.webNotificationPermission = permission;
      
      if (permission === 'granted') {
        console.log('Web notification permission granted');
      } else {
        console.log('Web notification permission:', permission);
      }
    } catch (error) {
      console.error('Error requesting web notification permission:', error);
    }
  }

  private async initializeLocalNotifications(): Promise<void> {
    try {
      const permStatus = await LocalNotifications.requestPermissions();
      
      if (permStatus.display === 'granted') {
        // Listen for local notification actions
        LocalNotifications.addListener('localNotificationActionPerformed', (action) => {
          console.log('Local notification action:', action);
          this.handleNotificationAction(action.notification.extra);
        });
      }
    } catch (error) {
      console.error('Error initializing local notifications:', error);
    }
  }

  async showLocalNotification(notification: NotificationData): Promise<void> {
    // For web browsers
    if (!Capacitor.isNativePlatform()) {
      if ('Notification' in window && this.webNotificationPermission === 'granted') {
        try {
          new Notification(notification.title, {
            body: notification.body,
            icon: '/favicon.png',
            badge: '/favicon.png',
            tag: `notif-${Date.now()}`,
            requireInteraction: false
          });
        } catch (error) {
          console.error('Error showing web notification:', error);
        }
      }
      return;
    }

    // For native platforms
    try {
      await LocalNotifications.schedule({
        notifications: [
          {
            title: notification.title,
            body: notification.body,
            id: Date.now(),
            schedule: { at: new Date(Date.now() + 100) },
            sound: 'beep.wav',
            extra: notification.data,
            smallIcon: 'ic_stat_icon_config_sample',
            iconColor: '#3B82F6'
          }
        ]
      });
    } catch (error) {
      console.error('Error showing local notification:', error);
    }
  }

  private handleNotificationAction(data: any): void {
    // Handle different notification types
    if (data?.type === 'low_stock' || data?.type === 'out_of_stock') {
      // Navigate to inventory
      console.log('Navigate to inventory');
    } else if (data?.type === 'overdue_invoice') {
      // Navigate to debts
      console.log('Navigate to debts');
    } else if (data?.type === 'new_sale') {
      // Navigate to sales
      console.log('Navigate to sales');
    }
  }

  getDeviceToken(): string | null {
    return this.deviceToken;
  }

  async sendTestNotification(): Promise<void> {
    await this.showLocalNotification({
      title: 'اختبار الإشعارات',
      body: 'تم تفعيل الإشعارات بنجاح! 🎉',
      data: { type: 'test' }
    });
  }

  getWebPermissionStatus(): NotificationPermission {
    return this.webNotificationPermission;
  }

  isSupported(): boolean {
    if (Capacitor.isNativePlatform()) {
      return true;
    }
    return 'Notification' in window;
  }
}

export const pushNotificationService = new PushNotificationService();