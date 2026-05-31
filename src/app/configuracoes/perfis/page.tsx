import { redirect } from 'next/navigation'

export default function PerfisRedirectPage() {
  redirect('/configuracoes/usuarios?tab=perfis')
}
