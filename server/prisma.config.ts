// A config file opts the Prisma CLI out of loading the env file implicitly, so it is loaded
// here or DATABASE_URL is undefined for `migrate deploy` — by the API's own loader, so both
// read the same files.
import { defineConfig } from 'prisma/config'

import './src/load-env.js'

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    seed: 'tsx prisma/seed.ts',
  },
})
