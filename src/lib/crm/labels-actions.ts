'use server';

import { serializePrisma } from '@/lib/serialize';
import { prisma } from '@/lib/prisma';
import { requirePermission } from '@/lib/auth/permissions';
import { tenantWhere } from './tenant-security';
import { publicActionError } from '@/lib/auth/public-action-error';
import { writeActivityLog } from '@/lib/auth/activity-log';
import { Prisma } from '@prisma/client';

export const LABEL_PRESETS = [
  {
    presetName: "PIMACO - A4051/A4251/A4351",
    paperSize: "A4 – 21,0 X 29,7 cm",
    labelHeightCm: 2.12,
    labelWidthCm: 3.82,
    columnsOnPage: 5,
    rowsOnPage: 13,
    marginTopCm: 1.07,
    marginLeftCm: 0.45,
    verticalPitchCm: 2.12,
    horizontalPitchCm: 4.07,
  },
  {
    presetName: "PIMACO - A4048/A4248/A4348",
    paperSize: "A4 – 21,0 X 29,7 cm",
    labelHeightCm: 2.54,
    labelWidthCm: 6.67,
    columnsOnPage: 3,
    rowsOnPage: 10,
    marginTopCm: 2.12,
    marginLeftCm: 0.40,
    verticalPitchCm: 2.54,
    horizontalPitchCm: 6.98,
  },
  {
    presetName: "PIMACO - A4249",
    paperSize: "A4 – 21,0 X 29,7 cm",
    labelHeightCm: 3.39,
    labelWidthCm: 6.67,
    columnsOnPage: 3,
    rowsOnPage: 8,
    marginTopCm: 1.30,
    marginLeftCm: 0.40,
    verticalPitchCm: 3.39,
    horizontalPitchCm: 6.98,
  },
  {
    presetName: "CAA4248",
    paperSize: "A4 – 21,0 X 29,7 cm",
    labelHeightCm: 2.54,
    labelWidthCm: 6.67,
    columnsOnPage: 3,
    rowsOnPage: 10,
    marginTopCm: 2.15,
    marginLeftCm: 0.48,
    verticalPitchCm: 2.54,
    horizontalPitchCm: 6.98,
  }
];

export async function getLabelTemplates() {
  const session = await requirePermission('PRODUTOS', 'VIEW');
  try {
    const templates = await prisma.productLabelTemplate.findMany({
      where: { companyId: session.companyId, isActive: true },
      orderBy: { name: 'asc' },
    });
    return { success: true, data: serializePrisma(templates) };
  } catch (error: any) {
    return { success: false, error: publicActionError(error, 'Erro ao buscar modelos de etiquetas.') };
  }
}

export async function getLabelTemplateById(id: string) {
  const session = await requirePermission('PRODUTOS', 'VIEW');
  try {
    const template = await prisma.productLabelTemplate.findFirst({
      where: tenantWhere(id, session.companyId),
    });
    if (!template) {
      return { success: false, error: 'Modelo não encontrado.' };
    }
    return { success: true, data: serializePrisma(template) };
  } catch (error: any) {
    return { success: false, error: publicActionError(error, 'Erro ao buscar modelo de etiqueta.') };
  }
}

