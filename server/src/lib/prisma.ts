import { PrismaClient } from '@prisma/client'

import '../load-env.js'

export const prisma = new PrismaClient()
