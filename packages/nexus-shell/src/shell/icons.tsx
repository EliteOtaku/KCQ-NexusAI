// 壳图标登记表：统一经 unplugin-icons（Tabler，MIT）以 ?raw 引入 SVG 字符串，
// 由 ToolIcon 包装渲染；禁止内联 SVG 与官方 TV 图标。
// 选 raw 编译而非 jsx：jsx 需要 @svgr/core（工作区未引入），raw 零新增依赖。

import rawArrowRight from '~icons/tabler/arrow-right?raw'
import rawArrowUpRight from '~icons/tabler/arrow-up-right?raw'
import rawBookmark from '~icons/tabler/bookmark?raw'
import rawBrackets from '~icons/tabler/brackets?raw'
import rawCaretUpDown from '~icons/tabler/caret-up-down?raw'
import rawChartDots3 from '~icons/tabler/chart-dots-3?raw'
import rawChartLine from '~icons/tabler/chart-line?raw'
import rawCrosshair from '~icons/tabler/crosshair?raw'
import rawDeviceFloppy from '~icons/tabler/device-floppy?raw'
import rawEraser from '~icons/tabler/eraser?raw'
import rawInfoCircle from '~icons/tabler/info-circle?raw'
import rawLock from '~icons/tabler/lock?raw'
import rawLockOpen from '~icons/tabler/lock-open?raw'
import rawMagnet from '~icons/tabler/magnet?raw'
import rawMinus from '~icons/tabler/minus?raw'
import rawPencil from '~icons/tabler/pencil?raw'
import rawPointer from '~icons/tabler/pointer?raw'
import rawRuler2 from '~icons/tabler/ruler-2?raw'
import rawSelect from '~icons/tabler/select?raw'
import rawSeparator from '~icons/tabler/separator?raw'
import rawShape from '~icons/tabler/shape?raw'
import rawStar from '~icons/tabler/star?raw'
import rawStarFilled from '~icons/tabler/star-filled?raw'
import rawTrash from '~icons/tabler/trash?raw'
import rawX from '~icons/tabler/x?raw'
import rawZoomIn from '~icons/tabler/zoom-in?raw'
import rawZoomOut from '~icons/tabler/zoom-out?raw'

/** 图标名 → SVG 字符串。 */
export const SHELL_ICON_SVGS: Readonly<Record<string, string>> = {
  pointer: rawPointer,
  select: rawSelect,
  'ruler-2': rawRuler2,
  eraser: rawEraser,
  'chart-line': rawChartLine,
  'arrow-up-right': rawArrowUpRight,
  minus: rawMinus,
  'arrow-right': rawArrowRight,
  separator: rawSeparator,
  crosshair: rawCrosshair,
  'info-circle': rawInfoCircle,
  shape: rawShape,
  'chart-dots-3': rawChartDots3,
  'caret-up-down': rawCaretUpDown,
  brackets: rawBrackets,
  magnet: rawMagnet,
  star: rawStar,
  'star-filled': rawStarFilled,
  lock: rawLock,
  'lock-open': rawLockOpen,
  trash: rawTrash,
  'zoom-in': rawZoomIn,
  'zoom-out': rawZoomOut,
  bookmark: rawBookmark,
  'device-floppy': rawDeviceFloppy,
  pencil: rawPencil,
  x: rawX,
}

/**
 * 按名渲染图标：SVG 内容为安装包内静态字符串（非用户输入），innerHTML 注入安全。
 * @param name 图标名（drawingTools 目录或组件内直接引用）
 * @param className 追加到包装元素的类名（尺寸/颜色由外层 CSS 控制）
 */
export function ToolIcon({ name, className }: { name: string; className?: string }) {
  const svg = SHELL_ICON_SVGS[name]
  if (svg === undefined) return null
  return (
    <span
      className={`nx-icon${className === undefined ? '' : ` ${className}`}`}
      aria-hidden="true"
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  )
}
