import React from 'react';
import { Button } from '@/components/ui/button';
import { Loader2, AlertCircle, Clock, User } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface ConfigFormActionsProps {
  isSaving: boolean;
  isDirty?: boolean;
  disabled?: boolean;
  onSave?: (e?: React.FormEvent) => void;
  onCancel?: () => void;
  saveLabel?: string;
  cancelLabel?: string;
  updatedAt?: Date | string | null;
  updatedBy?: string | null;
  className?: string;
}

export function ConfigFormActions({
  isSaving,
  isDirty = false,
  disabled = false,
  onSave,
  onCancel,
  saveLabel = 'Salvar Alterações',
  cancelLabel = 'Cancelar',
  updatedAt,
  updatedBy,
  className,
}: ConfigFormActionsProps) {
  const formattedDate = updatedAt
    ? new Date(updatedAt).toLocaleString('pt-BR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      })
    : null;

  return (
    <div
      className={cn(
        'sticky bottom-4 z-40 flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 mt-8 rounded-xl border shadow-md w-full transition-all backdrop-blur-md',
        isDirty ? 'border-amber-300 bg-amber-50/95' : 'border-slate-200 bg-white/95',
        className
      )}
    >
      {/* Informações de Status e Auditoria */}
      <div className="flex flex-col gap-1 text-xs">
        {isDirty ? (
          <div className="flex items-center gap-1.5 text-amber-600 font-medium animate-in fade-in slide-in-from-left-2">
            <AlertCircle className="h-4 w-4" />
            <span>Alterações não salvas</span>
          </div>
        ) : (
          <div className="flex flex-col gap-0.5 text-muted-foreground">
            {formattedDate && (
              <span className="flex items-center gap-1.5">
                <Clock className="h-3.5 w-3.5" />
                Última atualização: {formattedDate}
              </span>
            )}
            {updatedBy && (
              <span className="flex items-center gap-1.5">
                <User className="h-3.5 w-3.5" />
                Por: {updatedBy}
              </span>
            )}
            {!formattedDate && !updatedBy && (
              <span className="text-slate-400">Nenhuma alteração pendente</span>
            )}
          </div>
        )}
      </div>

      {/* Botões de Ação */}
      <div className="flex items-center gap-3 self-end sm:self-auto">
        {onCancel && (
          <Button
            variant="outline"
            type="button"
            onClick={onCancel}
            disabled={isSaving || (!isDirty && !updatedAt)}
            className="min-w-[100px]"
          >
            {cancelLabel}
          </Button>
        )}

        <Button
          type={onSave ? 'button' : 'submit'}
          onClick={onSave}
          disabled={isSaving || disabled || !isDirty}
          className="min-w-[140px] bg-primary text-primary-foreground transition-all"
        >
          {isSaving ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Salvando...
            </>
          ) : (
            saveLabel
          )}
        </Button>
      </div>
    </div>
  );
}
