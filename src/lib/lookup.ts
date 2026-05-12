export type CnpjLookupData = {
  cnpj?: string
  razaoSocial?: string
  nomeFantasia?: string
  inscricaoEstadual?: string
  inscricaoMunicipal?: string
  dataAbertura?: string
  site?: string
  email?: string
  telefone?: string
  whatsapp?: string
  responsavel?: string
  cep?: string
  rua?: string
  numero?: string
  complemento?: string
  bairro?: string
  cidade?: string
  estado?: string
}

function onlyDigits(value: string) {
  return value.replace(/\D/g, "")
}

async function fetchJson(url: string) {
  const response = await fetch(url, { cache: "no-store" })
  if (!response.ok) {
    throw new Error(`Falha na consulta: ${response.status}`)
  }
  return response.json()
}

export async function fetchViaCep(cep: string) {
  const cleanCep = onlyDigits(cep)
  if (cleanCep.length !== 8) {
    throw new Error("CEP inválido")
  }

  const data = await fetchJson(`https://viacep.com.br/ws/${cleanCep}/json/`)
  if (data.erro) {
    throw new Error("CEP não encontrado")
  }

  return {
    cep: data.cep,
    rua: data.logradouro,
    complemento: data.complemento,
    bairro: data.bairro,
    cidade: data.localidade,
    estado: data.uf,
    pais: "Brasil",
  }
}

async function fetchReceitaWs(cnpj: string) {
  const cleanCnpj = onlyDigits(cnpj)
  const data = await fetchJson(`https://www.receitaws.com.br/v1/cnpj/${cleanCnpj}`)
  if ((data as any).status === "ERROR") {
    throw new Error((data as any).message || "CNPJ não encontrado")
  }

  return {
    source: "ReceitaWS",
    data: {
      cnpj: data.cnpj,
      razaoSocial: data.nome,
      nomeFantasia: data.fantasia,
      inscricaoEstadual: data.inscricao_estadual,
      dataAbertura: data.abertura,
      site: data.email ? undefined : data.site,
      email: data.email,
      telefone: data.telefone,
      rua: data.logradouro,
      complemento: data.complemento,
      bairro: data.bairro,
      cidade: data.municipio,
      estado: data.uf,
      cep: data.cep,
    },
  }
}

async function fetchOpenCnpj(cnpj: string) {
  const cleanCnpj = onlyDigits(cnpj)
  const data = await fetchJson(`https://api.opencnpj.com.br/v1/cnpj/${cleanCnpj}`)

  return {
    source: "OpenCNPJ",
    data: {
      cnpj: data.cnpj,
      razaoSocial: data.razao_social,
      nomeFantasia: data.nome_fantasia,
      inscricaoEstadual: data.inscricao_estadual,
      dataAbertura: data.data_abertura,
      site: data.site,
      email: data.email,
      telefone: data.telefone,
      rua: data.logradouro,
      complemento: data.complemento,
      bairro: data.bairro,
      cidade: data.municipio,
      estado: data.uf,
      cep: data.cep,
    },
  }
}

async function fetchCnpjaOpen(cnpj: string) {
  const cleanCnpj = onlyDigits(cnpj)
  const data = await fetchJson(`https://publica.cnpj.ws/cnpj/${cleanCnpj}`)

  return {
    source: "CNPJá",
    data: {
      cnpj: data.cnpj,
      razaoSocial: data.razao_social || data.nome,
      nomeFantasia: data.nome_fantasia || data.fantasia,
      inscricaoEstadual: data.inscricao_estadual || data.ie,
      dataAbertura: data.abertura || data.data_abertura,
      site: data.website || data.site,
      email: data.email,
      telefone: data.telefone || data.telefone_1,
      rua: data.logradouro || data.endereco || data.logradouro_principal,
      complemento: data.complemento,
      bairro: data.bairro,
      cidade: data.municipio || data.cidade || data.municipio_descricao,
      estado: data.uf,
      cep: data.cep,
    },
  }
}

export async function fetchCnpjData(cnpj: string) {
  const cleanCnpj = onlyDigits(cnpj)
  if (cleanCnpj.length !== 14) {
    throw new Error("CNPJ inválido")
  }

  const sources: Array<() => Promise<{ source: string; data: CnpjLookupData }>> = [
    () => fetchReceitaWs(cleanCnpj),
    () => fetchOpenCnpj(cleanCnpj),
    () => fetchCnpjaOpen(cleanCnpj),
  ]

  let lastError: Error | null = null

  for (const source of sources) {
    try {
      return await source()
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error))
    }
  }

  throw lastError || new Error("Não foi possível consultar o CNPJ")
}
