'use client'

import { type CSSProperties, type FC, type KeyboardEvent, type MouseEvent, type PointerEvent, type ReactNode, useMemo } from 'react'
import type { ListDesign, TextStyle } from '@store/lists/single/types'
import { sheetFontStack } from '@constants/fonts'
import { TEMPLATE_FRAMES } from '@constants/templateFrames'
import { cn } from '@helpers/cn'
import {
  CARD_NAME_SCALE,
  type CardBlock,
  type FooterBlock,
  type GuestBlock,
  type HeaderBlock,
  LINE_HEIGHT,
  type Lines,
  type SheetBlock,
  type SheetLayout,
  type TableBlock,
} from '@helpers/sheetLayout'
import { type ShapeArt, shapeArt, SQUARE_CORNERS } from '@helpers/sheetShape'
import { type EditTarget, sameTarget, type SheetInteraction, useSheetInteraction } from './SheetInteraction'
import './sheet.css'

const mm = (value: number): string => `${Math.round(value * 100) / 100}mm`

/** A text role's inline style. Upper case is already in the lines (`wrapText`), so not here. */
export const textCss = (style: TextStyle, scale: number, sizeFactor = 1): CSSProperties => ({
  fontFamily: sheetFontStack(style.font),
  fontSize: `${Math.round(style.size * scale * sizeFactor * 100) / 100}pt`,
  lineHeight: LINE_HEIGHT,
  color: style.color,
  fontWeight: style.bold ? 700 : 400,
  fontStyle: style.italic ? 'italic' : 'normal',
  letterSpacing: style.tracking ? `${style.tracking / 100}em` : undefined,
  textAlign: style.align,
})

/**
 * A table's name printed outside a seating board's block (beside a name on a list, on a place
 * card). Ribbon and badge styles set the table colour for text on a filled accent band — often
 * white — so off the band it takes the accent itself, which every template sets to read on its
 * background.
 */
const tableLabelColor = (design: ListDesign): string =>
  design.tableStyle === 'ribbon' || design.tableStyle === 'badge' ? design.palette.accent : design.type.group.color

const TextLines: FC<{ lines: Lines; className?: string }> = ({ lines, className }) => (
  <>
    {lines.map((line, index) => (
      <div key={index} className={cn('sh-line', className)}>
        {line}
      </div>
    ))}
  </>
)

/** A text that the editor can open in place on double click (or Enter, when focused). */
type CaretDocument = Document & {
  caretPositionFromPoint?: (x: number, y: number) => { offsetNode: Node; offset: number } | null
  caretRangeFromPoint?: (x: number, y: number) => Range | null
}

/**
 * The character a click landed on, as an offset into the text the lines were wrapped from:
 * the lines before it, each followed by the space the wrap took, plus the offset in its line.
 */
const caretFromClick = (event: MouseEvent, element: HTMLElement): number | undefined => {
  const doc = document as CaretDocument
  let node: Node | null = null
  let offset = 0
  const position = doc.caretPositionFromPoint?.(event.clientX, event.clientY)
  if (position) {
    node = position.offsetNode
    offset = position.offset
  } else {
    const range = doc.caretRangeFromPoint?.(event.clientX, event.clientY)
    if (range) {
      node = range.startContainer
      offset = range.startOffset
    }
  }
  const line = (node?.nodeType === Node.TEXT_NODE ? node.parentElement : (node as Element | null))?.closest('.sh-line')
  const lines = Array.from(element.querySelectorAll('.sh-line'))
  const index = line ? lines.indexOf(line) : -1
  if (index < 0) return undefined
  return lines.slice(0, index).reduce((sum, previous) => sum + (previous.textContent?.length ?? 0) + 1, 0) + offset
}

