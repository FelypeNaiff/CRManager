import { requirePermission } from '@/lib/auth/permissions';
import { FinancialBackendGap } from '@/components/financial/backend-gap';
export default async function VouchersPage(){await requirePermission('FINANCEIRO','VIEW');return <FinancialBackendGap title="Vales de funcionários" description="A interface legada representava vales de funcionários. CustomerWallet é crédito de cliente/troca e não será reutilizada como uma segunda fonte de verdade para este domínio."/>;}
