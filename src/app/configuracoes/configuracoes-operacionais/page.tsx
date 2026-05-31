import OperationalSettingsForm from '@/components/configuracoes/operational-settings-form';

export const metadata = {
  title: 'Configurações Operacionais - NEEX',
  description: 'Gerencie as regras operacionais, limites e parâmetros do sistema.',
};

export default function ConfiguracoesOperacionaisPage() {
  return <OperationalSettingsForm />;
}
