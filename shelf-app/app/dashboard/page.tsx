'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function DashboardIndex() {
  const router = useRouter();
  useEffect(() => {
    router.replace('/dashboard/demand');
  }, [router]);

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        height: '60vh',
        color: 'var(--text-muted)',
        fontSize: 12,
        letterSpacing: '0.1em',
      }}
    >
      LOADING...
    </div>
  );
}
