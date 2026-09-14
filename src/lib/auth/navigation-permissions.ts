export interface PermissionNavigationItem {
  url?: string;
  items?: PermissionNavigationItem[];
  [key: string]: unknown;
}

export function filterNavigationItems<T extends PermissionNavigationItem>(
  items: T[],
  canAccessRoute: (pathname: string) => boolean,
): T[] {
  return items.flatMap((item) => {
    if (item.items) {
      const allowedChildren = filterNavigationItems(item.items, canAccessRoute);
      return allowedChildren.length > 0 ? [{ ...item, items: allowedChildren } as T] : [];
    }
    if (!item.url) return [];
    return canAccessRoute(item.url.split('?')[0]) ? [item] : [];
  });
}
