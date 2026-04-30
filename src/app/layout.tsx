import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'BaldeCash · SAE',
  description: 'Plataforma de gestión, metas y comisiones del equipo SAE — BaldeCash.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&family=Fraunces:opsz,wght@9..144,500;9..144,600;9..144,700;9..144,800&family=JetBrains+Mono:wght@400;500;600;700&display=swap"
        />
      </head>
      <body className="min-h-screen text-ink antialiased">{children}</body>
    </html>
  );
}
