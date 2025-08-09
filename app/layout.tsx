import './globals.css';
import type { Metadata } from 'next';
import AuthProvider from '@/components/AuthProvider';
import AuthHeader from '@/components/AuthHeader';

export const metadata: Metadata = {
  title: 'Tellari',
  description: 'Client portal',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <AuthProvider>
          <AuthHeader />
          {children}
        </AuthProvider>
      </body>
    </html>
  );
}