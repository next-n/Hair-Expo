'use client';

import { useEffect, useState } from 'react';
import { useI18n } from '../lib/i18n';

function remainingMilliseconds(expiresAt: string | null | undefined): number | null {
  if (!expiresAt) return null;
  const timestamp = Date.parse(expiresAt);
  return Number.isFinite(timestamp) ? Math.max(0, timestamp - Date.now()) : null;
}

function formatCountdown(milliseconds: number): string {
  const totalSeconds = Math.floor(milliseconds / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return [hours, minutes, seconds].map((value) => String(value).padStart(2, '0')).join(':');
}

export function PaymentLinkCountdown({ expiresAt }: Readonly<{ expiresAt?: string | null }>) {
  const { t } = useI18n();
  const [remaining, setRemaining] = useState<number | null>(null);

  useEffect(() => {
    const update = () => setRemaining(remainingMilliseconds(expiresAt));
    update();
    const timer = window.setInterval(update, 1000);
    return () => window.clearInterval(timer);
  }, [expiresAt]);

  if (remaining === null || remaining <= 0) return null;
  const countdown = formatCountdown(remaining);
  return <span className="payment-link-countdown">{t('paymentLinkExpiresIn', { time: countdown })}</span>;
}
