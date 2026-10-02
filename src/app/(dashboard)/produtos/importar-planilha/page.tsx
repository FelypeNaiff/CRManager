"use client"

import { useState, useRef } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Package, UploadCloud, X, Check, AlertCircle, Loader2 } from "lucide-react"
import { toast } from "@/hooks/use-toast"
import { confirmProductImportBatchAction, createProductImportPreviewAction, getProductImportBatchAction, processProductImportBatchAction } from "@/lib/imports/product-import-actions"
import * as XLSX from "xlsx"

export default function ImportarPlanilhaPage() {
  const router = useRouter()
  const fileInputRef = useRef<HTMLInputElement>(null)
  
  const [file, setFile] = useState<File | null>(null)
  const [isImporting, setIsImporting] = useState(false)
  const [batch, setBatch] = useState<any>(null)
  const [sheetNames, setSheetNames] = useState<string[]>([])
  const [sheetName, setSheetName] = useState("")
  const [headers, setHeaders] = useState<string[]>([])
  const [decimalFormat, setDecimalFormat] = useState<'BR' | 'DOT'>('BR')
  const [existingPolicy, setExistingPolicy] = useState<'UPDATE' | 'IGNORE' | 'CREATE'>('UPDATE')
  const [mapping, setMapping] = useState<Record<string, number>>({})

  const colunasPadrao = [
    "Código",
    "Qtd. Estoque",
    "Nome do produto *",
    "Preço de compra",
    "Preço de venda",
    "Código de barras (GTIN/EAN)",
    "Unidade",
    "NCM",
    "Grupo do Produto",
    "Tamanho",
    "Cor",
    "FORNECEDOR",
    "SKU"
  ]

  const fornecedorHeadersPadrao = [
    "Nome do Fornecedor *",
    "CNPJ / CPF",
    "WhatsApp",
    "Telefone",
    "E-mail",
    "Site",
    "Instagram",
    "CEP",
    "Cidade",
    "Estado",
    "Endereço",
    "Observações",
    "Produtos que vende",
    "Gênero"
  ]

  const baixarPlanilhaPadrao = () => {
    const wsProdutos = XLSX.utils.aoa_to_sheet([colunasPadrao])
    const wsFornecedores = XLSX.utils.aoa_to_sheet([fornecedorHeadersPadrao])
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, wsProdutos, "Produtos")
    XLSX.utils.book_append_sheet(wb, wsFornecedores, "Fornecedores")
    XLSX.writeFile(wb, "planilha_padrao_produtos.xlsx")
  }

  const loadSheet = (selectedFile: File, selectedSheet?: string) => selectedFile.arrayBuffer().then(data => {
    const workbook = XLSX.read(data, { cellFormula: true })
    const name = selectedSheet && workbook.Sheets[selectedSheet] ? selectedSheet : workbook.SheetNames[0]
    const rows = XLSX.utils.sheet_to_json<unknown[]>(workbook.Sheets[name], { header: 1, raw: true, defval: undefined })
    const nextHeaders = (rows[0] ?? []).map(value => String(value ?? '').trim())
    const normalized = nextHeaders.map(value => value.toLocaleLowerCase('pt-BR').normalize('NFD').replace(/[\u0300-\u036f]/g, ''))
    const find = (...names: string[]) => normalized.findIndex(value => names.includes(value))
    setSheetNames(workbook.SheetNames); setSheetName(name); setHeaders(nextHeaders)
    setMapping({ internalCode: find('codigo', 'codigo interno'), sku: find('sku'), barcode: find('codigo de barras (gtin/ean)', 'codigo de barras', 'gtin', 'ean'),
      name: find('nome do produto *', 'nome do produto'), cost: find('preco de compra', 'custo'), price: find('preco de venda'),
      quantity: find('qtd. estoque', 'quantidade em estoque'), unit: find('unidade'), ncm: find('ncm'), category: find('grupo do produto'), supplier: find('fornecedor') })
  })

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const selectedFile = e.target.files[0]
      if (selectedFile.size > 2 * 1024 * 1024) {
        toast({ variant: "destructive", title: "Erro", description: "O tamanho do arquivo excede o limite de 2MB." })
        return
      }
      setFile(selectedFile)
      setBatch(null)
      await loadSheet(selectedFile)
    }
  }

  const handleImportar = async () => {
    if (!file) {
      toast({ variant: "destructive", title: "Erro", description: "Por favor, selecione um arquivo para importar." })
      return
    }

    setIsImporting(true)
    setBatch(null)

    try {
      const authoritativeRequest = new FormData()
      authoritativeRequest.set('file', file)
      authoritativeRequest.set('sheetName', sheetName)
      authoritativeRequest.set('mapping', JSON.stringify(mapping))
      authoritativeRequest.set('existingPolicy', existingPolicy)
      authoritativeRequest.set('stockPolicy', 'NONE')
      authoritativeRequest.set('decimalFormat', decimalFormat)
      const authoritativeResult = await createProductImportPreviewAction(authoritativeRequest)
      setBatch(await getProductImportBatchAction(authoritativeResult.batchId))
      toast({
        title: authoritativeResult.errorRows ? 'Prévia criada com bloqueios' : 'Prévia criada',
        description: `Lote ${authoritativeResult.batchId}: ${authoritativeResult.errorRows ?? 0} linha(s) bloqueada(s).`,
        variant: authoritativeResult.errorRows ? 'destructive' : 'default',
      })
    } catch (error: any) {
      console.error(error)
      toast({ variant: "destructive", title: "Erro", description: error.message || "Erro no processamento do arquivo." })
    } finally {
      setIsImporting(false)
    }
  }

  const refreshBatch = async () => { if (batch?.id) setBatch(await getProductImportBatchAction(batch.id)) }
  const confirmAndProcess = async () => {
    if (!batch?.id) return
    setIsImporting(true)
    try {
      await confirmProductImportBatchAction(batch.id)
      setBatch(await processProductImportBatchAction(batch.id, 100))
    } catch (error: any) { toast({ variant: 'destructive', title: 'Falha no processamento', description: error.message }) }
    finally { setIsImporting(false) }
  }

  return (
    <div className="space-y-4 max-w-full overflow-hidden">
      {/* Breadcrumb */}
      <div className="flex justify-end text-[11px] text-muted-foreground uppercase tracking-wider mb-2">
        <span className="cursor-pointer hover:underline" onClick={() => router.push('/')}>Início</span>
        <span className="mx-2">-</span>
        <span className="cursor-pointer hover:underline" onClick={() => router.push('/produtos')}>Produtos</span>
        <span className="mx-2">-</span>
        <span className="font-semibold text-foreground">Importar</span>
      </div>

      {/* Header */}
      <div className="border-b pb-2 mb-4">
        <h1 className="text-xl font-headline font-bold text-foreground flex items-center gap-2">
          <Package className="h-5 w-5 text-sidebar-foreground" /> Importar produtos
        </h1>
      </div>

      <div className="bg-white border rounded-sm shadow-sm overflow-hidden text-sm">
        <div className="flex flex-col md:flex-row border-b">
          
          {/* Lado Esquerdo - Upload */}
          <div className="p-6 md:w-1/2 md:border-r space-y-6">
            <div className="bg-amber-50 text-amber-800 p-3 rounded border border-amber-200 flex justify-between items-start">
              <span className="text-sm">Selecione um arquivo .xlsx do seu computador.</span>
              {file && <button onClick={() => setFile(null)} className="text-amber-800 hover:text-amber-900"><X className="h-4 w-4" /></button>}
            </div>

            <div className="space-y-3">
              <p className="text-muted-foreground text-xs">(Até 1000 itens na planilha ou 2MB no tamanho do arquivo)</p>
              
              <input 
                type="file" 
                accept=".xlsx" 
                className="hidden" 
                ref={fileInputRef} 
                onChange={handleFileChange}
              />
              
              {!file ? (
                <Button 
                  onClick={() => fileInputRef.current?.click()} 
                  className="bg-slate-900 hover:bg-slate-800 text-white rounded-sm px-6 h-10"
                >
                  <UploadCloud className="h-4 w-4 mr-2" />
                  Selecione um arquivo
                </Button>
              ) : (
                <div className="flex items-center gap-2 p-3 bg-gray-50 border rounded-sm">
                  <FileExcelIcon className="h-6 w-6 text-green-600" />
                  <span className="font-medium truncate flex-1">{file.name}</span>
                  <span className="text-xs text-muted-foreground">{(file.size / 1024).toFixed(0)} KB</span>
                </div>
              )}
            </div>

            {file && <div className="grid grid-cols-2 gap-3 text-xs">
              <label>Aba<select className="mt-1 w-full border p-2" value={sheetName} onChange={async e => { setSheetName(e.target.value); await loadSheet(file, e.target.value) }}>{sheetNames.map(name => <option key={name}>{name}</option>)}</select></label>
              <label>Formato decimal<select className="mt-1 w-full border p-2" value={decimalFormat} onChange={e => setDecimalFormat(e.target.value as 'BR'|'DOT')}><option value="BR">1.234,56</option><option value="DOT">1234.56</option></select></label>
              <label>Registros existentes<select className="mt-1 w-full border p-2" value={existingPolicy} onChange={e => setExistingPolicy(e.target.value as any)}><option value="UPDATE">Atualizar</option><option value="IGNORE">Ignorar</option><option value="CREATE">Somente criar</option></select></label>
              {(['internalCode','sku','barcode','name','cost','price','quantity','unit','ncm','supplier'] as const).map(field => <label key={field}>{field}<select className="mt-1 w-full border p-2" value={mapping[field] ?? -1} onChange={e => setMapping(current => ({...current,[field]:Number(e.target.value)}))}><option value={-1}>Não mapear</option>{headers.map((header,index)=><option key={index} value={index}>{header || `Coluna ${index+1}`}</option>)}</select></label>)}
            </div>}

            {batch && (() => { const rows=batch.rows ?? []; const apt=rows.filter((r:any)=>r.status==='READY').length; const blocked=rows.filter((r:any)=>['BLOCKED','FAILED','CONFLICT'].includes(r.status)).length; const ignored=rows.filter((r:any)=>r.status==='IGNORED').length; return (
              <div className={`p-4 rounded-sm border ${blocked ? 'bg-red-50 border-red-200' : 'bg-green-50 border-green-200'}`}>
                <h3 className="font-bold mb-2 flex items-center gap-2">
                  {blocked ? <AlertCircle className="h-4 w-4 text-red-600" /> : <Check className="h-4 w-4 text-green-600" />}
                  Resultado da prévia
                </h3>
                <p className="text-xs break-all">Lote: {batch.id} · Estado: {batch.status}</p>
                <p className="text-sm">Total: {rows.length} · Aptas: {apt} · Bloqueadas: {blocked} · Ignoradas: {ignored} · Concluídas: {batch.completedRows ?? 0}</p>
                <div className="mt-3 max-h-64 overflow-auto"><table className="w-full text-xs"><thead><tr><th>Linha</th><th>Ação</th><th>Alvo</th><th>Estado</th><th>Erros</th></tr></thead><tbody>{rows.map((row:any)=><tr key={row.id} className="border-t"><td>{row.rowNumber}</td><td>{row.proposedAction}</td><td>{row.previewData?.target?.sku ?? row.previewData?.target?.internalCode ?? 'Novo'}</td><td>{row.status}</td><td>{Array.isArray(row.errors)?row.errors.join(' '):''}</td></tr>)}</tbody></table></div>
                <div className="mt-3 flex gap-2"><Button size="sm" onClick={confirmAndProcess} disabled={isImporting || !['READY','FAILED_RECOVERABLE','PROCESSING'].includes(batch.status)}>Confirmar e processar</Button><Button size="sm" variant="outline" onClick={refreshBatch}>Atualizar resultado</Button></div>
              </div>
            )})()}
          </div>

          {/* Lado Direito - Instruções */}
          <div className="p-6 md:w-1/2 space-y-4">
            <h2 className="text-xl font-headline font-semibold text-gray-800">Importação dos produtos</h2>
            
            <div className="space-y-4 text-gray-600 leading-relaxed">
              <p>Selecione o arquivo Excel no formato .xlsx com os dados dos seus produtos e importe no NEEX.</p>
              
              <p>Se preferir <button onClick={baixarPlanilhaPadrao} className="text-primary font-medium hover:underline">baixe nossa planilha padrão</button>, preencha com seus dados e envie para o sistema.</p>
              
              <p>A prévia não altera produtos nem estoque. Revise as linhas e confirme o lote para iniciar o processamento.</p>
            </div>
          </div>
        </div>

        {/* Botões do Rodapé */}
        <div className="p-4 bg-gray-50 flex gap-2">
          <Button 
            className="btn-erp-green rounded-sm px-6 font-medium" 
            onClick={handleImportar}
            disabled={!file || isImporting}
          >
            {isImporting ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Check className="h-4 w-4 mr-2" />}
            {isImporting ? "Validando..." : "Gerar prévia"}
          </Button>
          <Button 
            variant="destructive" 
            className="rounded-sm px-6 font-medium bg-red-500 hover:bg-red-600"
            onClick={() => {
              setFile(null)
              setBatch(null)
              if (fileInputRef.current) fileInputRef.current.value = ''
            }}
            disabled={isImporting}
          >
            <X className="h-4 w-4 mr-2" />
            Cancelar
          </Button>
        </div>
      </div>
    </div>
  )
}

function FileExcelIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      {...props}
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" />
      <polyline points="14 2 14 8 20 8" />
      <path d="M8 13h2" />
      <path d="M8 17h2" />
      <path d="M14 13h2" />
      <path d="M14 17h2" />
    </svg>
  )
}
