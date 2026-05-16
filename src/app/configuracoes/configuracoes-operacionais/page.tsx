"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"

export default function ConfiguracoesOperacionaisPage() {
  const [form, setForm] = useState({
    pdvAtivo: true,
    imprimirAutomaticamente: false,
    abrirCaixaObrigatorio: true,
    controleDesconto: true,
    descontoMaximo: "10",
    vendaSemEstoque: false,
    vendaNegativa: false,
    estoqueMinimoPadrao: "0",
    controlePorVariacao: true,
    controlePorGrade: true,
    reservarEstoqueVenda: false,
    atualizacaoAutomatica: true,
    cadastroFilhos: true,
    ativarTags: true,
    ativarAniversarios: false,
    ativarObservacoes: true,
    diasVencimento: "10",
    categoriaReceitas: "Venda",
    categoriaDespesas: "Despesas Gerais",
    fluxoAutomatico: true,
    gerarContasAutomaticamente: false,
  })

  return (
    <div className="space-y-6 max-w-6xl mx-auto py-10">
      <div className="rounded-2xl border bg-white p-6 shadow-sm flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-bold">Configurações Operacionais</h1>
          <p className="mt-2 text-muted-foreground">Ajuste o comportamento do PDV, estoque, CRM e financeiro.</p>
        </div>
        <Button className="bg-primary text-white">Salvar alterações</Button>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="rounded-2xl border bg-white p-6 shadow-sm">
          <h2 className="text-xl font-semibold mb-4">PDV</h2>
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <Switch checked={form.pdvAtivo} onCheckedChange={(checked) => setForm({ ...form, pdvAtivo: checked })} />
              <span>Ativar PDV</span>
            </div>
            <div className="flex items-center gap-3">
              <Switch checked={form.imprimirAutomaticamente} onCheckedChange={(checked) => setForm({ ...form, imprimirAutomaticamente: checked })} />
              <span>Imprimir automaticamente</span>
            </div>
            <div className="flex items-center gap-3">
              <Switch checked={form.abrirCaixaObrigatorio} onCheckedChange={(checked) => setForm({ ...form, abrirCaixaObrigatorio: checked })} />
              <span>Abrir caixa obrigatório</span>
            </div>
            <div className="flex items-center gap-3">
              <Switch checked={form.controleDesconto} onCheckedChange={(checked) => setForm({ ...form, controleDesconto: checked })} />
              <span>Controle de desconto</span>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="descontoMaximo">Desconto máximo padrão (%)</Label>
              <Input id="descontoMaximo" type="number" value={form.descontoMaximo} onChange={(e) => setForm({ ...form, descontoMaximo: e.target.value })} />
            </div>
            <div className="flex items-center gap-3">
              <Switch checked={form.vendaSemEstoque} onCheckedChange={(checked) => setForm({ ...form, vendaSemEstoque: checked })} />
              <span>Permitir venda sem estoque</span>
            </div>
            <div className="flex items-center gap-3">
              <Switch checked={form.vendaNegativa} onCheckedChange={(checked) => setForm({ ...form, vendaNegativa: checked })} />
              <span>Permitir venda negativa</span>
            </div>
          </div>
        </section>

        <section className="rounded-2xl border bg-white p-6 shadow-sm">
          <h2 className="text-xl font-semibold mb-4">Estoque</h2>
          <div className="space-y-4">
            <div className="grid gap-2">
              <Label htmlFor="estoqueMinimoPadrao">Estoque mínimo padrão</Label>
              <Input id="estoqueMinimoPadrao" value={form.estoqueMinimoPadrao} onChange={(e) => setForm({ ...form, estoqueMinimoPadrao: e.target.value })} />
            </div>
            <div className="flex items-center gap-3">
              <Switch checked={form.controlePorVariacao} onCheckedChange={(checked) => setForm({ ...form, controlePorVariacao: checked })} />
              <span>Controle por variação</span>
            </div>
            <div className="flex items-center gap-3">
              <Switch checked={form.controlePorGrade} onCheckedChange={(checked) => setForm({ ...form, controlePorGrade: checked })} />
              <span>Controle por grade</span>
            </div>
            <div className="flex items-center gap-3">
              <Switch checked={form.reservarEstoqueVenda} onCheckedChange={(checked) => setForm({ ...form, reservarEstoqueVenda: checked })} />
              <span>Reservar estoque em venda</span>
            </div>
            <div className="flex items-center gap-3">
              <Switch checked={form.atualizacaoAutomatica} onCheckedChange={(checked) => setForm({ ...form, atualizacaoAutomatica: checked })} />
              <span>Atualização automática</span>
            </div>
          </div>
        </section>

        <section className="rounded-2xl border bg-white p-6 shadow-sm">
          <h2 className="text-xl font-semibold mb-4">CRM</h2>
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <Switch checked={form.cadastroFilhos} onCheckedChange={(checked) => setForm({ ...form, cadastroFilhos: checked })} />
              <span>Ativar cadastro de filhos</span>
            </div>
            <div className="flex items-center gap-3">
              <Switch checked={form.ativarTags} onCheckedChange={(checked) => setForm({ ...form, ativarTags: checked })} />
              <span>Ativar tags</span>
            </div>
            <div className="flex items-center gap-3">
              <Switch checked={form.ativarAniversarios} onCheckedChange={(checked) => setForm({ ...form, ativarAniversarios: checked })} />
              <span>Ativar aniversários</span>
            </div>
            <div className="flex items-center gap-3">
              <Switch checked={form.ativarObservacoes} onCheckedChange={(checked) => setForm({ ...form, ativarObservacoes: checked })} />
              <span>Ativar observações internas</span>
            </div>
          </div>
        </section>

        <section className="rounded-2xl border bg-white p-6 shadow-sm">
          <h2 className="text-xl font-semibold mb-4">Financeiro</h2>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="grid gap-2">
              <Label htmlFor="diasVencimento">Dias padrão vencimento</Label>
              <Input id="diasVencimento" value={form.diasVencimento} onChange={(e) => setForm({ ...form, diasVencimento: e.target.value })} />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="categoriaReceitas">Categoria padrão receitas</Label>
              <Input id="categoriaReceitas" value={form.categoriaReceitas} onChange={(e) => setForm({ ...form, categoriaReceitas: e.target.value })} />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="categoriaDespesas">Categoria padrão despesas</Label>
              <Input id="categoriaDespesas" value={form.categoriaDespesas} onChange={(e) => setForm({ ...form, categoriaDespesas: e.target.value })} />
            </div>
            <div className="flex items-center gap-3">
              <Switch checked={form.fluxoAutomatico} onCheckedChange={(checked) => setForm({ ...form, fluxoAutomatico: checked })} />
              <span>Fluxo caixa automático</span>
            </div>
            <div className="flex items-center gap-3">
              <Switch checked={form.gerarContasAutomaticamente} onCheckedChange={(checked) => setForm({ ...form, gerarContasAutomaticamente: checked })} />
              <span>Gerar contas automaticamente</span>
            </div>
          </div>
        </section>
      </div>
    </div>
  )
}
