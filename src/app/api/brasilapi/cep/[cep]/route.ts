import { NextResponse } from 'next/server';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ cep: string }> }
) {
  try {
    const resolvedParams = await params;
    const rawCep = resolvedParams.cep || '';
    
    // Remove non-numeric characters
    const cleanCep = rawCep.replace(/\D/g, '');
    
    if (cleanCep.length !== 8) {
      return NextResponse.json(
        { success: false, error: 'CEP inválido. Deve conter exatamente 8 dígitos.' },
        { status: 400 }
      );
    }

    const response = await fetch(`https://brasilapi.com.br/api/cep/v1/${cleanCep}`, {
      headers: { 'Content-Type': 'application/json' },
      next: { revalidate: 86400 } // Cache for 1 day
    });

    if (response.status === 404) {
      return NextResponse.json(
        { success: false, error: 'CEP não encontrado.' },
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
    
    // Nãormalize properties
    const normalizedData = {
      cep: data.cep || cleanCep,
      logradouro: data.street || '',
      bairro: data.neighborhood || '',
      cidade: data.city || '',
      uf: data.state || ''
    };

    return NextResponse.json({ success: true, data: normalizedData });
  } catch (error: any) {
    console.error('[API /api/brasilapi/cep] Error:', error);
    return NextResponse.json(
      { success: false, error: 'Erro interno ao consultar o CEP.' },
      { status: 500 }
    );
  }
}
