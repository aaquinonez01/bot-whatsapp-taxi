import { PrismaClient } from '../database/generated/client/index.js'
import { config } from './environments.js'

let prisma: PrismaClient

declare global {
  // eslint-disable-next-line no-var
  var __prisma: PrismaClient | undefined
}

if (process.env.NODE_ENV === 'production') {
  prisma = new PrismaClient({
    datasources: {
      db: {
        url: config.database.url,
      },
    },
  })
} else {
  if (!global.__prisma) {
    global.__prisma = new PrismaClient({
      datasources: {
        db: {
          url: config.database.url,
        },
      },
      log: ['query', 'info', 'warn', 'error'],
    })
  }
  prisma = global.__prisma
}

export { prisma }