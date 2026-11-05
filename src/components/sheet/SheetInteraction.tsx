'use client'

import { createContext, type PointerEvent, type ReactNode, useContext } from 'react'
import { FOOTER_ID, HEADER_ID } from '@store/lists/single/types'
import type { SheetBlock } from '@helpers/sheetLayout'

/** A text on the sheet the editor can open in place. */
export type EditTarget =
  | { kind: 'heading' }
  | { kind: 'subheading' }
  | { kind: 'footer' }
  | { kind: 'guest'; id: string }
  | { kind: 'table'; id: string }

export const sameTarget = (a: EditTarget | null, b: EditTarget | null): boolean =>
  Boolean(a && b && a.kind === b.kind && ('id' in a ? a.id : '') === ('id' in b ? b.id : ''))

/** The block (or guest name) a text belongs to: what selecting it selects. */
export const targetBlockId = (target: EditTarget): string =>
  'id' in target ? target.id : target.kind === 'footer' ? FOOTER_ID : HEADER_ID

/**
 * How the editor turns a sheet interactive. The sheet's components only call these; they never
 * import the editor, so nothing the editor draws can reach a preview or the PDF — those render
 * without a provider and are plain.
 */
export type SheetInteraction = {
  selection: ReadonlySet<string>
  /** A block (or a group of them) being dropped onto this one. */
  dropTarget: string | null
  editing: EditTarget | null
  onBlockPointerDown: (event: PointerEvent, block: SheetBlock) => void
  /** A guest's name inside a table block: dragged on its own, to another table. */
  onNamePointerDown: (event: PointerEvent, guestId: string) => void
  /** Opens a text, the caret at `caret` (a character offset) or at its end. */
  onEdit: (target: EditTarget, caret?: number) => void
  /**
   * Whether the click that just happened on this text should open it: the first click selects
   * a block, a second one on an already selected block types into it — never after a drag.
   */
  clickOpensEditor: (target: EditTarget) => boolean
  /** The inline field that replaces a text while it is being edited. */
  renderEditor: (target: EditTarget) => ReactNode
}

const SheetInteractionContext = createContext<SheetInteraction | null>(null)

export const SheetInteractionProvider = SheetInteractionContext.Provider

export const useSheetInteraction = (): SheetInteraction | null => useContext(SheetInteractionContext)
