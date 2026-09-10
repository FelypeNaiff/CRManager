export interface BaseProfileSelectionIdentity {
  email: string
}

export async function requireProfileSelectionIdentity<T extends BaseProfileSelectionIdentity>(
  resolveBaseContext: () => Promise<T>,
  redirectToLogin: () => never
): Promise<BaseProfileSelectionIdentity> {
  try {
    const context = await resolveBaseContext()
    return { email: context.email }
  } catch {
    return redirectToLogin()
  }
}
