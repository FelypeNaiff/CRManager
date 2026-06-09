"use client"

import { useState, useRef } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Package, UploadCloud, X, Check, AlertCircle, Loader2 } from "lucide-react"
import { toast } from "@/hooks/use-toast"
import { importProductsAction } from "@/lib/sales/actions/import-products-action"
import * as XLSX from "xlsx"

export default function ImportarPlanilhaPage() {
  const router = useRouter()
  const fileInputRef = useRef<HTMLInputElement>(null)
  
  const [file, setFile] = useState<File | null>(null)
  const [isImporting, setIsImporting] = useState(false)
  const [importStatus, setImportStatus] = useState<{ total: number, success: number, errors: string[] } | null>(null)

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
    "Login do site",
    "Senha do site",
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

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const selectedFile = e.target.files[0]
      if (selectedFile.size > 2 * 1024 * 1024) {
        toast({ variant: "destructive", title: "Erro", description: "O tamanho do arquivo excede o limite de 2MB." })
        return
      }
      setFile(selectedFile)
      setImportStatus(null)
    }
  }

  const parseNumber = (val: any) => {
    if (!val) return 0
    if (typeof val === 'number') return val
    if (typeof val === 'string') {
      const parsed = parseFloat(val.replace(',', '.'))
      return isNaN(parsed) ? 0 : parsed
    }
    return 0
  }

  const handleImportar = async () => {
    if (!file) {
      toast({ variant: "destructive", title: "Erro", description: "Por favor, selecione um arquivo para importar." })
      return
    }

    setIsImporting(true)
    setImportStatus(null)

    try {
      const data = await file.arrayBuffer()
      const workbook = XLSX.read(data)
      const sheetNameProdutos = workbook.SheetNames.find(name => name?.toLowerCase().includes("produto")) || workbook.SheetNames[0]
      const worksheet = workbook.Sheets[sheetNameProdutos]
      const rows: any[] = XLSX.utils.sheet_to_json(worksheet, { header: 1 })

      if (rows.length <= 1) {
        toast({ variant: "destructive", title: "Erro", description: "Planilha vazia ou sem cabeçalhos." })
        setIsImporting(false)
        return
      }

      const headers: string[] = rows[0].map((h: any) => h?.toString().trim() || "")
      const dataRows = rows.slice(1).filter(r => r.length > 0 && r.some((c: any) => c !== undefined && c !== ""))

      if (dataRows.length > 1000) {
        toast({ variant: "destructive", title: "Erro", description: "O limite de importação é de 1000 linhas por vez." })
        setIsImporting(false)
        return
      }

      const idx = {
        codigo: headers.findIndex(h => h.toLowerCase().includes("código") && !h.toLowerCase().includes("barras")),
        estoque: headers.findIndex(h => h.toLowerCase().includes("estoque") || h.toLowerCase().includes("qtd")),
        nome: headers.findIndex(h => h.toLowerCase().includes("nome")),
        compra: headers.findIndex(h => h.toLowerCase().includes("compra") || h.toLowerCase().includes("custo")),
        venda: headers.findIndex(h => h.toLowerCase().includes("venda") || h.toLowerCase().includes("preço")),
        barras: headers.findIndex(h => h.toLowerCase().includes("barras") || h.toLowerCase().includes("gtin") || h.toLowerCase().includes("ean")),
        unidade: headers.findIndex(h => h.toLowerCase().includes("unidade")),
        ncm: headers.findIndex(h => h.toLowerCase().includes("ncm")),
        grupo: headers.findIndex(h => h.toLowerCase().includes("grupo")),
        tamanho: headers.findIndex(h => h.toLowerCase().includes("tamanho")),
        cor: headers.findIndex(h => h.toLowerCase().includes("cor")),
        fornecedor: headers.findIndex(h => h.toLowerCase().includes("fornecedor")),
        sku: headers.findIndex(h => h.toLowerCase().includes("sku")),
      }

      const itemsToImport: any[] = []
      const errorsList: string[] = []

      for (let i = 0; i < dataRows.length; i++) {
        const row = dataRows[i]
        const nome = idx.nome !== -1 ? row[idx.nome]?.toString().trim() : ""

        if (!nome) {
          errorsList.push(`Linha ${i + 2}: Nome do produto é obrigatório.`)
          continue
        }

        const compra = idx.compra !== -1 ? parseNumber(row[idx.compra]) : 0
        const venda = idx.venda !== -1 ? parseNumber(row[idx.venda]) : 0

        if (venda <= 0) {
          errorsList.push(`Linha ${i + 2} (${nome}): Preço de venda deve ser maior que zero.`)
          continue
        }

        itemsToImport.push({
          codigo: idx.codigo !== -1 ? row[idx.codigo]?.toString().trim() || "" : "",
          sku: idx.sku !== -1 ? row[idx.sku]?.toString().trim() || "" : "",
          nome,
          compra,
          venda,
          barras: idx.barras !== -1 ? row[idx.barras]?.toString().trim() || "" : "",
          estoque: idx.estoque !== -1 ? parseNumber(row[idx.estoque]) : 0,
          grupo: idx.grupo !== -1 ? row[idx.grupo]?.toString().trim() || "" : "",
          tamanho: idx.tamanho !== -1 ? row[idx.tamanho]?.toString().trim() || "" : "",
          cor: idx.cor !== -1 ? row[idx.cor]?.toString().trim() || "" : "",
          fornecedor: idx.fornecedor !== -1 ? row[idx.fornecedor]?.toString().trim() || "" : ""
        })
      }

      if (errorsList.length > 0) {
        setImportStatus({ total: dataRows.length, success: 0, errors: errorsList })
        toast({ variant: "destructive", title: "Erro na validação", description: "Corrija os erros na planilha antes de importar." })
        setIsImporting(false)
        return
      }

      if (itemsToImport.length > 0) {
        const res = await importProductsAction(itemsToImport)
        if (res.success) {
          const successCount = (res.created || 0) + (res.updated || 0)
          setImportStatus({ total: dataRows.length, success: successCount, errors: [] })
          toast({ title: "Importação concluída", description: `${res.created} produtos criados, ${res.updated} atualizados.` })
          setFile(null)
          if (fileInputRef.current) fileInputRef.current.value = ''
        } else {
          setImportStatus({ total: dataRows.length, success: 0, errors: [res.error || "Erro desconhecido."] })
          toast({ variant: "destructive", title: "Erro ao importar", description: res.error })
        }
      }

    } catch (error: any) {
      console.error(error)
      toast({ variant: "destructive", title: "Erro", description: error.message || "Erro no processamento do arquivo." })
    } finally {
      setIsImporting(false)
    }
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

            {importStatus && (
              <div className={`p-4 rounded-sm border ${importStatus.errors.length > 0 ? 'bg-red-50 border-red-200' : 'bg-green-50 border-green-200'}`}>
                <h3 className="font-bold mb-2 flex items-center gap-2">
                  {importStatus.errors.length > 0 ? <AlertCircle className="h-4 w-4 text-red-600" /> : <Check className="h-4 w-4 text-green-600" />}
                  Resultado da Importação
                </h3>
                <p className="text-sm">Total lido: {importStatus.total}</p>
                <p className="text-sm text-green-700 font-medium">Sucesso: {importStatus.success}</p>
                {importStatus.errors.length > 0 && (
                  <div className="mt-3">
                    <p className="text-sm text-red-700 font-medium mb-1">Erros ({importStatus.errors.length}):</p>
                    <ul className="text-xs text-red-600 list-disc pl-5 max-h-32 overflow-y-auto space-y-1">
                      {importStatus.errors.map((err, i) => (
                        <li key={i}>{err}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Lado Direito - Instruções */}
          <div className="p-6 md:w-1/2 space-y-4">
            <h2 className="text-xl font-headline font-semibold text-gray-800">Importação dos produtos</h2>
            
            <div className="space-y-4 text-gray-600 leading-relaxed">
              <p>Selecione o arquivo Excel no formato .xlsx com os dados dos seus produtos e importe no NEEX.</p>
              
              <p>Se preferir <button onClick={baixarPlanilhaPadrao} className="text-primary font-medium hover:underline">baixe nossa planilha padrão</button>, preencha com seus dados e envie para o sistema.</p>
              
              <p>Você também pode <button onClick={() => router.push('/produtos')} className="text-primary font-medium hover:underline">importar seus produtos</button> utilizando suas notas fiscais de vendas.</p>
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
            {isImporting ? "Importando..." : "Importar"}
          </Button>
          <Button 
            variant="destructive" 
            className="rounded-sm px-6 font-medium bg-red-500 hover:bg-red-600"
            onClick={() => {
              setFile(null)
              setImportStatus(null)
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
