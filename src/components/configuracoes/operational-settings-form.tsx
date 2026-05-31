'use client';

import React, { useEffect, useState } from 'react';
import { useToast } from '@/hooks/use-toast';
import { getOperationalSettingsAction, updateOperationalSettingsAction } from '@/lib/configuracoes/operational-settings-actions';
import {
  ConfigPageHeader,
  ConfigCardSection,
  ConfigInputField,
  ConfigFormActions,
  ConfigSelectField,
  ConfigSwitchField,
  ConfigTabs,
  ConfigTabsList,
  ConfigTabsTrigger,
  ConfigTabsContent,
} from './config-ui';
import { 
  Percent, 
  Store, 
  Package, 
  Printer, 
  CreditCard, 
  Award, 
  Loader2, 
  SlidersHorizontal 
} from 'lucide-react';

export default function OperationalSettingsForm() {
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [activeTab, setActiveTab] = useState('descontos');

  const [form, setForm] = useState({
    allowDiscount: true,
    sellerDiscountLimit: 5,
    managerDiscountLimit: 10,
    adminDiscountLimit: 100,
    requireAuthorizationAboveLimit: true,

    requireOpenCashRegister: true,
    requireCloseCashRegister: true,
    allowCashWithdrawal: true,
    allowCashSupply: true,

    allowSaleWithoutCustomer: true,
    requireCustomerOnSale: false,
    allowNegativeStock: false,
    reserveStockOnDraftSale: false,
    allowSaleCancellation: true,
    requireAuthorizationToCancelSale: true,
    cancellationTimeLimit: 30,

    autoPrintReceipt: false,
    enableThermalPrinter: false,
    receiptModel: 'simples',

    defaultPixKey: '',
    maxInstallments: 1,
    defaultInterestRate: 0,

    enableCommissions: true,
    defaultCommissionRate: 0,
    enableSellerGoals: true,

    enableCustomerWallet: true,
    walletExpirationDays: '',
    allowPartialWalletUsage: true,
  });

  useEffect(() => {
    async function loadSettings() {
      try {
        const response = await getOperationalSettingsAction();
        if (response.success && response.data) {
          const s = response.data;
          setForm({
            allowDiscount: s.allowDiscount,
            sellerDiscountLimit: Number(s.sellerDiscountLimit),
            managerDiscountLimit: Number(s.managerDiscountLimit),
            adminDiscountLimit: Number(s.adminDiscountLimit),
            requireAuthorizationAboveLimit: s.requireAuthorizationAboveLimit,
            requireOpenCashRegister: s.requireOpenCashRegister,
            requireCloseCashRegister: s.requireCloseCashRegister,
            allowCashWithdrawal: s.allowCashWithdrawal,
            allowCashSupply: s.allowCashSupply,
            allowSaleWithoutCustomer: s.allowSaleWithoutCustomer,
            requireCustomerOnSale: s.requireCustomerOnSale,
            allowNegativeStock: s.allowNegativeStock,
            reserveStockOnDraftSale: s.reserveStockOnDraftSale,
            allowSaleCancellation: s.allowSaleCancellation ?? true,
            requireAuthorizationToCancelSale: s.requireAuthorizationToCancelSale ?? true,
            cancellationTimeLimit: s.cancellationTimeLimit ?? 30,
            autoPrintReceipt: s.autoPrintReceipt,
            enableThermalPrinter: s.enableThermalPrinter,
            receiptModel: s.receiptModel || 'simples',
            defaultPixKey: s.defaultPixKey || '',
            maxInstallments: s.maxInstallments || 1,
            defaultInterestRate: Number(s.defaultInterestRate || 0),
            enableCommissions: s.enableCommissions,
            defaultCommissionRate: Number(s.defaultCommissionRate || 0),
            enableSellerGoals: s.enableSellerGoals,
            enableCustomerWallet: s.enableCustomerWallet ?? true,
            walletExpirationDays: s.walletExpirationDays ? String(s.walletExpirationDays) : '',
            allowPartialWalletUsage: s.allowPartialWalletUsage ?? true,
          });
        } else {
          toast({
            title: 'Aviso',
            description: response.error || 'Não foi possível carregar as configurações.',
            variant: 'destructive',
          });
        }
      } catch (err: any) {
        toast({
          title: 'Erro',
          description: 'Erro de comunicação ao buscar configurações operacionais.',
          variant: 'destructive',
        });
      } finally {
        setIsLoading(false);
      }
    }

    loadSettings();
  }, [toast]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);

    try {
      const res = await updateOperationalSettingsAction(form);
      if (res.success) {
        toast({
          title: 'Sucesso',
          description: 'Configurações operacionais e PDV atualizadas com sucesso.',
        });
      } else {
        toast({
          title: 'Erro ao Salvar',
          description: res.error || 'Ocorreu um erro ao salvar as configurações.',
          variant: 'destructive',
        });
      }
    } catch (err: any) {
      toast({
        title: 'Erro',
        description: 'Erro de comunicação ao salvar configurações.',
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex h-64 w-full flex-col items-center justify-center gap-2">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <span className="text-sm text-muted-foreground">Carregando configurações operacionais...</span>
      </div>
    );
  }

  return (
    <div className="max-w-5xl space-y-6 pb-20">
      <ConfigPageHeader
        title="Configurações Operacionais e PDV"
        description="Gerencie regras operacionais de frente de caixa, políticas de descontos, estoque, comissões e métodos de pagamento do NEEX."
        breadcrumb={[
          { label: 'Configurações', href: '/configuracoes' },
          { label: 'Configurações Operacionais e PDV' },
        ]}
      />

      <form onSubmit={handleSave} className="space-y-6">
        <ConfigTabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <ConfigTabsList className="grid grid-cols-2 md:grid-cols-6 h-auto p-1.5 gap-1.5 bg-slate-100 rounded-xl mb-6">
            <ConfigTabsTrigger value="descontos" className="py-2.5 flex items-center justify-center gap-1.5 text-xs font-semibold rounded-lg data-[state=active]:bg-white data-[state=active]:shadow-sm">
              <Percent className="h-3.5 w-3.5" />
              Descontos
            </ConfigTabsTrigger>
            <ConfigTabsTrigger value="caixa" className="py-2.5 flex items-center justify-center gap-1.5 text-xs font-semibold rounded-lg data-[state=active]:bg-white data-[state=active]:shadow-sm">
              <Store className="h-3.5 w-3.5" />
              Caixa
            </ConfigTabsTrigger>
            <ConfigTabsTrigger value="vendas" className="py-2.5 flex items-center justify-center gap-1.5 text-xs font-semibold rounded-lg data-[state=active]:bg-white data-[state=active]:shadow-sm">
              <Package className="h-3.5 w-3.5" />
              Vendas/Estoque
            </ConfigTabsTrigger>
            <ConfigTabsTrigger value="impressao" className="py-2.5 flex items-center justify-center gap-1.5 text-xs font-semibold rounded-lg data-[state=active]:bg-white data-[state=active]:shadow-sm">
              <Printer className="h-3.5 w-3.5" />
              Impressão
            </ConfigTabsTrigger>
            <ConfigTabsTrigger value="pagamentos" className="py-2.5 flex items-center justify-center gap-1.5 text-xs font-semibold rounded-lg data-[state=active]:bg-white data-[state=active]:shadow-sm">
              <CreditCard className="h-3.5 w-3.5" />
              Pagamentos
            </ConfigTabsTrigger>
            <ConfigTabsTrigger value="comissoes" className="py-2.5 flex items-center justify-center gap-1.5 text-xs font-semibold rounded-lg data-[state=active]:bg-white data-[state=active]:shadow-sm">
              <Award className="h-3.5 w-3.5" />
              Metas/Carteira
            </ConfigTabsTrigger>
          </ConfigTabsList>

          {/* Aba 1: Descontos */}
          <ConfigTabsContent value="descontos" className="space-y-6">
            <ConfigCardSection
              title="Políticas de Desconto e Autorizações"
              description="Ajuste os limites máximos de desconto permitidos para cada nível operacional."
              icon={Percent}
            >
              <div className="space-y-5">
                <ConfigSwitchField
                  label="Permitir Descontos em Vendas"
                  id="allowDiscount"
                  description="Ativa ou desativa a concessão de descontos no PDV e na criação de novas vendas."
                  checked={form.allowDiscount}
                  onCheckedChange={(checked) => setForm({ ...form, allowDiscount: checked })}
                />

                {form.allowDiscount && (
                  <>
                    <div className="grid gap-6 md:grid-cols-3 pt-2">
                      <ConfigInputField
                        label="Limite Desconto Vendedor (%)"
                        id="sellerDiscountLimit"
                        type="number"
                        min="0"
                        max="100"
                        step="0.01"
                        value={form.sellerDiscountLimit}
                        onChange={(e) => setForm({ ...form, sellerDiscountLimit: Number(e.target.value) })}
                        placeholder="Ex: 5"
                      />

                      <ConfigInputField
                        label="Limite Desconto Gerente (%)"
                        id="managerDiscountLimit"
                        type="number"
                        min="0"
                        max="100"
                        step="0.01"
                        value={form.managerDiscountLimit}
                        onChange={(e) => setForm({ ...form, managerDiscountLimit: Number(e.target.value) })}
                        placeholder="Ex: 10"
                      />

                      <ConfigInputField
                        label="Limite Desconto Administrador (%)"
                        id="adminDiscountLimit"
                        type="number"
                        min="0"
                        max="100"
                        step="0.01"
                        value={form.adminDiscountLimit}
                        onChange={(e) => setForm({ ...form, adminDiscountLimit: Number(e.target.value) })}
                        placeholder="Ex: 100"
                      />
                    </div>

                    <ConfigSwitchField
                      label="Solicitar PIN de Autorização acima do limite"
                      id="requireAuthorizationAboveLimit"
                      description="Se ativado, exige PIN de gerente/admin quando o desconto do vendedor excede o limite. Se desativado, o desconto acima do limite é bloqueado diretamente."
                      checked={form.requireAuthorizationAboveLimit}
                      onCheckedChange={(checked) => setForm({ ...form, requireAuthorizationAboveLimit: checked })}
                    />
                  </>
                )}
              </div>
            </ConfigCardSection>
          </ConfigTabsContent>

          {/* Aba 2: Caixa */}
          <ConfigTabsContent value="caixa" className="space-y-6">
            <ConfigCardSection
              title="Operações de Caixa (Frente de Loja)"
              description="Gerencie os bloqueios e exigências para abertura, fechamento e movimentações do caixa."
              icon={Store}
            >
              <div className="space-y-5">
                <ConfigSwitchField
                  label="Obrigar Abertura de Caixa para Vender"
                  id="requireOpenCashRegister"
                  description="Impeça vendas no PDV se não houver um caixa atualmente aberto para o usuário ou empresa."
                  checked={form.requireOpenCashRegister}
                  onCheckedChange={(checked) => setForm({ ...form, requireOpenCashRegister: checked })}
                />

                <ConfigSwitchField
                  label="Obrigar Fechamento de Caixa Diário"
                  id="requireCloseCashRegister"
                  description="Força o fechamento diário do caixa para conciliação financeira."
                  checked={form.requireCloseCashRegister}
                  onCheckedChange={(checked) => setForm({ ...form, requireCloseCashRegister: checked })}
                />

                <div className="grid gap-6 md:grid-cols-2 pt-2">
                  <ConfigSwitchField
                    label="Permitir Sangria de Caixa"
                    id="allowCashWithdrawal"
                    description="Permite que operadores de caixa façam retiradas de valores (Sangrias)."
                    checked={form.allowCashWithdrawal}
                    onCheckedChange={(checked) => setForm({ ...form, allowCashWithdrawal: checked })}
                  />

                  <ConfigSwitchField
                    label="Permitir Reforço de Caixa"
                    id="allowCashSupply"
                    description="Permite que operadores de caixa façam aportes de valores iniciais (Reforço/Suprimento)."
                    checked={form.allowCashSupply}
                    onCheckedChange={(checked) => setForm({ ...form, allowCashSupply: checked })}
                  />
                </div>
              </div>
            </ConfigCardSection>
          </ConfigTabsContent>

          {/* Aba 3: Vendas e Estoque */}
          <ConfigTabsContent value="vendas" className="space-y-6">
            <ConfigCardSection
              title="Políticas de Venda e Integração com Estoque"
              description="Ajuste o comportamento do estoque e a identificação do cliente no momento da venda."
              icon={Package}
            >
              <div className="space-y-5">
                <div className="grid gap-6 md:grid-cols-2">
                  <ConfigSwitchField
                    label="Permitir Venda sem Identificar Cliente"
                    id="allowSaleWithoutCustomer"
                    description="Se desativado, o operador é obrigado a associar um cliente cadastrado para fechar a venda."
                    checked={form.allowSaleWithoutCustomer}
                    onCheckedChange={(checked) => setForm({ 
                      ...form, 
                      allowSaleWithoutCustomer: checked,
                      requireCustomerOnSale: !checked ? true : form.requireCustomerOnSale
                    })}
                  />

                  <ConfigSwitchField
                    label="Cliente Obrigatório na Venda"
                    id="requireCustomerOnSale"
                    description="Força a seleção do cliente no PDV para fins fiscais ou cadastrais."
                    checked={form.requireCustomerOnSale}
                    onCheckedChange={(checked) => setForm({ 
                      ...form, 
                      requireCustomerOnSale: checked,
                      allowSaleWithoutCustomer: checked ? false : form.allowSaleWithoutCustomer
                    })}
                  />
                </div>

                <div className="grid gap-6 md:grid-cols-2">
                  <ConfigSwitchField
                    label="Permitir Vender sem Estoque (Estoque Negativo)"
                    id="allowNegativeStock"
                    description="Se ativado, o sistema permite concluir vendas mesmo que o saldo físico no sistema esteja zerado."
                    checked={form.allowNegativeStock}
                    onCheckedChange={(checked) => setForm({ ...form, allowNegativeStock: checked })}
                  />

                  <ConfigSwitchField
                    label="Reservar Estoque em Vendas Rascunho (Draft)"
                    id="reserveStockOnDraftSale"
                    description="Bloqueia temporariamente as quantidades de itens em carrinhos marcados como Rascunho."
                    checked={form.reserveStockOnDraftSale}
                    onCheckedChange={(checked) => setForm({ ...form, reserveStockOnDraftSale: checked })}
                  />
                </div>

                <div className="border-t pt-5 mt-4 space-y-4">
                  <h3 className="text-sm font-bold text-slate-700 uppercase tracking-wider">Regras de Cancelamento de Venda</h3>
                  <div className="grid gap-6 md:grid-cols-2">
                    <ConfigSwitchField
                      label="Permitir Cancelamento de Venda"
                      id="allowSaleCancellation"
                      description="Habilita a ação de estorno/cancelamento de vendas."
                      checked={form.allowSaleCancellation}
                      onCheckedChange={(checked) => setForm({ ...form, allowSaleCancellation: checked })}
                    />

                    <ConfigSwitchField
                      label="Exigir PIN para Cancelar Venda"
                      id="requireAuthorizationToCancelSale"
                      description="Exige validação do PIN de gerente/administrador para autorizar cancelamentos."
                      checked={form.requireAuthorizationToCancelSale}
                      onCheckedChange={(checked) => setForm({ ...form, requireAuthorizationToCancelSale: checked })}
                    />
                  </div>

                  <div className="w-1/2 pt-2">
                    <ConfigInputField
                      label="Tempo Limite para Cancelamento (Minutos)"
                      id="cancellationTimeLimit"
                      type="number"
                      min="0"
                      value={form.cancellationTimeLimit}
                      onChange={(e) => setForm({ ...form, cancellationTimeLimit: Number(e.target.value) })}
                      placeholder="Ex: 30"
                    />
                  </div>
                </div>
              </div>
            </ConfigCardSection>
          </ConfigTabsContent>

          {/* Aba 4: Impressão */}
          <ConfigTabsContent value="impressao" className="space-y-6">
            <ConfigCardSection
              title="Impressão de Comprovantes e Cupons"
              description="Ajuste as preferências de impressão automática de recibos para o cliente."
              icon={Printer}
            >
              <div className="space-y-5">
                <ConfigSwitchField
                  label="Imprimir Comprovante Automaticamente"
                  id="autoPrintReceipt"
                  description="Dispara o comando de impressão do navegador ou térmica ao finalizar a venda."
                  checked={form.autoPrintReceipt}
                  onCheckedChange={(checked) => setForm({ ...form, autoPrintReceipt: checked })}
                />

                <ConfigSwitchField
                  label="Habilitar Impressora Térmica Não-Fiscal (80mm)"
                  id="enableThermalPrinter"
                  description="Otimiza a visualização do comprovante para o formato clássico de rolo de bobina."
                  checked={form.enableThermalPrinter}
                  onCheckedChange={(checked) => setForm({ ...form, enableThermalPrinter: checked })}
                />

                <ConfigSelectField
                  label="Modelo de Comprovante"
                  id="receiptModel"
                  value={form.receiptModel}
                  onValueChange={(val) => setForm({ ...form, receiptModel: val })}
                  options={[
                    { label: 'Simples / Reduzido', value: 'simples' },
                    { label: 'Detalhado (Itens + Impostos)', value: 'detalhado' },
                    { label: 'Cupom Interno de Produção', value: 'cupom interno' },
                  ]}
                />
              </div>
            </ConfigCardSection>
          </ConfigTabsContent>

          {/* Aba 5: Pagamentos */}
          <ConfigTabsContent value="pagamentos" className="space-y-6">
            <ConfigCardSection
              title="Regras de Recebimentos e Parcelamento"
              description="Configure a chave PIX padrão da loja e juros padrão aplicáveis a parcelas."
              icon={CreditCard}
            >
              <div className="space-y-5">
                <ConfigInputField
                  label="Chave PIX Padrão para Recebimentos"
                  id="defaultPixKey"
                  value={form.defaultPixKey}
                  onChange={(e) => setForm({ ...form, defaultPixKey: e.target.value })}
                  placeholder="E-mail, CNPJ, Celular ou Chave Aleatória"
                  description="Utilizada para gerar QR Code de pagamentos imediatos se a chave principal da empresa não estiver preenchida."
                />

                <div className="grid gap-6 md:grid-cols-2 pt-2">
                  <ConfigInputField
                    label="Parcelamento Máximo Permitido (Vezes)"
                    id="maxInstallments"
                    type="number"
                    min="1"
                    value={form.maxInstallments}
                    onChange={(e) => setForm({ ...form, maxInstallments: Number(e.target.value) })}
                    placeholder="Ex: 12"
                  />

                  <ConfigInputField
                    label="Juros Padrão em Parcelamento (%)"
                    id="defaultInterestRate"
                    type="number"
                    min="0"
                    step="0.01"
                    value={form.defaultInterestRate}
                    onChange={(e) => setForm({ ...form, defaultInterestRate: Number(e.target.value) })}
                    placeholder="Ex: 1.99"
                  />
                </div>
              </div>
            </ConfigCardSection>
          </ConfigTabsContent>

          {/* Aba 6: Metas e Comissões */}
          <ConfigTabsContent value="comissoes" className="space-y-6">
            <ConfigCardSection
              title="Metas de Vendedores e Comissões Automáticas"
              description="Gerencie regras globais de comissionamento de vendas e acompanhamento de metas da equipe."
              icon={Award}
            >
              <div className="space-y-5">
                <ConfigSwitchField
                  label="Habilitar Comissões de Vendas"
                  id="enableCommissions"
                  description="Ativa o módulo de comissionamento. Se ativado, o sistema gera registros na tabela de comissões para vendas pagas."
                  checked={form.enableCommissions}
                  onCheckedChange={(checked) => setForm({ ...form, enableCommissions: checked })}
                />

                {form.enableCommissions && (
                  <ConfigInputField
                    label="Taxa de Comissão Padrão Global (%)"
                    id="defaultCommissionRate"
                    type="number"
                    min="0"
                    max="100"
                    step="0.01"
                    value={form.defaultCommissionRate}
                    onChange={(e) => setForm({ ...form, defaultCommissionRate: Number(e.target.value) })}
                    placeholder="Ex: 2.5"
                    description="Esta taxa é aplicada para vendedores que não possuem uma taxa personalizada configurada em seu cadastro."
                  />
                )}

                <ConfigSwitchField
                  label="Habilitar Acompanhamento de Metas de Vendedores"
                  id="enableSellerGoals"
                  description="Habilita o painel e os relatórios de atingimento de metas da equipe comercial."
                  checked={form.enableSellerGoals}
                  onCheckedChange={(checked) => setForm({ ...form, enableSellerGoals: checked })}
                />

                <div className="border-t pt-5 mt-4 space-y-4">
                  <h3 className="text-sm font-bold text-slate-700 uppercase tracking-wider">Configurações de Carteira e Crédito de Clientes</h3>
                  <ConfigSwitchField
                    label="Habilitar Carteira Digital de Clientes (Saldos/Créditos)"
                    id="enableCustomerWallet"
                    description="Permite que clientes acumulem saldos decorrentes de trocas e devoluções no CRM."
                    checked={form.enableCustomerWallet}
                    onCheckedChange={(checked) => setForm({ ...form, enableCustomerWallet: checked })}
                  />

                  {form.enableCustomerWallet && (
                    <div className="grid gap-6 md:grid-cols-2 pt-2">
                      <ConfigInputField
                        label="Validade dos Créditos (Dias)"
                        id="walletExpirationDays"
                        type="number"
                        min="1"
                        value={form.walletExpirationDays}
                        onChange={(e) => setForm({ ...form, walletExpirationDays: e.target.value })}
                        placeholder="Ex: 90 (Deixe em branco para ilimitado)"
                      />

                      <ConfigSwitchField
                        label="Permitir Uso de Saldo Parcial"
                        id="allowPartialWalletUsage"
                        description="Habilita o uso de uma parte do saldo na venda e pagamento do restante com outros meios."
                        checked={form.allowPartialWalletUsage}
                        onCheckedChange={(checked) => setForm({ ...form, allowPartialWalletUsage: checked })}
                      />
                    </div>
                  )}
                </div>
              </div>
            </ConfigCardSection>
          </ConfigTabsContent>
        </ConfigTabs>

        <div className="flex justify-end p-4 rounded-xl border bg-white shadow-sm">
          <ConfigFormActions isSaving={isSaving} saveLabel="Salvar Configurações" />
        </div>
      </form>
    </div>
  );
}
