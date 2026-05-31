"use client";

import { useEffect, useState, useCallback } from "react";

export interface ClientSession {
  userId: string;
  name: string;
  email: string;
  role: string;
  isAdmin: boolean;
  companyId: string;
}

interface UseSessionResult {
  session: ClientSession | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  refresh: () => void;
}

/**
 * Client-side hook that reads the active profile session from the server
 * via /api/auth/session.
 *
 * The session is derived from the HTTP-only cookie — it cannot be tampered
 * with from the browser.
 *
 * @example
 * const { session, isAuthenticated, isLoading } = useSession();
 */
export function useSession(): UseSessionResult {
  const [session, setSession] = useState<ClientSession | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  const fetchSession = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await fetch("/api/auth/session", { cache: "no-store" });
      if (res.ok) {
        const data = await res.json();
        setIsAuthenticated(data.authenticated ?? false);
        setSession(data.session ?? null);
      } else {
        setIsAuthenticated(false);
        setSession(null);
      }
    } catch {
      setIsAuthenticated(false);
      setSession(null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSession();
  }, [fetchSession]);

  return { session, isAuthenticated, isLoading, refresh: fetchSession };
}
