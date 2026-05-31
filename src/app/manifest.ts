import type { MetadataRoute } from 'next'

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'NEEX - Sistema de Gestão de Vendas',
    short_name: 'NEEX',
    description: 'Sistema de gestão completo para varejo.',
    start_url: '/',
    display: 'standalone',
    background_color: '#F7F7F7',
    theme_color: '#2C4156',
    icons: [
      {
        src: '/favicon.ico',
        sizes: 'any',
        type: 'image/x-icon',
      },
    ],
  }
}
