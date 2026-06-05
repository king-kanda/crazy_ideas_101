'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { isAuthenticated } from '@/lib/auth';
import OnboardingWizard from '@/components/OnboardingWizard';

export default function OnboardingPage() {
  const router = useRouter();

  useEffect(() => {
    if (!isAuthenticated()) router.replace('/login');
  }, [router]);

  return <OnboardingWizard />;
}
