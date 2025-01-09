import { SessionProvider } from 'next-auth/react';
import type { AppProps } from 'next/app';
import '@/styles/globals.css';
import { ThemeProvider } from '@/styles/ThemeProvider';
import { Inter } from "next/font/google";

const inter = Inter({ subsets: ["latin"] });

export default function App({ Component, pageProps: { session, ...pageProps } }: AppProps) {
  return (
    <SessionProvider session={session}>
      <ThemeProvider>
        <main className={inter.className}>
          <Component {...pageProps} />
        </main>
      </ThemeProvider>
    </SessionProvider>
  );
}