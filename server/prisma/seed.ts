import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcrypt'
const prisma = new PrismaClient()

async function main() {
  const hashedPassword = await bcrypt.hash('password123', 10)

  const admin = await prisma.user.upsert({
    where: { username: 'admin' },
    update: {},
    create: {
      username: 'admin',
      password: hashedPassword,
      role: 'ADMIN',
    },
  })

  const clientUser = await prisma.user.upsert({
    where: { username: 'client' },
    update: {},
    create: {
      username: 'client',
      password: hashedPassword,
      role: 'CLIENT',
    },
  })

  // Create dummy daily record
  const record = await prisma.dailyRecord.upsert({
    where: { date: new Date('2025-01-01').toISOString() },
    update: {},
    create: {
      date: new Date('2025-01-01').toISOString(),
      totalSale: 1000,
      totalSaleGmv: 800,
      gmvSaleLive: 500,
      adsSpend: 200,
      ttamSpendAds: 50,
      ttamImpressions: 50000
    }
  })

  console.log({ admin, clientUser, record })
}

main()
  .then(async () => {
    await prisma.$disconnect()
  })
  .catch(async (e) => {
    console.error(e)
    await prisma.$disconnect()
    process.exit(1)
  })
