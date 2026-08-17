'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { isAuthenticated } from '@/lib/auth';
import OnboardingWizard from '@/components/OnboardingWizard';

export default function OnboardingPage() {
  const router = useRouter();

  useEffect(() => {
    // Allow new signups (pending creds in sessionStorage) and already-authenticated users
    const hasPendingSignup =
      sessionStorage.getItem('palda_pending_email') &&
      sessionStorage.getItem('palda_pending_password');
    if (!isAuthenticated() && !hasPendingSignup) router.replace('/signup');
  }, [router]);

  return <OnboardingWizard />;
}
