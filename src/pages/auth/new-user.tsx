import { useSession } from 'next-auth/react';
import { useRouter } from 'next/router';
import { AuthLayout } from '@/components/layout/AuthLayout';
import { Logo } from '@/components/Logo';

export default function NewUser() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const { callbackUrl } = router.query;

  if (status === 'loading') {
    return null;
  }

  if (!session) {
    router.push('/auth/signin');
    return null;
  }

  // Redirect to callback URL or default to home
  router.push(callbackUrl as string || '/');
  
  return (
    <AuthLayout>
      <div className="space-y-6">
        <div className="space-y-2 text-center">
          <div className="inline-block rounded-xl p-2 bg-gradient-to-br from-pink-500 to-purple-500">
            <Logo className="h-6 w-6 text-white" />
          </div>
          <h1 className="text-2xl font-semibold tracking-tight">
            Welcome to Amariel
          </h1>
          <p className="text-sm text-muted-foreground">
            Setting up your account...
          </p>
        </div>
      </div>
    </AuthLayout>
  );
} 