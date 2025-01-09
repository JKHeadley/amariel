import { useRouter } from 'next/router';
import { useTheme } from '@/styles/ThemeProvider';

export default function ErrorPage() {
  const router = useRouter();
  const { error } = router.query;
  const theme = useTheme();

  let errorMessage = 'An error occurred during authentication.';
  let errorDescription = '';

  if (error === 'Callback') {
    errorMessage = 'Authentication process was interrupted';
    errorDescription = 'The sign-in process was canceled or interrupted. Please try again.';
  } else if (error === 'AccessDenied') {
    errorMessage = 'Access denied';
    errorDescription = 'You may not have permission to access this resource.';
  } else if (error === 'OAuthAccountNotLinked') {
    errorMessage = 'Account not linked';
    errorDescription = 'This email is already associated with another account. Please sign in using your original method.';
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-blue-50 to-pink-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        <div>
          <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
            Authentication Error
          </h2>
          <p className="mt-2 text-center text-sm text-gray-600">
            {errorMessage}
          </p>
          <p className="mt-2 text-center text-sm text-gray-600">
            {errorDescription}
          </p>
        </div>
        <div className="mt-6">
          <button
            onClick={() => router.push('/auth/signin')}
            className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-500 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
          >
            Return to Sign In
          </button>
        </div>
      </div>
    </div>
  );
} 