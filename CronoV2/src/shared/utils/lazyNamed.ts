import { lazy, type ComponentType } from 'react';
// Accepts components with any props; the `any` is intentional (see no-explicit-any).
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function lazyNamed<T extends Record<string, ComponentType<any>>, K extends keyof T>(factory: () => Promise<T>, name: K) {
  return lazy(async () => { const module = await factory(); return { default: module[name] }; });
}
