import { redirect } from 'next/navigation'

export default function VendedoresRedirectPage() {
  redirect('/configuracoes/usuarios?tab=usuarios')
}
