import { redirect } from 'next/navigation'
import { resolveBaseServerAuthContext } from '@/lib/auth/server-auth-context'
import { requireProfileSelectionIdentity } from '@/lib/auth/profile-selection-access'
import { ProfileSelectionClient } from './profile-selection-client'

export default async function SelecionarPerfilPage() {
  const identity = await requireProfileSelectionIdentity(
    resolveBaseServerAuthContext,
    () => redirect('/login')
  )

  return <ProfileSelectionClient authenticatedEmail={identity.email} />
}
