import { initializeApp, getApps, getApp } from 'firebase/app';
import { getFirestore, doc, setDoc, deleteDoc } from 'firebase/firestore';
import { firebaseConfig } from '../../firebase/config';
import { prisma } from '../prisma';

// Initialize Firebase client on the server side for sync operations
const app = getApps().length ? getApp() : initializeApp(firebaseConfig);
const db = getFirestore(app, 'crmanager');

export async function syncProductToFirestore(productId: string): Promise<void> {
  try {
    const product = await prisma.product.findUnique({
      where: { id: productId },
      include: {
        category: true,
        supplier: true,
        variants: {
          where: { isActive: true },
        },
      },
    });

    if (!product) {
      console.warn(`[Adapter] Product not found in PG for sync: ${productId}`);
      return;
    }

    // Default variant details
    const defaultVariant = product.variants.find(v => v.name === 'Único') || product.variants[0];

    const firestoreId = product.legacyFirebaseId || product.id;

    const docRef = doc(db, 'produtos', firestoreId);
    await setDoc(docRef, {
      nome: product.name,
      codigoInterno: product.internalCode,
      codigoBarras: defaultVariant?.barcode || '',
      valorVenda: defaultVariant ? Number(defaultVariant.salePrice) : 0,
      estoqueAtual: defaultVariant ? Number(defaultVariant.currentStock) : 0,
      grupo: product.category ? (product.category.legacyFirebaseId || product.category.id) : '',
      fornecedorId: product.supplier ? (product.supplier.legacyFirebaseId || product.supplier.id) : '',
      imageUrl: product.imageUrl || '',
      thumbnailUrl: product.thumbnailUrl || '',
      galleryUrls: product.galleryUrls || [],
      status: product.isActive ? 'ativo' : 'arquivado',
      updatedAt: new Date(),
    }, { merge: true });

    console.log(`[Adapter] Successfully synced product ${product.name} to Firestore (${firestoreId})`);
  } catch (error) {
    console.error(`[Adapter] Failed to sync product ${productId} to Firestore:`, error);
  }
}

export async function syncProductDeleteToFirestore(productId: string, legacyFirebaseId?: string | null): Promise<void> {
  try {
    const firestoreId = legacyFirebaseId || productId;
    const docRef = doc(db, 'produtos', firestoreId);
    // Mark as archived in Firestore to match soft delete
    await setDoc(docRef, {
      status: 'arquivado',
      updatedAt: new Date(),
    }, { merge: true });
    console.log(`[Adapter] Successfully marked product ${firestoreId} as archived in Firestore`);
  } catch (error) {
    console.error(`[Adapter] Failed to delete/archive product ${legacyFirebaseId || productId} in Firestore:`, error);
  }
}
