import typescript from "@rollup/plugin-typescript"
import terser from "@rollup/plugin-terser"
import { sync } from "rimraf"

function config ({ format, minify, input, ext = "js" }) {
  const dir = `dist/${format}/`
  const minifierSuffix = minify ? ".min" : ""
  return {
    input: `./src/${input}.ts`,
    output: {
      name: "Abslink",
      file: `${dir}/${input}${minifierSuffix}.${ext}`,
      format,
      sourcemap: true,
    },
    plugins: [
      typescript({
        tsconfig: "./tsconfig.json",
        compilerOptions: {
          declaration: true,
          declarationDir: ".",
          sourceMap: true,
          outDir: "dist",
        },
      }),
      minify
        ? terser({
          compress: true,
          mangle: true,
        })
        : undefined,
    ].filter(Boolean),
  }
}

sync("dist")

export default [
  { input: "abslink", format: "esm", minify: false, ext: "mjs" },
  { input: "abslink", format: "esm", minify: true, ext: "mjs" },
  { input: "abslink", format: "esm", minify: false },
  { input: "abslink", format: "esm", minify: true },
  { input: "abslink", format: "umd", minify: false },
  { input: "abslink", format: "umd", minify: true }
].map(config)
