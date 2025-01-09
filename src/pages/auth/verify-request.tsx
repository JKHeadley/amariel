import { useSession } from 'next-auth/react';
import { useRouter } from 'next/router';
import { useTheme } from '@/styles/ThemeProvider';
import LoadingIndicator from '@/components/LoadingIndicator';
import { Logo } from '@/components/Logo';
import { siteConfig } from '@/config/siteConfig';

export default function VerifyRequest() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const theme = useTheme();

  if (status === 'loading') {
    return <LoadingIndicator />;
  }

  if (session) {
    router.push('/');
    return null;
  }

  return (
    <div className={`min-h-screen flex items-center justify-center bg-gradient-to-b ${siteConfig.backgroundGradientFrom} ${siteConfig.backgroundGradientVia} ${siteConfig.backgroundGradientTo} py-12 px-4 sm:px-6 lg:px-8`}>
      <div className="max-w-md w-full space-y-8">
        <div>
          <h1 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
            {siteConfig.verifyRequest.title}
          </h1>
          <p className="mt-2 text-center text-sm text-gray-600">
            {siteConfig.verifyRequest.subtitle}
          </p>
        </div>
        <div className="bg-white shadow-md rounded-lg px-8 pt-6 pb-8 mb-4">
          <p className="text-center mb-4 text-gray-700">
            {siteConfig.verifyRequest.description}
          </p>
          <p className="text-center text-sm text-gray-500">
            {siteConfig.verifyRequest.spamNote}
          </p>
        </div>
        <p className={`text-center ${siteConfig.quoteTextSize} text-gray-500`}>
          {siteConfig.verifyRequest.quote}
        </p>
      </div>
    </div>
  );
} 