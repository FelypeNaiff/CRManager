import type {Metadata} from 'next';
import './globals.css';
import { Toaster } from "@/components/ui/toaster";

import { ProfileProvider } from '@/lib/contexts/profile-context';
import { PermissionsProvider } from '@/hooks/use-permissions';

export const metadata: Metadata = {
  title: 'NEEX - Sistema de Gestão de Vendas',
  description: 'Sistema de gestão completo para varejo.',
  applicationName: 'NEEX',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNãode;
}>) {
  return (
    <html lang="pt-BR">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet" />
      </head>
      <body className="font-body antialiased selection:bg-primary/20">
        <ProfileProvider>
          <PermissionsProvider>
            {children}
            <Toaster />
          </PermissionsProvider>
        </ProfileProvider>
      </body>
    </html>
  );
}
