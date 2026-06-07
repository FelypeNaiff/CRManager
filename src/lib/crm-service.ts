import { 
  collection, 
  doc, 
  addDoc, 
  setDoc,
  updateDoc, 
  serverTimestamp, 
  query, 
  where,
  getDocs,
  getDoc,
  limit,
  deleteDoc
} from "@/lib/legacy-firestore-stubs";


export interface CrmMetadata {
  tenant_id: string;
  created_at: any;
  updated_at: any;
  deleted_at: any | null;
  created_by: string;
  updated_by: string;
  status: "ativo" | "inativo" | "arquivado";
}

/**
 * NEEX Base Service
 * Handles consistent data mutation, tenant segregation, auditing, and soft deletes.
 */
export const CrmService = {
  /**
   * Prepares and creates a new document with standard base fields and activity log
   */
  async createDocument(
    db: any, 
    collectionName: string, 
    data: any, 
    activeProfile: { id: string; nome: string; empresaId?: string }
  ) {
    if (!db) throw new Error("Firestore instance is required.");
    
    const tenantId = activeProfile.empresaId || "default-tenant";
    const userId = activeProfile.id || "system";
    const userName = activeProfile.nome || "System";
    
    // Prepare metadata
    const docData = {
      ...data,
      tenant_id: tenantId,
      created_at: new Date(),
      updated_at: new Date(),
      deleted_at: null,
      created_by: userId,
      updated_by: userId,
      status: data.status || "ativo"
    };
    
    // Add to Firestore
    const colRef = collection(db, collectionName);
    const docRef = await addDoc(colRef, docData);
    
    // Auto-update with its own ID (if requested or to ensure self-containment)
    await updateDoc(doc(db, collectionName, docRef.id), { id: docRef.id });
    docData.id = docRef.id;

    // Trigger seeding of base CRM tags if we are initializing tags/system
    if (collectionName === "clientes" || collectionName === "tags") {
      // seedCrmBasico is deprecated/not implemented
    }
    
    // Write activity log
    await this.logActivity(db, {
      tenant_id: tenantId,
      usuario_id: userId,
      usuario_nome: userName,
      acao: "CREATE",
      modulo: this.getModuloName(collectionName),
      registro_id: docRef.id,
      detalhes: `Criou novo registro em ${collectionName}. ID: ${docRef.id}`,
    });

    // Write internal customer history if the action is linked to a customer
    if (data.cliente_id || collectionName === "clientes") {
      const clienteId = data.cliente_id || docRef.id;
      await this.logCustomerHistory(db, {
        cliente_id: clienteId,
        tenant_id: tenantId,
        tipo_acao: `CADASTRO_${collectionName.toUpperCase()}`,
        descricao: `Nãovo registro de ${this.getModuloName(collectionName)} adicionado ao cliente.`,
        activeProfile
      });
    }

    return docData;
  },

  /**
   * Updates an existing document and creates an activity log
   */
  async updateDocument(
    db: any, 
    collectionName: string, 
    docId: string, 
    data: any, 
    activeProfile: { id: string; nome: string; empresaId?: string }
  ) {
    if (!db) throw new Error("Firestore instance is required.");
    if (!docId) throw new Error("Document ID is required.");
    
    const tenantId = activeProfile.empresaId || "default-tenant";
    const userId = activeProfile.id || "system";
    const userName = activeProfile.nome || "System";
    
    const docRef = doc(db, collectionName, docId);
    
    const updateData = {
      ...data,
      updated_at: new Date(),
      updated_by: userId
    };
    
    await updateDoc(docRef, updateData);
    
    // Write activity log
    await this.logActivity(db, {
      tenant_id: tenantId,
      usuario_id: userId,
      usuario_nome: userName,
      acao: "UPDATE",
      modulo: this.getModuloName(collectionName),
      registro_id: docId,
      detalhes: `Atualizou registro em ${collectionName}. ID: ${docId}`,
    });

    // Write internal customer history if linked
    if (data.cliente_id || collectionName === "clientes") {
      const clienteId = data.cliente_id || docId;
      await this.logCustomerHistory(db, {
        cliente_id: clienteId,
        tenant_id: tenantId,
        tipo_acao: `ATUALIZACAO_${collectionName.toUpperCase()}`,
        descricao: `Registro de ${this.getModuloName(collectionName)} atualizado.`,
        activeProfile
      });
    }
    
    return { id: docId, ...updateData };
  },

  /**
   * Soft deletes a document (setting status to 'arquivado' or 'inativo' and deleted_at timestamp)
   */
  async deleteDocument(
    db: any, 
    collectionName: string, 
    docId: string, 
    activeProfile: { id: string; nome: string; empresaId?: string },
    hardDelete: boolean = false
  ) {
    if (!db) throw new Error("Firestore instance is required.");
    if (!docId) throw new Error("Document ID is required.");
    
    const tenantId = activeProfile.empresaId || "default-tenant";
    const userId = activeProfile.id || "system";
    const userName = activeProfile.nome || "System";
    
    const docRef = doc(db, collectionName, docId);
    
    if (hardDelete) {
      await deleteDoc(docRef);
    } else {
      await updateDoc(docRef, {
        deleted_at: new Date(),
        updated_at: new Date(),
        updated_by: userId,
        status: "arquivado"
      });
    }
    
    // Write activity log
    await this.logActivity(db, {
      tenant_id: tenantId,
      usuario_id: userId,
      usuario_nome: userName,
      acao: hardDelete ? "HARD_DELETE" : "SOFT_DELETE",
      modulo: this.getModuloName(collectionName),
      registro_id: docId,
      detalhes: `${hardDelete ? "Removeu" : "Arquivou"} registro em ${collectionName}. ID: ${docId}`,
    });

    // Log in customer history if linked
    if (collectionName === "clientes") {
      await this.logCustomerHistory(db, {
        cliente_id: docId,
        tenant_id: tenantId,
        tipo_acao: "EXCLUSAO_CLIENTE",
        descricao: `Cliente foi ${hardDelete ? "excluído permanentemente" : "arquivado"}.`,
        activeProfile
      });
    }
    
    return { id: docId, success: true };
  },

  /**
   * Helper to write structured audit logs inside the logs_atividades collection
   */
  async logActivity(
    db: any, 
    log: {
      tenant_id: string;
      usuario_id: string;
      usuario_nome: string;
      acao: string;
      modulo: string;
      registro_id: string;
      detalhes: string;
    }
  ) {
    try {
      await addDoc(collection(db, "logs_atividades"), {
        empresa_id: log.tenant_id,
        usuario_id: log.usuario_id,
        usuario_nome: log.usuario_nome,
        acao: log.acao,
        modulo: log.modulo,
        registro_id: log.registro_id,
        detalhes: log.detalhes,
        data_hora: new Date()
      });
    } catch (e) {
      console.error("Erro ao registrar log de atividade:", e);
    }
  },

  /**
   * Helper to write internal history logs directly linked to a client
   */
  async logCustomerHistory(
    db: any,
    history: {
      cliente_id: string;
      tenant_id: string;
      tipo_acao: string;
      descricao: string;
      activeProfile: { id: string; nome: string }
    }
  ) {
    try {
      const colRef = collection(db, "historico_cliente");
      await addDoc(colRef, {
        cliente_id: history.cliente_id,
        tenant_id: history.tenant_id,
        tipo_acao: history.tipo_acao,
        descricao: history.descricao,
        created_at: new Date(),
        updated_at: new Date(),
        deleted_at: null,
        created_by: history.activeProfile.id || "system",
        updated_by: history.activeProfile.id || "system",
        status: "ativo"
      });
    } catch (e) {
      console.error("Erro ao gravar histórico do cliente:", e);
    }
  },

  /**
   * Maps a collection name to a human-readable module name for logging
   */
  getModuloName(collectionName: string): string {
    switch (collectionName) {
      case "clientes": return "CRM Clientes";
      case "filhos": return "CRM Filhos";
      case "carteiras_clientes": return "CRM Carteiras";
      case "movimentacoes_saldo": return "CRM Saldos";
      case "trocas_devolucoes": return "CRM Trocas & Devoluções";
      case "tags": return "CRM Tags";
      case "clientes_tags": return "CRM Vínculo Tags";
      case "historico_cliente": return "CRM Histórico Cliente";
      default: return "CRM Geral";
    }
  }
};
