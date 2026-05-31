export const useFirestore = () => ({}) as any;
export const useCollection = (query: any) => ({ data: [] as any[], isLoading: false, error: null }) as any;
export const useMemoFirebase = (fn: any, deps?: any[]) => (fn ? fn() : null) as any;
export const useUser = () => ({ user: null as any, loading: false, isUserLoading: false }) as any;
export const useAuth = () => ({ user: null as any, loading: false, currentUser: null as any, onAuthStateChanged: (cb: any) => () => {} }) as any;
export const useDoc = (ref: any) => ({ data: {} as any, isLoading: false, error: null }) as any;
export const errorEmitter = { on: (...args: any[]) => {}, off: (...args: any[]) => {} };
export class FirestorePermissionError extends Error {}
