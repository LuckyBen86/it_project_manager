import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import bcrypt from 'bcryptjs';

async function main() {
  const adminEmail = process.env.SEED_ADMIN_EMAIL ?? 'admin@it-pm.local';
  const adminPassword = process.env.SEED_ADMIN_PASSWORD ?? 'Admin1234!';
  const adminNom = process.env.SEED_ADMIN_NOM ?? 'Administrateur';

  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const adapter = new PrismaPg(pool);
  const prisma = new PrismaClient({ adapter });

  try {
    const existing = await prisma.ressource.findUnique({ where: { email: adminEmail } });
    if (existing) {
      // Garantir que l'admin a toujours le rôle direction_generale
      if (existing.role !== 'direction_generale') {
        await prisma.ressource.update({
          where: { email: adminEmail },
          data: { role: 'direction_generale' },
        });
        console.log(`Seed : rôle admin "${adminEmail}" restauré → direction_generale`);
      } else {
        console.log(`Seed : compte admin "${adminEmail}" déjà présent, skip.`);
      }
      return;
    }

    const passwordHash = await bcrypt.hash(adminPassword, 12);
    await prisma.ressource.create({
      data: { nom: adminNom, email: adminEmail, passwordHash, role: 'direction_generale' },
    });

    console.log(`Seed : compte admin créé → ${adminEmail}`);
    console.log(`Mot de passe initial : ${adminPassword}`);
    console.log('⚠️  Changez ce mot de passe après la première connexion !');
  } finally {
    await prisma.$disconnect();
    await pool.end();
  }
}

main().catch((e) => { console.error('Seed error:', e); process.exit(1); });
