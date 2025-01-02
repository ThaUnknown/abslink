import typescript from '@rollup/plugin-typescript'
import terser from '@rollup/plugin-terser'
import { sync } from 'rimraf'
import path from 'path'

function config ({ format, minify, input, ext = 'js' }) {
  const dir = `dist/${format}`
  const minifierSuffix = minify ? '.min' : ''
  const filename = path.basename(input)
  return {
    input: `./${input}.ts`,
    output: {
      name: 'Abslink',
      file: `${dir}/${filename}${minifierSuffix}.${ext}`,
      format,
      sourcemap: true
    },
    plugins: [
      typescript({
        tsconfig: './tsconfig.json',
        compilerOptions: {
          declaration: true,
          declarationDir: dir,
          sourceMap: true
        }
      }),
      minify
        ? terser({
          compress: true,
          mangle: true
        })
        : undefined
    ].filter(Boolean)
  }
}

sync('dist')

export default [
  { input: 'src/abslink', format: 'esm', minify: false, ext: 'mjs' },
  { input: 'src/abslink', format: 'esm', minify: true, ext: 'mjs' },
  { input: 'src/abslink', format: 'esm', minify: false },
  { input: 'src/abslink', format: 'esm', minify: true },
  { input: 'src/abslink', format: 'umd', minify: false },
  { input: 'src/abslink', format: 'umd', minify: true },
  { input: 'adapters/worker', format: 'esm', minify: false, ext: 'mjs' },
  { input: 'adapters/worker', format: 'esm', minify: true, ext: 'mjs' },
  { input: 'adapters/worker', format: 'esm', minify: false },
  { input: 'adapters/worker', format: 'esm', minify: true },
  { input: 'adapters/worker', format: 'umd', minify: false },
  { input: 'adapters/worker', format: 'umd', minify: true }
].map(config)
