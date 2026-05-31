import { redirect } from 'next/navigation'

export default function CRMClientesComSaldoPage() {
  redirect('/crm/carteira?filter=com-saldo')
}
