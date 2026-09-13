// nexus-shell 开发/构建配置：同时编译 core TS 源（含装饰器）与 Vue Custom Element 入口，
// 结构照搬 packages/react/preview/vite.config.ts 的已验证组合。

import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import vue from '@vitejs/plugin-vue'
import babel from 'vite-plugin-babel'

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
const vueRuntime = `${root}/packages/vue/node_modules/vue/dist/vue.esm-bundler.js`

export default defineConfig({
  root: fileURLToPath(new URL('.', import.meta.url)),
  plugins: [decoratorTransform, vue({ customElement: true }), react()],
  resolve: {
    alias: [
      ...createCoreSourceAliases(`${root}/packages/core/src`),
      {
        find: /^@363045841yyt\/klinechart\/web-component$/,
        replacement: `${root}/packages/vue/src/web-component.ts`,
      },
      { find: /^vue$/, replacement: vueRuntime },
    ],
  },
})
