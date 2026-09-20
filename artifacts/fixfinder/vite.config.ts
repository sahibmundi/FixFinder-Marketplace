import path from 'path';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig, loadEnv } from 'vite';

import runtimeErrorOverlay from '@replit/vite-plugin-runtime-error-modal';

const rawPort = process.env.PORT ?? '5173';

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

const basePath = process.env.BASE_PATH ?? '/';

export default defineConfig(async ({ mode }) => {
  const env = loadEnv(mode, path.resolve(import.meta.dirname, '..', '..'), '');
  const clerkPublishableKey =
    process.env.VITE_CLERK_PUBLISHABLE_KEY ??
    process.env.CLERK_PUBLISHABLE_KEY ??
    env.VITE_CLERK_PUBLISHABLE_KEY ??
    env.CLERK_PUBLISHABLE_KEY ??
    '';

  return {
    base: basePath,
    define: {
      // Replit keeps secrets server-side, while Vite only exposes VITE_* values.
      // The publishable Clerk key is safe to embed in the browser bundle.
      'import.meta.env.VITE_CLERK_PUBLISHABLE_KEY':
        JSON.stringify(clerkPublishableKey),
    },
    plugins: [
      react(),
      tailwindcss({ optimize: false }),
      runtimeErrorOverlay(),
      ...(process.env.NODE_ENV !== 'production' &&
      process.env.REPL_ID !== undefined
        ? [
            await import('@replit/vite-plugin-cartographer').then((m) =>
              m.cartographer({
                root: path.resolve(import.meta.dirname, '..'),
              }),
            ),
            await import('@replit/vite-plugin-dev-banner').then((m) =>
              m.devBanner(),
            ),
          ]
        : []),
    ],
    resolve: {
      alias: {
        '@': path.resolve(import.meta.dirname, 'src'),
        '@assets': path.resolve(
          import.meta.dirname,
          '..',
          '..',
          'attached_assets',
        ),
      },
      dedupe: ['react', 'react-dom'],
    },
    root: path.resolve(import.meta.dirname),
    build: {
      outDir: path.resolve(import.meta.dirname, 'dist/public'),
      emptyOutDir: true,
    },
    server: {
      port,
      strictPort: true,
      host: '0.0.0.0',
      allowedHosts: true,
      proxy: {
        '/api': {
          target: process.env.API_PROXY_TARGET ?? env.API_PROXY_TARGET ?? 'http://localhost:8080',
          changeOrigin: true,
        },
      },
      fs: {
        strict: true,
      },
    },
    preview: {
      port,
      host: '0.0.0.0',
      allowedHosts: true,
    },
  };
});
