export default function ConfiguracoesFiliaisPage() {
  return (
    <div className="space-y-6 max-w-6xl mx-auto py-10">
      <div className="rounded-2xl border bg-white p-6 shadow-sm">
        <h1 className="text-3xl font-bold">Filiais</h1>
        <p className="mt-2 text-muted-foreground">
          Cadastro de filiais e controle de operações por unidade.
        </p>
      </div>

      <section className="rounded-2xl border bg-white p-6 shadow-sm">
        <h2 className="text-xl font-semibold">Campos</h2>
        <ul className="mt-4 grid gap-2 md:grid-cols-2 text-sm text-slate-600">
          <li>Nome filial</li>
          <li>CNPJ</li>
          <li>Código interno</li>
          <li>Responsável</li>
          <li>Telefone</li>
          <li>Endereço</li>
          <li>Estoque separado</li>
          <li>Financeiro separado</li>
          <li>PDV separado</li>
        </ul>
      </section>
    </div>
  )
}
