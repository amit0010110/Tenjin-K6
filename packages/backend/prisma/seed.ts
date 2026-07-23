import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  const passwordHash = await bcrypt.hash('password', 10);

  const user = await prisma.user.upsert({
    where: { id: '00000000-0000-0000-0000-000000000000' },
    update: { email: 'dev@tenjint6.local', passwordHash },
    create: {
      id: '00000000-0000-0000-0000-000000000000',
      email: 'dev@tenjint6.local',
      name: 'Developer',
      passwordHash,
    },
  });

  const user2 = await prisma.user.upsert({
    where: { email: 'dev@graphanak6.local' },
    update: { passwordHash },
    create: {
      email: 'dev@graphanak6.local',
      name: 'Developer (Graphana)',
      passwordHash,
    },
  });

  const project = await prisma.project.upsert({
    where: { id: '00000000-0000-0000-0000-000000000001' },
    update: {},
    create: {
      id: '00000000-0000-0000-0000-000000000001',
      name: 'My Project',
      description: 'Main performance testing project',
      userId: user.id,
    },
  });

  console.log('Seeded:', { user: user.id, project: project.id });
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
