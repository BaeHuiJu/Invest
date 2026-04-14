const NOTIFICATION_SETTINGS_KEY = 'globalpick.notification-settings';
const NOTIFICATION_STATE_KEY = 'globalpick.notification-state';

export type NotificationSettings = {
  enabled: boolean;
  targetPriceAlerts: boolean;
  newReportAlerts: boolean;
  soundEnabled: boolean;
};

export type NotificationState = {
  lastCheckedAt: string;
  notifiedTargets: Record<string, string>; // ticker:market -> last notified timestamp
  notifiedReports: Record<string, string>; // reportId -> notified timestamp
};

const DEFAULT_SETTINGS: NotificationSettings = {
  enabled: false,
  targetPriceAlerts: true,
  newReportAlerts: true,
  soundEnabled: false,
};

const DEFAULT_STATE: NotificationState = {
  lastCheckedAt: new Date().toISOString(),
  notifiedTargets: {},
  notifiedReports: {},
};

export function getNotificationSettings(): NotificationSettings {
  if (typeof window === 'undefined') return DEFAULT_SETTINGS;
  try {
    const raw = window.localStorage.getItem(NOTIFICATION_SETTINGS_KEY);
    if (!raw) return DEFAULT_SETTINGS;
    return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export function saveNotificationSettings(settings: NotificationSettings): void {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(NOTIFICATION_SETTINGS_KEY, JSON.stringify(settings));
}

export function getNotificationState(): NotificationState {
  if (typeof window === 'undefined') return DEFAULT_STATE;
  try {
    const raw = window.localStorage.getItem(NOTIFICATION_STATE_KEY);
    if (!raw) return DEFAULT_STATE;
    return { ...DEFAULT_STATE, ...JSON.parse(raw) };
  } catch {
    return DEFAULT_STATE;
  }
}

export function saveNotificationState(state: NotificationState): void {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(NOTIFICATION_STATE_KEY, JSON.stringify(state));
}

export async function requestNotificationPermission(): Promise<NotificationPermission> {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    return 'denied';
  }
  if (Notification.permission === 'granted') {
    return 'granted';
  }
  if (Notification.permission === 'denied') {
    return 'denied';
  }
  return Notification.requestPermission();
}

export function showBrowserNotification(title: string, body: string): void {
  if (typeof window === 'undefined' || !('Notification' in window)) return;
  if (Notification.permission !== 'granted') return;

  new Notification(title, {
    body,
    icon: '/favicon.ico',
    tag: 'globalpick-notification',
  });
}
