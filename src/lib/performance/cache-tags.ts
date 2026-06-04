export const CACHE_TAGS = {
  CATEGORIES: (companyId: string) => `categories-${companyId}`,
  SUPPLIERS: (companyId: string) => `suppliers-${companyId}`,
  PAYMENT_METHODS: (companyId: string) => `payment-methods-${companyId}`,
  ROLES: (companyId: string) => `roles-${companyId}`,
  SETTINGS: (companyId: string) => `settings-${companyId}`
};
