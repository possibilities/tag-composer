import { defineConfig } from 'tsup'

export default defineConfig([
  {
    entry: {
      cli: 'src/index.ts',
    },
    format: ['esm'],
    target: 'node18',
    outDir: 'dist',
    clean: true,
    sourcemap: false,
    dts: false,
    bundle: true,
    outExtension() {
      return {
        js: '.js',
      }
    },
    esbuildOptions(options) {
      options.banner = {
        js: '#!/usr/bin/env node',
      }
      options.platform = 'node'
      options.format = 'esm'
    },
  },
  {
    entry: {
      index: 'src/lib.ts',
    },
    format: ['esm'],
    target: 'node18',
    outDir: 'dist',
    clean: false,
    sourcemap: false,
    dts: true,
    bundle: true,
    outExtension() {
      return {
        js: '.js',
      }
    },
    esbuildOptions(options) {
      options.platform = 'node'
      options.format = 'esm'
    },
  },
])
