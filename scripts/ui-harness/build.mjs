import { build } from '/opt/npm-tools/node_modules/esbuild/lib/main.js';
await build({ entryPoints: ['entry.tsx'], bundle: true, format: 'esm', target: 'es2022', outfile: 'bundle.js', jsx: 'automatic', loader: { '.json': 'json' },
  alias: { '@src': '/home/claude/s3/devx-planc/src', 'next/link': './stubs/link.tsx', 'next/navigation': './stubs/nav.ts' },
  nodePaths: ['/opt/npm-tools/node_modules'], define: { 'process.env.NODE_ENV': '"production"' }, logLevel: 'warning' });
