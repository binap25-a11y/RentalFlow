import type {Metadata, Viewport} from 'next';
import './globals.css';
import { Toaster } from "@/components/ui/toaster";
import { FirebaseClientProvider } from '@/firebase';

const BRAND_ICON = 'https://images.unsplash.com/photo-1560518883-ce09059eeffa?q=80&w=512&h=512&auto=format&fit=crop';

export const metadata: Metadata = {
  title: 'RentalFlow | Premium Property Management',
  description: 'Streamline property management and tenant requests with AI-powered triage and structured reports.',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'RentalFlow',
  },
  formatDetection: {
    telephone: true,
  },
  icons: {
    icon: BRAND_ICON,
    shortcut: BRAND_ICON,
    apple: BRAND_ICON,
  },
};

export const viewport: Viewport = {
  themeColor: '#1e3a8a',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.Value;
}>) {
  return (
    <html lang="en" suppressHydrationWarning className="bg-background">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Space+Grotesk:wght@500;600;700&display=swap" rel="stylesheet" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <script
          dangerouslySetInnerHTML={{
            __html: `
              try {
                const theme = localStorage.getItem('theme');
                const supportDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
                if (theme === 'dark' || (!theme && supportDark)) {
                  document.documentElement.classList.add('dark')
                } else {
                  document.documentElement.classList.remove('dark')
                }
              } catch (_) {}
            `,
          }}
        />
      </head>
      <body className="font-body antialiased min-h-screen bg-background text-foreground transition-colors duration-300">
        <FirebaseClientProvider>
          <div className="relative flex min-h-screen flex-col">
            {children}
          </div>
          <Toaster />
        </FirebaseClientProvider>
      </body>
    </html>
  );
}