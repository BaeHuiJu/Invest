'use client';

import { useEffect, useState } from 'react';
import {
  getNotificationSettings,
  saveNotificationSettings,
  requestNotificationPermission,
  type NotificationSettings as NotificationSettingsType,
} from '@/lib/notification-settings';

type NotificationSettingsProps = {
  isOpen: boolean;
  onClose: () => void;
};

export function NotificationSettings({ isOpen, onClose }: NotificationSettingsProps) {
  const [settings, setSettings] = useState<NotificationSettingsType>({
    enabled: false,
    targetPriceAlerts: true,
    newReportAlerts: true,
    soundEnabled: false,
  });
  const [permission, setPermission] = useState<NotificationPermission>('default');

  useEffect(() => {
    if (isOpen) {
      setSettings(getNotificationSettings());
      if (typeof window !== 'undefined' && 'Notification' in window) {
        setPermission(Notification.permission);
      }
    }
  }, [isOpen]);

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    if (isOpen) {
      document.addEventListener('keydown', handleEscape);
      return () => document.removeEventListener('keydown', handleEscape);
    }
  }, [isOpen, onClose]);

  const handleToggle = (key: keyof NotificationSettingsType) => {
    const newSettings = { ...settings, [key]: !settings[key] };
    setSettings(newSettings);
    saveNotificationSettings(newSettings);
  };

  const handleRequestPermission = async () => {
    const result = await requestNotificationPermission();
    setPermission(result);
    if (result === 'granted' && !settings.enabled) {
      const newSettings = { ...settings, enabled: true };
      setSettings(newSettings);
      saveNotificationSettings(newSettings);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-md rounded-2xl bg-c-surface shadow-xl">
        <div className="flex items-center justify-between border-b border-c-border p-4">
          <h2 className="text-lg font-semibold text-c-text">알림 설정</h2>
          <button
            onClick={onClose}
            className="rounded-lg p-2 text-c-text-3 hover:bg-c-surface-2 hover:text-c-text-2"
            aria-label="닫기"
          >
            ✕
          </button>
        </div>

        <div className="space-y-4 p-4">
          {/* Browser Permission Status */}
          <div className="rounded-lg bg-c-surface-2 p-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="font-medium text-c-text">브라우저 알림 권한</div>
                <div className="text-sm text-c-text-2">
                  {permission === 'granted'
                    ? '알림이 허용되었습니다'
                    : permission === 'denied'
                      ? '알림이 차단되었습니다. 브라우저 설정에서 허용해주세요.'
                      : '알림 권한을 요청합니다'}
                </div>
              </div>
              {permission === 'default' && (
                <button
                  onClick={handleRequestPermission}
                  className="rounded-lg bg-c-accent px-4 py-2 text-sm font-medium text-white hover:opacity-90"
                >
                  허용
                </button>
              )}
              {permission === 'granted' && (
                <span className="rounded-full bg-c-positive-bg px-3 py-1 text-sm font-medium text-c-positive">
                  허용됨
                </span>
              )}
              {permission === 'denied' && (
                <span className="rounded-full bg-c-negative-bg px-3 py-1 text-sm font-medium text-c-negative">
                  차단됨
                </span>
              )}
            </div>
          </div>

          {/* Settings Toggles */}
          <div className="space-y-3">
            <ToggleItem
              label="알림 사용"
              description="관심종목 관련 알림을 받습니다"
              checked={settings.enabled}
              onChange={() => handleToggle('enabled')}
              disabled={permission !== 'granted'}
            />
            <ToggleItem
              label="목표가 도달 알림"
              description="관심종목이 목표가에 도달하면 알림"
              checked={settings.targetPriceAlerts}
              onChange={() => handleToggle('targetPriceAlerts')}
              disabled={!settings.enabled || permission !== 'granted'}
            />
            <ToggleItem
              label="신규 리포트 알림"
              description="관심종목에 새 애널리스트 리포트가 등록되면 알림"
              checked={settings.newReportAlerts}
              onChange={() => handleToggle('newReportAlerts')}
              disabled={!settings.enabled || permission !== 'granted'}
            />
            <ToggleItem
              label="알림음"
              description="알림 시 소리를 재생합니다"
              checked={settings.soundEnabled}
              onChange={() => handleToggle('soundEnabled')}
              disabled={!settings.enabled || permission !== 'granted'}
            />
          </div>
        </div>

        <div className="border-t border-c-border p-4">
          <button
            onClick={onClose}
            className="w-full rounded-lg bg-c-surface-2 py-2.5 font-medium text-c-text-2 hover:bg-c-border"
          >
            닫기
          </button>
        </div>
      </div>
    </div>
  );
}

function ToggleItem({
  label,
  description,
  checked,
  onChange,
  disabled = false,
}: {
  label: string;
  description: string;
  checked: boolean;
  onChange: () => void;
  disabled?: boolean;
}) {
  return (
    <div
      className={`flex items-center justify-between rounded-lg border border-c-border p-4 ${disabled ? 'opacity-50' : ''}`}
    >
      <div>
        <div className="font-medium text-c-text">{label}</div>
        <div className="text-sm text-c-text-2">{description}</div>
      </div>
      <button
        onClick={onChange}
        disabled={disabled}
        className={`relative h-6 w-11 rounded-full transition-colors ${
          checked ? 'bg-c-accent' : 'bg-c-border'
        } ${disabled ? 'cursor-not-allowed' : 'cursor-pointer'}`}
        role="switch"
        aria-checked={checked}
      >
        <span
          className={`absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${
            checked ? 'translate-x-5' : 'translate-x-0'
          }`}
        />
      </button>
    </div>
  );
}
