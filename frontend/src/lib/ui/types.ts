export type NavLink = {
  label: string;
  href: string;
  icon?: string;
  badge?: string;
};

export type NavSection =
  | NavLink
  | {
      label: string;
      icon?: string;
      items: NavLink[];
    };

export type DataTableColumn<T extends Record<string, unknown>> = {
  key: keyof T | string;
  header: string;
  align?: 'left' | 'center' | 'right';
  width?: string;
  render?: (context: { value: unknown; row: T; index: number }) => string | number | null | undefined;
  class?: string;
};
