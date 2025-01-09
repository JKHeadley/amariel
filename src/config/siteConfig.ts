export const siteConfig = {
  name: "Dashboard",
  title: "Sign in to Dashboard",
  description: "Access your admin controls",
  signinTitle: "Sign in to Dashboard",
  signinSubtitle: "Access your admin controls",
  signinCreditsMessage: "Sign up now and receive <strong>5 free credits</strong> to get started!",
  signinQuote: "Secure and streamlined access to your management tools",
  quoteTextSize: "text-sm",
  backgroundGradientFrom: 'from-pink-50',
  backgroundGradientVia: 'via-white',
  backgroundGradientTo: 'to-purple-50',
  verifyRequest: {
    title: 'Check your email',
    subtitle: 'A sign in link has been sent to your email address',
    description: 'Click the link in the email to sign in to your account. If you don\'t see it, check your spam folder.',
    spamNote: 'The email might take a few minutes to arrive. Make sure to check your spam folder.',
    quote: '"The journey of a thousand miles begins with a single email verification."'
  }
} as const; 