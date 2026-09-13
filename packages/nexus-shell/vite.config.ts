// nexus-shell 开发/构建配置：
// - 壳直接消费 core 源码（createChartController 挂载），不再引入 Vue Web Component，
//   因此仅需 React 插件 + core TS 源（含装饰器）的 Babel 转换。
// - 图标经 unplugin-icons 以 raw SVG 编译（Tabler；jsx 编译需 @svgr/core，工作区未引入）。
// - dev server 固定 5273，避开上游 5173/5175。

import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import babel from 'vite-plugin-babel'
import Icons from 'unplugin-icons/vite'

import { createCoreSourceAliases } from '../../scripts/core-source-aliases.mjs'

// core 源码使用 2023-11 版装饰器提案，Vite 原生 esbuild 不支持，须经 Babel 转换。
const decoratorTransform = babel({
  include: [/\/packages\/core\/src\/.*\.tsx?$/],
  exclude: [/node_modules/],
  babelConfig: {
    babelrc: false,
    configFile: false,
    plugins: [
      ['@babel/plugin-proposal-decorators', { version: '2023-11' }],
      ['@babel/plugin-transform-typescript', { allowDeclareFields: true }],
    ],
  },
})

const root = fileURLToPath(new URL('../..', import.meta.url))

export default defineConfig({
  root: fileURLToPath(new URL('.', import.meta.url)),
  plugins: [
    decoratorTransform,
    react(),
    Icons({ compiler: 'raw', autoInstall: true }),
  ],
  resolve: {
    alias: [...createCoreSourceAliases(`${root}/packages/core/src`)],
  },
  server: {
    port: 5273,
    strictPort: false,
  },
})
