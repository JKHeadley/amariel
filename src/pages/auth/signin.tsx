import { getProviders, signIn } from 'next-auth/react';
import { GetServerSideProps } from 'next';
import { useRouter } from 'next/router';
import { useSession } from 'next-auth/react';
import { useState, useEffect } from 'react';
import { Logo } from '@/components/Logo';
import { AuthLayout } from '@/components/layout/AuthLayout';
import { SignInCard } from '@/components/auth/SignInCard';

export const getServerSideProps: GetServerSideProps = async () => {
  const providers = await getProviders();
  return {
    props: { providers },
  };
};

export default function SignIn({ providers }: { providers: any }) {
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();
  const { data: session, status } = useSession();
  const { callbackUrl } = router.query;

  useEffect(() => {
    if (session && callbackUrl) {
      router.push(callbackUrl as string);
    }
  }, [session, callbackUrl, router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const result = await signIn('email', {
        email,
        callbackUrl: callbackUrl as string || '/admin',
        redirect: false,
      });

      if (result?.error) {
        console.error('Sign in error:', result.error);
      } else if (result?.url) {
        router.push(result.url);
      }
    } catch (error) {
      console.error('Sign in error:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setIsLoading(true);
    try {
      await signIn('google', { callbackUrl: '/' });
    } catch (error) {
      console.error('Google sign in error:', error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <AuthLayout>
      <div className="space-y-6">
        <div className="space-y-2 text-center">
          <div className="inline-block rounded-xl p-2 bg-gradient-to-br from-pink-500 to-purple-500">
            <Logo className="h-6 w-6 text-white" />
          </div>
          <h1 className="text-2xl font-semibold tracking-tight">
            Sign in to Dashboard
          </h1>
          <p className="text-sm text-muted-foreground">
            Access your admin controls
          </p>
          <p className="text-sm">
            Sign up now and receive <span className="font-medium">5 free credits</span> to get started!
          </p>
        </div>

        <SignInCard
          email={email}
          isLoading={isLoading}
          onEmailChange={setEmail}
          onSubmit={handleSubmit}
          onGoogleSignIn={handleGoogleSignIn}
        />

        <p className="text-center text-sm text-muted-foreground italic">
          Secure and streamlined access to your management tools
        </p>
      </div>
    </AuthLayout>
  );
}