export async function createLabelTemplate(input: any) {
  const session = await requirePermission('PRODUTOS', 'CREATE');
  try {
    if (!input.name?.trim()) {
      return { success: false, error: 'O nome do modelo é obrigatório.' };
    }

    const data: any = {
      companyId: session.companyId,
      name: input.name,
      presetName: input.presetName,
      paperSize: input.paperSize,
      columnsOnPage: input.columnsOnPage,
      rowsOnPage: input.rowsOnPage,
      topDescription: input.topDescription,
      maxCharsProductName: input.maxCharsProductName || null,
      fontFamily: input.fontFamily,
      fontSizePt: input.fontSizePt,
      showInternalCode: input.showInternalCode,
      showBarcode: input.showBarcode,
      showBarcodeDigits: input.showBarcodeDigits,
      barcodePosition: input.barcodePosition,
      showPrice: input.showPrice,
      priceFontSize: input.priceFontSize,
      fieldPositions: input.fieldPositions || Prisma.JsonNull,
    };

    // Convert decimal strings to Prisma.Decimal
    const decimalFields = ['labelHeightCm', 'labelWidthCm', 'marginTopCm', 'marginLeftCm', 'verticalPitchCm', 'horizontalPitchCm'];
    for (const field of decimalFields) {
      if (input[field] !== undefined) {
        data[field] = new Prisma.Decimal(input[field]);
      }
    }

    const result = await prisma.$transaction(async (tx) => {
      const template = await tx.productLabelTemplate.create({ data });

      await writeActivityLog({
        context: session,
        action: 'PRODUCT_LABEL_TEMPLATE_CREATE',
        module: 'PRODUCTS',
        recordId: template.id,
        details: `Modelo de etiqueta "${template.name}" criado.`,
      }, { policy: 'CRITICAL', tx });

      return template;
    });

    return { success: true, data: serializePrisma(result) };
  } catch (error: any) {
    return { success: false, error: publicActionError(error, 'Erro ao criar modelo de etiqueta.') };
  }
}

export async function updateLabelTemplate(id: string, input: any) {
  const session = await requirePermission('PRODUTOS', 'UPDATE');
  try {
    if (!input.name?.trim()) {
      return { success: false, error: 'O nome do modelo é obrigatório.' };
    }

    const template = await prisma.productLabelTemplate.findFirst({
      where: tenantWhere(id, session.companyId),
    });

    if (!template) {
      return { success: false, error: 'Modelo não encontrado.' };
    }

    const data: any = {
      name: input.name,
      presetName: input.presetName,
      paperSize: input.paperSize,
      columnsOnPage: input.columnsOnPage,
      rowsOnPage: input.rowsOnPage,
      topDescription: input.topDescription,
      maxCharsProductName: input.maxCharsProductName || null,
      fontFamily: input.fontFamily,
      fontSizePt: input.fontSizePt,
      showInternalCode: input.showInternalCode,
      showBarcode: input.showBarcode,
      showBarcodeDigits: input.showBarcodeDigits,
      barcodePosition: input.barcodePosition,
      showPrice: input.showPrice,
      priceFontSize: input.priceFontSize,
      fieldPositions: input.fieldPositions || Prisma.JsonNull,
    };

    const decimalFields = ['labelHeightCm', 'labelWidthCm', 'marginTopCm', 'marginLeftCm', 'verticalPitchCm', 'horizontalPitchCm'];
    for (const field of decimalFields) {
      if (input[field] !== undefined) {
        data[field] = new Prisma.Decimal(input[field]);
      }
    }

    await prisma.$transaction(async (tx) => {
      await tx.productLabelTemplate.update({
        where: { id },
        data,
      });

      await writeActivityLog({
        context: session,
        action: 'PRODUCT_LABEL_TEMPLATE_UPDATE',
        module: 'PRODUCTS',
        recordId: id,
        details: `Modelo de etiqueta "${input.name}" atualizado.`,
      }, { policy: 'CRITICAL', tx });
    });

    return { success: true };
  } catch (error: any) {
    return { success: false, error: publicActionError(error, 'Erro ao atualizar modelo de etiqueta.') };
  }
}

export async function deleteLabelTemplate(id: string) {
  const session = await requirePermission('PRODUTOS', 'DELETE');
  try {
    await prisma.$transaction(async (tx) => {
      const template = await tx.productLabelTemplate.findFirst({
        where: tenantWhere(id, session.companyId),
      });
      if (!template) {
        throw new Error('Modelo não encontrado.');
      }

      await tx.productLabelTemplate.update({
        where: { id },
        data: { isActive: false },
      });

      await writeActivityLog({
        context: session,
        action: 'PRODUCT_LABEL_TEMPLATE_DELETE',
        module: 'PRODUCTS',
        recordId: id,
        details: `Modelo de etiqueta "${template.name}" inativado.`,
      }, { policy: 'CRITICAL', tx });
    });

    return { success: true };
  } catch (error: any) {
    return { success: false, error: publicActionError(error, 'Erro ao excluir modelo.') };
  }
}
