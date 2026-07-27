import type { Metadata } from 'next';
import GuideContent from './guide-content';

export const metadata: Metadata = {
  title: 'TRUNOV HAIR - Project Guide',
  description: 'TRUNOV HAIR expo checkout project guide and walkthrough',
};

const checkoutUrl = process.env.NEXT_PUBLIC_GUIDE_CHECKOUT_URL?.trim() || '/';
const videoUrl = process.env.NEXT_PUBLIC_GUIDE_VIDEO_URL?.trim() || '';

export default function GuidePage() {
  return <GuideContent checkoutUrl={checkoutUrl} videoUrl={videoUrl} />;
}
