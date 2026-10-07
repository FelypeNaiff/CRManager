'use client';

import React, { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { getLabelTemplateById } from '@/lib/crm/labels-actions';
import { getProducts } from '@/lib/crm/products-actions';
import { Printer, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function ImprimirEtiquetasPage() {
  const searchParams = useSearchParams();
  const templateId = searchParams.get('templateId');
  const itemsParam = searchParams.get('items'); // format: "id1:qty1,id2:qty2"

  const [template, setTemplate] = useState<any>(null);
  const [labels, setLabels] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!templateId || !itemsParam) {
      setLoading(false);
      return;
    }

    const loadData = async () => {
      try {
        const tRes = await getLabelTemplateById(templateId);
        if (tRes.success && tRes.data) {
          setTemplate(tRes.data);
        } else {
          setLoading(false);
          return;
        }

        // Parse items
        const selections = itemsParam.split(',').map(s => {
          const [id, qty] = s.split(':');
          return { id, qty: parseInt(qty) };
        });
        
        // Fetch products
        const pRes = await getProducts({ search: '' }) as any;
        if (pRes?.success && pRes?.data) {
          const generatedLabels: any[] = [];
          for (const sel of selections) {
            const product = pRes.data.find((p: any) => p.id === sel.id);
            if (product) {
              for (let i = 0; i < sel.qty; i++) {
                generatedLabels.push(product);
              }
            }
          }
          setLabels(generatedLabels);
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [templateId, itemsParam]);

  if (loading) {
    return <div className="p-8 text-center text-muted-foreground print:hidden">Carregando dados para impressão...</div>;
  }

  if (!template) {
    return <div className="p-8 text-center text-red-500 print:hidden">Modelo de etiqueta inválido ou não encontrado.</div>;
  }

  // Dimension helpers
  const labelWidth = Number(template.labelWidthCm);
  const labelHeight = Number(template.labelHeightCm);
  const horizontalGap = Number(template.horizontalPitchCm) - labelWidth;
  const verticalGap = Number(template.verticalPitchCm) - labelHeight;
  
  // Custom font size map
  const fontSizePx = Math.round((template.fontSizePt || 6) * 1.3333); // approx pt to px

  // Very simple SVG barcode generator for Code128 approximation (visual only for this prototype, normally would use jsbarcode)
  // For production, we render a placeholder block or use a proper library.
  const BarcodePlaceholder = ({ code }: { code: string }) => (
    <div className="flex flex-col items-center justify-center w-full h-full">
      <div className="w-[80%] h-6 bg-repeating-linear-gradient(to right, #000, #000 2px, transparent 2px, transparent 4px, #000 4px, #000 5px, transparent 5px, transparent 8px)" style={{ backgroundSize: '100% 100%' }}></div>
      {template.showBarcodeDigits && <div style={{ fontSize: `${fontSizePx - 2}px` }}>{code}</div>}
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-100">
      {/* Top Bar for Screen only */}
      <div className="print:hidden fixed top-0 left-0 right-0 bg-white border-b shadow-sm p-4 flex items-center justify-between z-50">
        <div className="flex items-center gap-4">
          <Button variant="ghost" onClick={() => window.close()}>
            <ArrowLeft className="w-4 h-4 mr-2" /> Voltar
          </Button>
          <div className="text-sm font-medium text-slate-700">
            Imprimindo {labels.length} etiquetas usando padrão: <span className="font-bold">{template.name}</span>
          </div>
        </div>
        <Button onClick={() => window.print()} className="bg-[#12213a] text-white">
          <Printer className="w-4 h-4 mr-2" /> Imprimir Agora
        </Button>
      </div>

      <style dangerouslySetInnerHTML={{__html: `
        @media print {
          @page {
            size: A4;
            margin: 0;
          }
          body {
            margin: 0;
            background: white;
            -webkit-print-color-adjust: exact;
          }
        }
      `}} />

      {/* Pages Container */}
      <div className="print:m-0 pt-20 print:pt-0 mx-auto" style={{ width: '210mm' }}>
        <div 
          className="bg-white mx-auto overflow-hidden print:shadow-none shadow-md mb-8 print:mb-0"
          style={{
            width: '210mm',
            minHeight: '297mm', // A4
            paddingTop: `${template.marginTopCm}cm`,
            paddingLeft: `${template.marginLeftCm}cm`,
            paddingRight: `${template.marginLeftCm}cm`, // symmetric approx
            fontFamily: template.fontFamily,
            pageBreakAfter: 'always',
          }}
        >
          <div 
            style={{
              display: 'grid',
              gridTemplateColumns: `repeat(${template.columnsOnPage}, ${labelWidth}cm)`,
              gridAutoRows: `${labelHeight}cm`,
              columnGap: `${horizontalGap}cm`,
              rowGap: `${verticalGap}cm`,
            }}
          >
            {labels.map((item, index) => {
              // Truncate name
              const displayName = template.maxCharsProductName 
                ? item.name.substring(0, template.maxCharsProductName) 
                : item.name;

              return (
                <div 
                  key={index}
                  className="flex flex-col border border-dashed border-slate-300 print:border-transparent overflow-hidden"
                  style={{ 
                    width: `${labelWidth}cm`, 
                    height: `${labelHeight}cm`,
                    padding: '2mm',
                    fontSize: `${fontSizePx}px`
                  }}
                >
                  {template.topDescription && (
                    <div className="font-bold text-center leading-tight mb-1">{template.topDescription}</div>
                  )}
                  
                  {template.showBarcode && template.barcodePosition === 'Superior' && (
                    <div className="mb-1 h-8"><BarcodePlaceholder code={item.barcode || item.internalCode || '000000'} /></div>
                  )}

                  <div className="font-semibold text-center leading-tight overflow-hidden text-ellipsis line-clamp-2">
                    {displayName}
                  </div>

                  <div className="flex-1" />

                  {template.showInternalCode && (
                    <div className="text-center font-mono leading-tight">{item.internalCode}</div>
                  )}

                  {template.showPrice && (
                    <div className={`text-center font-bold leading-tight ${template.priceFontSize === 'Maior' ? 'text-[1.2em]' : ''}`}>
                      R$ {Number(item.salePrice).toFixed(2)}
                    </div>
                  )}

                  {template.showBarcode && template.barcodePosition === 'Inferior' && (
                    <div className="mt-1 h-8"><BarcodePlaceholder code={item.barcode || item.internalCode || '000000'} /></div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