const EditableText: FC<{
  target: EditTarget
  interaction: SheetInteraction | null
  className?: string
  style?: CSSProperties
  /** Typed in capitals, as it prints (the stored text keeps its own case). */
  uppercase?: boolean
  children: ReactNode
}> = ({ target, interaction, className, style, uppercase, children }) => {
  if (!interaction) {
    return (
      <div className={className} style={style}>
        {children}
      </div>
    )
  }
  if (sameTarget(interaction.editing, target)) {
    return (
      <div className={cn(className, 'sh-editing')} style={{ ...style, textTransform: uppercase ? 'uppercase' : undefined }}>
        {interaction.renderEditor(target)}
      </div>
    )
  }
  const onKeyDown = (event: KeyboardEvent) => {
    if (event.key === 'Enter' || event.key === 'F2') {
      event.preventDefault()
      interaction.onEdit(target)
    }
  }
  const open = (event: MouseEvent) => {
    event.stopPropagation()
    interaction.onEdit(target, caretFromClick(event, event.currentTarget as HTMLElement))
  }
  return (
    <div
      className={cn(className, 'sh-editable')}
      style={style}
      role='textbox'
      tabIndex={0}
      aria-readonly='true'
      // A second click on a selected text, or a double click, puts the caret where it landed.
      onClick={(event) => {
        if (event.detail === 1 && interaction.clickOpensEditor(target)) open(event)
      }}
      onDoubleClick={open}
      onKeyDown={onKeyDown}
    >
      {children}
    </div>
  )
}

type BlockProps<B extends SheetBlock> = { block: B; design: ListDesign; interaction: SheetInteraction | null }

const HeaderView: FC<BlockProps<HeaderBlock>> = ({ block, design, interaction }) => {
  const { type, textScale } = design
  return (
    <>
      {block.heading.length > 0 && (
        <EditableText
          target={{ kind: 'heading' }}
          interaction={interaction}
          className='sh-heading'
          uppercase={type.heading.uppercase}
          style={textCss(type.heading, textScale)}
        >
          <TextLines lines={block.heading} />
        </EditableText>
      )}
      {block.subheading.length > 0 && (
        <EditableText
          target={{ kind: 'subheading' }}
          uppercase={type.subheading.uppercase}
          interaction={interaction}
          className='sh-subheading'
          style={{ ...textCss(type.subheading, textScale), marginTop: block.heading.length ? mm(2 * textScale) : 0 }}
        >
          <TextLines lines={block.subheading} />
        </EditableText>
      )}
    </>
  )
}

const FooterView: FC<BlockProps<FooterBlock>> = ({ block, design, interaction }) => (
  <EditableText
    target={{ kind: 'footer' }}
    interaction={interaction}
    className='sh-footer-text'
    uppercase={design.type.footer.uppercase}
    style={textCss(design.type.footer, design.textScale)}
  >
    <TextLines lines={block.lines} />
  </EditableText>
)

const GuestView: FC<BlockProps<GuestBlock>> = ({ block, design, interaction }) => {
  const { type, textScale } = design
  return (
    <div className='sh-guest-row'>
      <EditableText
        target={{ kind: 'guest', id: block.guest.id }}
        uppercase={type.name.uppercase}
        interaction={interaction}
        className='sh-guest-name'
        style={{ ...textCss(type.name, textScale), width: block.tableName ? mm(block.w - block.tableW - 3 * textScale) : '100%' }}
      >
        <TextLines lines={block.lines} />
      </EditableText>
      {block.tableName && (
        <div className='sh-guest-table' style={{ ...textCss(type.name, textScale), color: tableLabelColor(design), textAlign: 'right' }}>
          {block.tableName}
        </div>
      )}
    </div>
  )
}

