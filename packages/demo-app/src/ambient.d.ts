/// <reference types="node" />

declare module 'vite' {
  export interface UserConfig {
    [key: string]: unknown;
  }
  export function defineConfig(config: UserConfig): UserConfig;
}

declare module 'vite/client' {
  interface ImportMetaEnv {
    [key: string]: unknown;
  }
  interface ImportMeta {
    readonly env: ImportMetaEnv;
  }
}

declare module 'vitest' {
  export interface Assertion {
    toBe(expected: unknown): void;
    toEqual(expected: unknown): void;
    toBeDefined(): void;
    toHaveLength(expected: number): void;
    [key: string]: unknown;
  }
  export function describe(name: string, fn: () => void | Promise<void>): void;
  export function it(name: string, fn: () => void | Promise<void>): void;
  export function test(name: string, fn: () => void | Promise<void>): void;
  export function expect(val: unknown): Assertion;
}

declare module '*.css' {
  const content: string;
  export default content;
}
