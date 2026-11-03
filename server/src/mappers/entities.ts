import type { GuestList, User } from '@prisma/client'
import { coerceContent, coerceDesign } from '../services/listDocument.js'

/** Prisma rows -> the shapes the web reads. Nothing else may hand a row to `ok()`. */

export const mapUser = (user: User) => ({
  id: user.id,
  email: user.email,
  fullName: user.fullName,
  avatarUrl: user.avatarUrl,
  hasPassword: Boolean(user.passwordHash),
  hasGoogle: Boolean(user.googleId),
})

/** `content`/`design` are re-coerced on the way out too, so an old row reads in today's shape. */
export const mapList = (list: GuestList) => ({
  id: list.id,
  title: list.title,
  content: coerceContent(list.content),
  design: coerceDesign(list.design),
  paidAt: list.paidAt?.toISOString() ?? null,
  createdAt: list.createdAt.toISOString(),
  updatedAt: list.updatedAt.toISOString(),
})
