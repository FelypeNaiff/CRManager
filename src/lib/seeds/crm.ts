import { collection, writeBatch, doc, getDocs, query, limit } from 'firebase/firestore';

export const DEFAULT_TAGS = [
  { nome: 'VIP', cor: '#EAB308', status: 'ativo' }, // Amarelo
  { nome: 'MÃE_DE_MENINA', cor: '#EC4899', status: 'ativo' }, // Rosa
  { nome: 'MÃE_DE_MENINO', cor: '#3B82F6', status: 'ativo' }, // Azul
  { nome: 'CLIENTE_COM_SALDO', cor: '#10B981', status: 'ativo' }, // Verde
  { nome: 'COMPRA_BAZAR', cor: '#8B5CF6', status: 'ativo' }, // Roxo
  { nome: 'ALTO_TICKET', cor: '#EF4444', status: 'ativo' }, // Vermelho
  { nome: 'SEM_COMPRAR_30_DIAS', cor: '#F97316', status: 'ativo' }, // Laranja
  { nome: 'SEM_COMPRAR_60_DIAS', cor: '#EA580C', status: 'ativo' }, // Laranja Escuro
  { nome: 'SEM_COMPRAR_90_DIAS', cor: '#DC2626', status: 'ativo' }, // Vermelho Escuro
  { nome: 'ANIVERSÁRIO_CLIENTE', cor: '#06B6D4', status: 'ativo' }, // Ciano
  { nome: 'ANIVERSÁRIO_FILHO', cor: '#14B8A6', status: 'ativo' }, // Teal
  { nome: 'TAMANHO_ATUALIZADO', cor: '#22C55E', status: 'ativo' }, // Verde Claro
  { nome: 'TAMANHO_DESATUALIZADO', cor: '#6B7280', status: 'ativo' }, // Cinza
];

export async function seedCrmBasico(db: any, tenantId: string, createdBy: string) {
  try {
    const batch = writeBatch(db);
    const tagsRef = collection(db, 'tags');
    const tagsSnap = await getDocs(query(tagsRef, limit(1)));

    if (tagsSnap.empty) {
      for (const tag of DEFAULT_TAGS) {
        const docRef = doc(tagsRef);
        batch.set(docRef, {
          ...tag,
          tenant_id: tenantId || 'default-tenant',
          created_at: new Date(),
          updated_at: new Date(),
          deleted_at: null,
          created_by: createdBy || 'system',
          updated_by: createdBy || 'system',
        });
      }
      await batch.commit();
      console.log('Seed CRM executado com sucesso!');
      return true;
    }
    return false;
  } catch (error) {
    console.error('Erro ao executar seed CRM:', error);
    return false;
  }
}