const TableView: FC<BlockProps<TableBlock>> = ({ block, design, interaction }) => {
  const { type, textScale } = design
  return (
    <div className='sh-table-inner' style={{ padding: mm(block.pad) }}>
      <div className={cn('sh-table-head', `sh-align-${type.group.align}`)} style={{ height: mm(block.headH) }}>
        <EditableText
          target={{ kind: 'table', id: block.table.id }}
          uppercase={type.group.uppercase}
          interaction={interaction}
          className='sh-table-name'
          style={{ ...textCss(type.group, textScale), paddingBlock: mm(block.headPad), paddingInline: mm(block.headPad * 2) }}
        >
          <TextLines lines={block.head} />
        </EditableText>
      </div>
      {block.guests.length > 0 && (
        <div className='sh-table-guests' style={{ marginTop: mm(block.headGap) }}>
          {block.guests.map(({ guest, lines }) => (
            <div
              key={guest.id}
              className={cn(
                'sh-name',
                interaction?.selection.has(guest.id) && 'sh-selected',
                interaction?.dropTarget === guest.id && 'sh-drop-target'
              )}
              data-guest-id={guest.id}
              onPointerDown={interaction ? (event: PointerEvent) => interaction.onNamePointerDown(event, guest.id) : undefined}
            >
              <EditableText
                target={{ kind: 'guest', id: guest.id }}
                interaction={interaction}
                uppercase={type.name.uppercase}
                style={textCss(type.name, textScale)}
              >
                <TextLines lines={lines} />
              </EditableText>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

const CardFace: FC<{ block: CardBlock; design: ListDesign; flipped?: boolean; interaction: SheetInteraction | null }> = ({
  block,
  design,
  flipped,
  interaction,
}) => {
  const { type, textScale } = design
  return (
    <div className={cn('sh-card-face', flipped && 'sh-card-flipped')} style={{ height: mm(block.faceH) }}>
      <EditableText
        target={{ kind: 'guest', id: block.guest.id }}
        uppercase={type.name.uppercase}
        interaction={flipped ? null : interaction}
        className='sh-card-name'
        style={textCss(type.name, textScale, CARD_NAME_SCALE)}
      >
        <TextLines lines={block.lines} />
      </EditableText>
      {block.tableName && (
        <div className='sh-card-table' style={{ ...textCss(type.group, textScale), color: tableLabelColor(design) }}>
          {block.tableName}
        </div>
      )}
      {block.note && (
        <div className='sh-card-note' style={textCss(type.subheading, textScale)}>
          {block.note}
        </div>
      )}
    </div>
  )
}

const CardView: FC<BlockProps<CardBlock>> = ({ block, design, interaction }) =>
  design.layout.cardFold ? (
    <>
      <CardFace block={block} design={design} flipped interaction={interaction} />
      <div className='sh-card-fold' aria-hidden='true' />
      <CardFace block={block} design={design} interaction={interaction} />
    </>
  ) : (
    <CardFace block={block} design={design} interaction={interaction} />
  )

const BlockView: FC<{ block: SheetBlock; design: ListDesign; interaction: SheetInteraction | null }> = ({ block, design, interaction }) => {
  const style: CSSProperties = { left: mm(block.x), top: mm(block.y), width: mm(block.w), height: mm(block.h) }
  const selected = interaction?.selection.has(block.id)
  return (
    <div
      className={cn(
        'sh-block',
        `sh-${block.type}`,
        block.type === 'card' && design.layout.cutMarks && 'sh-card-cut',
        selected && 'sh-selected',
        interaction?.dropTarget === block.id && 'sh-drop-target'
      )}
      style={style}
      data-block-id={block.id}
      data-block-type={block.type}
      onPointerDown={interaction ? (event: PointerEvent) => interaction.onBlockPointerDown(event, block) : undefined}
    >
      {block.type === 'header' && <HeaderView block={block} design={design} interaction={interaction} />}
      {block.type === 'footer' && <FooterView block={block} design={design} interaction={interaction} />}
      {block.type === 'guest' && <GuestView block={block} design={design} interaction={interaction} />}
      {block.type === 'table' && <TableView block={block} design={design} interaction={interaction} />}
      {block.type === 'card' && <CardView block={block} design={design} interaction={interaction} />}
      {/* Only a table is resized by hand; names, cards and texts are moved, not sized. */}
      {interaction && block.type === 'table' && (
        <span
          className='sh-resize'
          aria-hidden='true'
          onPointerDown={(event: PointerEvent) => interaction.onResizePointerDown(event, block)}
        />
      )}
    </div>
  )
}

/**
 * What the template paints under the blocks: its background and decor. On a shaped sheet it
 * sits in the outline's box, clipped to the outline with a little bleed; the template's
 * rectangular frame gives way to the same frame drawn along the outline, and ornaments on
 * curved corners are left out.
 */
const SheetFace: FC<{ design: ListDesign; art: ShapeArt | null; corners: readonly boolean[] }> = ({ design, art, corners }) => {
  const decor = design.decor && design.kind !== 'cards'
  const hide = art ? (TEMPLATE_FRAMES[design.templateId]?.hide ?? []) : []
  const { face } = art ?? { face: null }
  return (
    <div
      className={cn(
        'sh-face',
        hide.map((part) => `sh-hide-${part}`),
        corners.map((square, index) => !square && `sh-hide-d${index + 1}`)
      )}
      style={face && art ? { left: mm(face.x), top: mm(face.y), width: mm(face.w), height: mm(face.h), clipPath: art.clipPath } : undefined}
    >
      {decor && (
        <div className='sh-decor' aria-hidden='true'>
          <i className='sh-d1' />
          <i className='sh-d2' />
          <i className='sh-d3' />
          <i className='sh-d4' />
        </div>
      )}
      {decor && face && art && art.frame.length > 0 && (
        <svg className='sh-frame' viewBox={`${face.x} ${face.y} ${face.w} ${face.h}`} preserveAspectRatio='none' aria-hidden='true'>
          {art.frame.map((stroke, index) => (
            <path
              key={index}
              d={stroke.d}
              style={{
                stroke: stroke.color ?? 'var(--sh-accent)',
                strokeWidth: stroke.width,
                strokeDasharray: stroke.dash,
                strokeLinecap: stroke.round ? 'round' : undefined,
                strokeOpacity: stroke.opacity,
              }}
            />
          ))}
        </svg>
      )}
    </div>
  )
}

type Props = {
  design: ListDesign
  layout: SheetLayout
  className?: string
  /** Drawn on every page, above the blocks: the free print's watermark. */
  pageOverlay?: ReactNode
  /** Drawn on every page under the blocks, by the editor: its page label, its guides. */
  renderPageExtras?: (page: number) => ReactNode
}

/**
 * The sheet, page by page: what the editor edits, what previews show, what the PDF prints.
 * Every block is absolutely placed where `layoutSheet` put it; the template's look is
 * `sheet.css` under `.sht-<template>` and the table style under `.sh-ts-<style>`. A shaped
 * sheet (`layout.shape`) is plain paper with the design inside its outline and a cut line along it.
 */
export const SheetDocument: FC<Props> = ({ design, layout, className, pageOverlay, renderPageExtras }) => {
  const interaction = useSheetInteraction()
  const { shape, width, height } = layout
  const art = useMemo(
    () => (shape === 'rectangle' ? null : shapeArt(shape, width, height, TEMPLATE_FRAMES[design.templateId])),
    [shape, width, height, design.templateId]
  )
  const vars = {
    '--sh-bg': design.palette.background,
    '--sh-accent': design.palette.accent,
    '--sh-panel': design.palette.panel,
  } as CSSProperties

  return (
    <div
      className={cn(
        'sh-root',
        `sht-${design.templateId}`,
        `sh-ts-${design.tableStyle}`,
        `sh-kind-${design.kind}`,
        design.decor ? 'sh-decorated' : 'sh-plain',
        interaction && 'sh-interactive',
        className
      )}
      style={vars}
    >
      {Array.from({ length: layout.pages }, (_, page) => (
        <section
          key={page}
          className={cn('sh-page', art && `sh-shaped sh-shape-${shape}`)}
          style={{ width: mm(layout.width), height: mm(layout.height) }}
          data-page={page}
        >
          <SheetFace design={design} art={art} corners={SQUARE_CORNERS[shape]} />
          {art && (
            <svg className='sh-cutline' viewBox={`0 0 ${width} ${height}`} preserveAspectRatio='none' aria-hidden='true'>
              <path d={art.cut} />
            </svg>
          )}
          {renderPageExtras?.(page)}
          {layout.blocks
            .filter((block) => block.page === page)
            .map((block) => (
              <BlockView key={`${block.type}:${block.id}`} block={block} design={design} interaction={interaction} />
            ))}
          {pageOverlay}
        </section>
      ))}
    </div>
  )
}
