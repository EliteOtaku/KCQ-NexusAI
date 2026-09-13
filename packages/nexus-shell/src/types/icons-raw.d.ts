// ~icons 虚拟模块 ?raw 查询的类型声明：unplugin-icons 官方类型只覆盖默认导入
// （编译为组件），raw 字符串导入由本声明补充。

declare module '~icons/*?raw' {
  const svg: string
  export default svg
}
