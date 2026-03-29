import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  const adminEmail = process.env.SEED_ADMIN_EMAIL ?? 'admin@it-pm.local';
  const adminPassword = process.env.SEED_ADMIN_PASSWORD ?? 'Admin1234!';
  const adminNom = process.env.SEED_ADMIN_NOM ?? 'Administrateur';

  const existing = await prisma.ressource.findUnique({ where: { email: adminEmail } });
  if (existing) {
    console.log(`Seed : compte admin "${adminEmail}" déjà présent, skip.`);
    return;
  }

  const passwordHash = await bcrypt.hash(adminPassword, 12);
  await prisma.ressource.create({
    data: { nom: adminNom, email: adminEmail, passwordHash, role: 'responsable' },
  });

  console.log(`Seed : compte admin créé → ${adminEmail}`);
  console.log(`Mot de passe initial : ${adminPassword}`);
  console.log('⚠️  Changez ce mot de passe après la première connexion !');
}

main()
  .catch((e) => { console.error('Seed error:', e); process.exit(1); })
  .finally(() => prisma.$disconnect());
