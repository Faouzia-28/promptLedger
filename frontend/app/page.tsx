'use client';

import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

export default function Home() {
  const router = useRouter();

  useEffect(() => {
    router.push('/overview');
  }, [router]);

  return (
    <div className="flex items-center justify-center min-h-screen bg-background">
      <div className="text-center">
        <div className="text-2xl font-bold text-primary mb-2">PromptLedger</div>
        <p className="text-muted-foreground">Redirecting...</p>
      </div>
    </div>
  );
}
