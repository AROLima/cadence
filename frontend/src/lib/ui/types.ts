import type { Component } from 'svelte';

export type ResolvableIcon = Component | string;

export type NavLink = {
  label: string;
  href: string;
  icon?: ResolvableIcon;
  badge?: string;
};

export type NavSection =
  | NavLink
  | {
      label: string;
      icon?: ResolvableIcon;
      items: NavLink[];
    };

export type DataTableColumn<T extends Record<string, unknown>> = {
  key: keyof T | string;
  header: string;
  align?: 'left' | 'center' | 'right';
  width?: string;
  icon?: Component;
  render?: (context: { value: unknown; row: T; index: number }) => string | number | null | undefined;
  class?: string;
};
