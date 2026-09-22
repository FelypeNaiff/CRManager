import type {Metadata} from 'next';
import { Poppins } from 'next/font/google';
import './globals.css';
import { Toaster } from "@/components/ui/toaster";

import { ProfileProvider } from '@/lib/contexts/profile-context';
import { PermissionsProvider } from '@/hooks/use-permissions';

const poppins = Poppins({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  display: 'swap',
  variable: '--font-poppins',
});

export const metadata: Metadata = {
  title: 'NEEX - Sistema de Gestão de Vendas',
  description: 'Sistema de gestão completo para varejo.',
  applicationName: 'NEEX',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR" className={poppins.variable}>
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
