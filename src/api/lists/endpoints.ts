export const ENDPOINTS = {
  list: '/lists',
  create: '/lists',
  single: '/lists',
  update: '/lists',
  remove: '/lists',
  duplicate: '/lists',
  pdf: '/lists',
  /** The PDF of a document the server does not hold (a guest's local draft): printed, then forgotten. */
  draftPdf: '/pdf',
} as const
