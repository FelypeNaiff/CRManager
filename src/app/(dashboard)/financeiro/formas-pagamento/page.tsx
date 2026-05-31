import { redirect } from 'next/navigation'

export default function FinanceiroFormasPagamentoPage() {
  redirect('/financeiro/opcoes-auxiliares?tab=payment_methods')
}
