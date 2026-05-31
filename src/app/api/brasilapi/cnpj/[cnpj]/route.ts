import { NextResponse } from 'next/server';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ cnpj: string }> }
) {
  try {
    const resolvedParams = await params;
    const rawCnpj = resolvedParams.cnpj || '';
    
    // Remove non-numeric characters
    const cleanCnpj = rawCnpj.replace(/\D/g, '');
    
    if (cleanCnpj.length !== 14) {
      return NextResponse.json(
        { success: false, error: 'CNPJ inválido. Deve conter exatamente 14 dígitos.' },
        { status: 400 }
      );
    }

    const response = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${cleanCnpj}`, {
      headers: { 'Content-Type': 'application/json' },
      next: { revalidate: 86400 } // Cache for 1 day
    });

    if (response.status === 404) {
      return NextResponse.json(
        { success: false, error: 'CNPJ não encontrado.' },
        { status: 404 }
      );
    }

    if (!response.ok) {
      return NextResponse.json(
        { success: false, error: 'Erro ao consultar a BrasilAPI.' },
        { status: response.status }
      );
    }

    const data = await response.json();

    // Map fields
    const streetPrefix = data.descricao_tipo_de_logradouro ? `${data.descricao_tipo_de_logradouro} ` : '';
    const rawStreet = data.logradouro || '';
    const fullStreet = rawStreet ? `${streetPrefix}${rawStreet}` : '';

    const normalizedData = {
      cnpjCpf: data.cnpj || cleanCnpj,
      razaoSocial: data.razao_social || '',
      nomeFantasia: data.nome_fantasia || data.razao_social || '',
      cnae: data.cnae_fiscal ? String(data.cnae_fiscal) : '',
      logradouro: fullStreet,
      numero: data.numero || '',
      complemento: data.complemento || '',
      bairro: data.bairro || '',
      cidade: data.municipio || '',
      uf: data.uf || '',
      cep: data.cep || '',
      telefone: data.ddd_telefone_1 ? `(${data.ddd_telefone_1.substring(0, 2)}) ${data.ddd_telefone_1.substring(2)}` : '',
      email: data.email || ''
    };

    return NextResponse.json({ success: true, data: normalizedData });
  } catch (error: any) {
    console.error('[API /api/brasilapi/cnpj] Error:', error);
    return NextResponse.json(
      { success: false, error: 'Erro interno ao consultar o CNPJ.' },
      { status: 500 }
    );
  }
}
