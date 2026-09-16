import { requirePermission } from '@/lib/auth/permissions';
import { FinancialBackendGap } from '@/components/financial/backend-gap';
export default async function TransfersPage(){await requirePermission('FINANCEIRO','VIEW');return <FinancialBackendGap title="Transferências" description="Não existe operação atômica canônica para débito e crédito entre duas BankAccounts. FinancialTransaction isolada não substitui essa regra sem risco de inconsistência."/>;}
