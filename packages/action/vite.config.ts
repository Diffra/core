import path from 'node:path';
import { defineConfig } from 'vite';

export default defineConfig({
  build: {
    lib: {
      entry: path.resolve(__dirname, 'src/index.ts'),
      name: 'DiffraAction',
      fileName: () => 'action.js',
      formats: ['cjs'],
    },
    outDir: path.resolve(__dirname, '../../dist'),
    emptyOutDir: false,
    rollupOptions: {
      external: [
        'node:fs',
        'node:fs/promises',
        'node:path',
        'node:http',
        'node:url',
        'node:child_process',
        'node:os',
        'playwright',
        '@diffra/diff',
        '@google-cloud/storage',
        '@aws-sdk/client-s3',
        '@azure/storage-blob',
        /^@oxc-parser\/.*/,
      ],
    },
  },
});
