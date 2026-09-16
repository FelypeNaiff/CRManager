import { requirePermission } from '@/lib/auth/permissions';
import { FinancialBackendGap } from '@/components/financial/backend-gap';
export default async function PayablesPage(){await requirePermission('FINANCEIRO','VIEW');return <FinancialBackendGap title="Contas a pagar" description="O schema atual não possui um modelo canônico de contas a pagar. É necessária uma etapa própria de modelagem, migration e regras de liquidação antes de habilitar esta tela."/>;}
