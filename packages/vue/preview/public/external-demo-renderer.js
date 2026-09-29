/**
 * 外部渲染器插件 Demo（无状态）：主图中部蓝色虚线参考线 + 标签。
 *
 * 用法：预览工作台 URL 追加 ?externalRenderers=/external-demo-renderer.js
 * （本文件经 preview/public/ 原样服务，纯 ESM，不经 vite 转换）。
 * 契约：default 导出 RendererPlugin（name/draw 必填，见 core foundation/plugin/types）。
 */
const plugin = {
  name: 'kcq_demo_external',
  version: '1.0.0',
  description: '外部渲染器加载点 Demo：主图中部虚线参考线',
  debugName: 'ExternalDemo',
  paneId: 'main',
  priority: 9999,
  draw(context) {
    const ctx = context && context.ctx
    const pane = context && context.pane
    if (!ctx || !pane) return
    const width = pane.width || 800
    const y = pane.height * 0.5
    ctx.save()
    ctx.setLineDash([6, 4])
    ctx.strokeStyle = 'rgba(41, 98, 255, 0.55)'
    ctx.lineWidth = 1
    ctx.beginPath()
    ctx.moveTo(0, y)
    ctx.lineTo(width, y)
    ctx.stroke()
    ctx.setLineDash([])
    ctx.fillStyle = 'rgba(41, 98, 255, 0.85)'
    ctx.font = '11px sans-serif'
    ctx.textBaseline = 'bottom'
    ctx.fillText('EXTERNAL RENDERER OK', 8, y - 4)
    ctx.restore()
  },
}

export default plugin
