'use client';

import { useState, useEffect } from 'react';
import { errorEmitter } from '@/supabase-mocks/error-emitter';
import { FirestorePermissionError } from '@/supabase-mocks/errors';
import { toast } from '@/hooks/use-toast';

export function supabase-mocksErrorListener() {
  useEffect(() => {
    const handleError = (error: FirestorePermissionError) => {
      // Instead of throwing the error and crashing the React tree,
      // we just show a toast notification to the user.
      toast({
        variant: "destructive",
        title: "Acesso Negado",
        description: error.message || "Você não tem permissão para visualizar estes dados.",
      });
    };

    errorEmitter.on('permission-error', handleError);

    return () => {
      errorEmitter.off('permission-error', handleError);
    };
  }, []);

  return null;
}

