"use client"

import { useState, useRef } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Package, Download, UploadCloud, X, Check, AlertCircle, Loader2 } from "lucide-react"
import { useFirestore } from "@/lib/legacy-stubs"
import { collection, addDoc, serverTimestamp, getDocs, query, where } from "@/lib/legacy-firestore-stubs"
import { toast } from "@/hooks/use-toast"
import * as XLSX from "xlsx"

export default function ImportarPlanilhaPage() {
  const router = useRouter()
  const db = useFirestore()
  const fileInputRef = useRef<HTMLInputElement>(null)
  
  const [file, setFile] = useState<File | null>(null)
  const [isImporting, setIsImporting] = useState(false)
  const [importStatus, setImportStatus] = useState<{ total: number, success: number, errors: string[] } | null>(null)

  const colunasPadrao = [
    "Código",
    "Qtd. Estoque",
    "Nãome do produto *",
    "Preço de compra",
    "Preço de venda",
    "Código de barras (GTIN/EAN)",
    "Unidade",
    "NCM",
    "Grupo do Produto",
    "Tamanho",
    "Cor",
    "FORNECEDOR"
  ]

  const fornecedorHeadersPadrao = [
    "Nãome do Fornecedor *",
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
    // Cria uma planilha com duas abas: Produtos e Fornecedores
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
        toast({ variant: "destructive", title: "Erro", description: "Ocorreu um erro ao processar sua solicitação." })
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

  const getFornecedorId = async (nome: string) => {
    if (!nome || !db) return ""
    try {
      const q = query(collection(db, "fornecedores"), where("nomeFornecedor", "==", nome))
      const querySnapshot = await getDocs(q)
      if (!querySnapshot.empty) {
        return querySnapshot.docs[0].id
      }
    } catch (e) {
      console.error(e)
    }
    return ""
  }

  const getGrupoId = async (nome: string) => {
    if (!nome || !db) return ""
    try {
      const q = query(collection(db, "gruposProdutos"), where("nome", "==", nome))
      const querySnapshot = await getDocs(q)
      if (!querySnapshot.empty) {
        return querySnapshot.docs[0].id
      }
    } catch (e) {
      console.error(e)
    }
    return ""
  }

  const getGradeId = async (nome: string) => {
    if (!nome || !db) return ""
    try {
      const q = query(collection(db, "gradesVariacoes"), where("nome", "==", nome))
      const querySnapshot = await getDocs(q)
      if (!querySnapshot.empty) {
        return querySnapshot.docs[0].id
      }
    } catch (e) {
      console.error(e)
    }
    return ""
  }

  const importSheetFornecedores = async (worksheet: XLSX.WorkSheet) => {
    const rows: any[] = XLSX.utils.sheet_to_json(worksheet, { header: 1 })
    if (rows.length <= 1) return

    const headers: string[] = rows[0].map((h: any) => h?.toString().trim() || "")
    const idx = {
      nomeFornecedor: headers.findIndex(h => h.toLowerCase().includes("nome")),
      cnpj: headers.findIndex(h => h.toLowerCase().includes("cnpj") || h.toLowerCase().includes("cpf")),
      whatsapp: headers.findIndex(h => h.toLowerCase().includes("whatsapp")),
      telefone: headers.findIndex(h => h.toLowerCase().includes("telefone")),
      email: headers.findIndex(h => h.toLowerCase().includes("e-mail") || h.toLowerCase().includes("email")),
      site: headers.findIndex(h => h.toLowerCase().includes("site")),
      instagram: headers.findIndex(h => h.toLowerCase().includes("instagram")),
      loginSite: headers.findIndex(h => h.toLowerCase().includes("login")),
      senhaSite: headers.findIndex(h => h.toLowerCase().includes("senha")),
      cep: headers.findIndex(h => h.toLowerCase().includes("cep")),
      cidade: headers.findIndex(h => h.toLowerCase().includes("cidade")),
      estado: headers.findIndex(h => h.toLowerCase().includes("estado")),
      endereco: headers.findIndex(h => h.toLowerCase().includes("endereço") || h.toLowerCase().includes("endereco")),
      observacoes: headers.findIndex(h => h.toLowerCase().includes("observa")),
      produtosVende: headers.findIndex(h => h.toLowerCase().includes("produtos") && h.toLowerCase().includes("vende")),
      genero: headers.findIndex(h => h.toLowerCase().includes("gênero") || h.toLowerCase().includes("genero")),
    }

    for (let i = 1; i < rows.length; i++) {
      const row = rows[i]
      const nomeFornecedor = idx.nomeFornecedor !== -1 ? row[idx.nomeFornecedor]?.toString().trim() : ""
      if (!nomeFornecedor) continue

      const existingId = await getFornecedorId(nomeFornecedor)
      if (existingId) continue

      const payload = {
        nomeFornecedor,
        cnpj: idx.cnpj !== -1 ? row[idx.cnpj]?.toString().trim() || "" : "",
        whatsapp: idx.whatsapp !== -1 ? row[idx.whatsapp]?.toString().trim() || "" : "",
        telefone: idx.telefone !== -1 ? row[idx.telefone]?.toString().trim() || "" : "",
        email: idx.email !== -1 ? row[idx.email]?.toString().trim() || "" : "",
        site: idx.site !== -1 ? row[idx.site]?.toString().trim() || "" : "",
        instagram: idx.instagram !== -1 ? row[idx.instagram]?.toString().trim() || "" : "",
        loginSite: idx.loginSite !== -1 ? row[idx.loginSite]?.toString().trim() || "" : "",
        senhaSite: idx.senhaSite !== -1 ? row[idx.senhaSite]?.toString().trim() || "" : "",
        cep: idx.cep !== -1 ? row[idx.cep]?.toString().trim() || "" : "",
        cidade: idx.cidade !== -1 ? row[idx.cidade]?.toString().trim() || "" : "",
        estado: idx.estado !== -1 ? row[idx.estado]?.toString().trim() || "" : "",
        endereco: idx.endereco !== -1 ? row[idx.endereco]?.toString().trim() || "" : "",
        observacoes: idx.observacoes !== -1 ? row[idx.observacoes]?.toString().trim() || "" : "",
        produtosVende: idx.produtosVende !== -1 ? row[idx.produtosVende]?.toString().split(",").map((p: string) => p.trim()).filter(Boolean) : [],
        genero: idx.genero !== -1 ? row[idx.genero]?.toString().trim() || "" : "",
        ativo: true,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      }

      try {
        await addDoc(collection(db, "fornecedores"), payload)
      } catch (err) {
        console.error("Erro ao importar fornecedor:", err)
      }
    }
  }

  const handleImportar = async () => {
    if (!file) {
      toast({ variant: "destructive", title: "Erro", description: "Ocorreu um erro ao processar sua solicitação." })
      return
    }
    if (!db) {
      toast({ variant: "destructive", title: "Erro", description: "Ocorreu um erro ao processar sua solicitação." })
      return
    }

    setIsImporting(true)
    setImportStatus(null)

    try {
      const data = await file.arrayBuffer()
      const workbook = XLSX.read(data)
      const sheetNameFornecedores = workbook.SheetNames.find(name => name?.toLowerCase().includes("fornecedor"))
      if (sheetNameFornecedores) {
        await importSheetFornecedores(workbook.Sheets[sheetNameFornecedores])
      }

      const sheetNameProdutos = workbook.SheetNames.find(name => name?.toLowerCase().includes("produto")) || workbook.SheetNames[0]
      const worksheet = workbook.Sheets[sheetNameProdutos]
      const rows: any[] = XLSX.utils.sheet_to_json(worksheet, { header: 1 })

      if (rows.length <= 1) {
        toast({ variant: "destructive", title: "Erro", description: "Ocorreu um erro ao processar sua solicitação." })
        setIsImporting(false)
        return
      }

      // Linha 0 é o cabeçalho
      const headers: string[] = rows[0]
      const dataRows = rows.slice(1).filter(r => r.length > 0 && r.some((c: any) => c))

      if (dataRows.length > 1000) {
        toast({ variant: "destructive", title: "Erro", description: "Ocorreu um erro ao processar sua solicitação." })
        setIsImporting(false)
        return
      }

      let successCount = 0
      const errorsList: string[] = []

      // Mapeia os índices das colunas para facilitar
      const idx = {
        codigo: headers.findIndex(h => h?.toString().toLowerCase().includes("código") && !h?.toString().toLowerCase().includes("barras")),
        estoque: headers.findIndex(h => h?.toString().toLowerCase().includes("estoque")),
        nome: headers.findIndex(h => h?.toString().toLowerCase().includes("nome")),
        compra: headers.findIndex(h => h?.toString().toLowerCase().includes("compra")),
        venda: headers.findIndex(h => h?.toString().toLowerCase().includes("venda")),
        barras: headers.findIndex(h => h?.toString().toLowerCase().includes("barras")),
        unidade: headers.findIndex(h => h?.toString().toLowerCase().includes("unidade")),
        ncm: headers.findIndex(h => h?.toString().toLowerCase().includes("ncm")),
        grupo: headers.findIndex(h => h?.toString().toLowerCase().includes("grupo")),
        tamanho: headers.findIndex(h => h?.toString().toLowerCase().includes("tamanho")),
        cor: headers.findIndex(h => h?.toString().toLowerCase().includes("cor")),
        fornecedor: headers.findIndex(h => h?.toString().toLowerCase().includes("fornecedor")),
      }

      for (let i = 0; i < dataRows.length; i++) {
        const row = dataRows[i]
        const nome = idx.nome !== -1 ? row[idx.nome]?.toString().trim() : ""

        if (!nome) {
          errorsList.push(`Linha ${i + 2}: Nãome do produto é obrigatório.`)
          continue
        }

        const fornecedorNãome = idx.fornecedor !== -1 ? row[idx.fornecedor]?.toString().trim() : ""
        let fornecedorId = ""
        if (fornecedorNãome) {
          fornecedorId = await getFornecedorId(fornecedorNãome)
          if (!fornecedorId) {
            const newFornecedorRef = await addDoc(collection(db, "fornecedores"), {
              nomeFornecedor: fornecedorNãome,
              ativo: true,
              createdAt: serverTimestamp(),
              updatedAt: serverTimestamp(),
            })
            fornecedorId = newFornecedorRef.id
          }
        }

        const grupoNãome = idx.grupo !== -1 ? row[idx.grupo]?.toString().trim() : ""
        let grupoId = ""
        if (grupoNãome) {
          grupoId = await getGrupoId(grupoNãome)
          if (!grupoId) {
            const newGrupoRef = await addDoc(collection(db, "gruposProdutos"), {
              nome: grupoNãome,
              descricao: "",
              createdAt: serverTimestamp(),
              updatedAt: serverTimestamp(),
            })
            grupoId = newGrupoRef.id
          }
        }

        const tamanhoNãome = idx.tamanho !== -1 ? row[idx.tamanho]?.toString().trim() : ""
        let tamanhoId = ""
        if (tamanhoNãome) {
          tamanhoId = await getGradeId(tamanhoNãome)
          if (!tamanhoId) {
            const newGradeRef = await addDoc(collection(db, "gradesVariacoes"), {
              nome: tamanhoNãome,
              tipo: "tamanho",
              valores: [tamanhoNãome],
              createdAt: serverTimestamp(),
              updatedAt: serverTimestamp(),
            })
            tamanhoId = newGradeRef.id
          }
        }

        const corNãome = idx.cor !== -1 ? row[idx.cor]?.toString().trim() : ""
        let corId = ""
        if (corNãome) {
          corId = await getGradeId(corNãome)
          if (!corId) {
            const newGradeRef = await addDoc(collection(db, "gradesVariacoes"), {
              nome: corNãome,
              tipo: "cor",
              valores: [corNãome],
              createdAt: serverTimestamp(),
              updatedAt: serverTimestamp(),
            })
            corId = newGradeRef.id
          }
        }

        const produtoData = {
          nome,
          codigoInterno: idx.codigo !== -1 ? row[idx.codigo]?.toString().trim() || "" : "",
          codigoBarras: idx.barras !== -1 ? row[idx.barras]?.toString().trim() || "" : "",
          unidadeMedida: idx.unidade !== -1 ? row[idx.unidade]?.toString().trim() || "UN" : "UN",
          ncm: idx.ncm !== -1 ? row[idx.ncm]?.toString().trim() || "" : "",
          
          custoBase: idx.compra !== -1 ? parseNumber(row[idx.compra]) : 0,
          custoFinal: idx.compra !== -1 ? parseNumber(row[idx.compra]) : 0, // Simplificação
          valorVenda: idx.venda !== -1 ? parseNumber(row[idx.venda]) : 0,
          lucroUtilizado: 0,
          
          estoqueAtual: idx.estoque !== -1 ? parseNumber(row[idx.estoque]) : 0,
          possuiVariacoes: tamanhoNãome || corNãome ? "Sim" : "Não",
          tamanho: tamanhoNãome,
          cor: corNãome,
          
          fornecedorId,
          grupo: grupoId,
          
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        }

        try {
          await addDoc(collection(db, "produtos"), produtoData)
          successCount++
        } catch (err: any) {
          errorsList.push(`Linha ${i + 2} (${nome}): Erro ao salvar - ${err.message}`)
        }
      }

      setImportStatus({ total: dataRows.length, success: successCount, errors: errorsList })
      toast({ title: "Importação finalizada", description: `${successCount} produtos importados com sucesso.` })
      
      if (errorsList.length === 0) {
        setFile(null)
        if (fileInputRef.current) fileInputRef.current.value = ''
      }

    } catch (error) {
      console.error(error)
      toast({ variant: "destructive", title: "Erro", description: "Ocorreu um erro ao processar sua solicitação." })
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
              
              <p>Caso tenha dúvidas, assista o vídeo tutorial ensinando como importar seus produtos.</p>
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
