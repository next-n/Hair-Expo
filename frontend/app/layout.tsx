import type { Metadata } from 'next';
import './globals.css';
import { I18nProvider } from '../lib/i18n';

export const metadata: Metadata = { title: 'Hair Expo Checkout', description: 'Expo booth checkout' };

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body><I18nProvider>{children}</I18nProvider></body></html>;
}
