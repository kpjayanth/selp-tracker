const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function main() {
  const hash = await bcrypt.hash('Admin1234!', 12);
  const admin = await prisma.user.upsert({
    where: { email: 'admin@selp.org' },
    update: {},
    create: {
      fullName: 'SELP Admin',
      email: 'admin@selp.org',
      passwordHash: hash,
      status: 'ACTIVE',
    },
  });
  console.log('Seeded admin user:', admin.email);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
