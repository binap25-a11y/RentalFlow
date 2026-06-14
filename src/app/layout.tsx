import type {Metadata, Viewport} from 'next';
import './globals.css';
import { Toaster } from "@/components/ui/toaster";
import { FirebaseClientProvider } from '@/firebase';

const BRAND_ICON = 'https://images.unsplash.com/photo-1560518883-ce09059eeffa?q=80&w=512&h=512&auto=format&fit=crop';

/**
 * 🔐 Global Metadata Registry
 * Optimized for Google Play Store (TWA) and high-fidelity native feeling.
 */
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

/**
 * 📱 Native-Grade Viewport Configuration
 * Prevents elastic scaling and optimizes for hardware notches/status bars.
 */
export const viewport: Viewport = {
  themeColor: '#1e3a8a',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: 'cover',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Space+Grotesk:wght@500;600;700&display=swap" rel="stylesheet" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        {/* ZERO-FLICKER THEME & PWA ENGINE */}
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                try {
                  // 1. Theme Orchestration
                  var theme = localStorage.getItem('theme');
                  var supportDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
                  if (theme === 'dark' || (!theme && supportDark)) {
                    document.documentElement.classList.add('dark');
                    document.documentElement.style.background = '#020617';
                  } else {
                    document.documentElement.classList.remove('dark');
                    document.documentElement.style.background = '#ffffff';
                  }
                  
                  // 2. Service Worker Registration (NATIVE-FEEL)
                  if ('serviceWorker' in navigator) {
                    window.addEventListener('load', function() {
                      navigator.serviceWorker.register('/sw.js').catch(function(err) {
                        console.log('SW registration skipped:', err);
                      });
                    });
                  }
                } catch (e) {}
              })();
            `,
          }}
        />
      </head>
      <body className="font-body antialiased min-h-screen bg-background text-foreground transition-colors duration-300 overflow-x-hidden">
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
