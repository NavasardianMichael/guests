export const ENDPOINTS = {
  extractGuests: '/ai/extract-guests',
  /** Whether this visitor may read a photo: full access, `PHOTO_READS_PER_PASS` per pass. */
  photoStatus: '/ai/photo',
} as const
