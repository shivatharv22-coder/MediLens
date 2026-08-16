/**
 * Create the first administrator.
 *
 * Usage:
 *   ADMIN_BOOTSTRAP_EMAIL=you@example.com ADMIN_BOOTSTRAP_PASSWORD='…' npm run admin:create
 *
 * The password is read from the environment rather than an argument so it does
 * not end up in the shell history or the process list of other users.
 */
import path from 'node:path';
import bcrypt from 'bcryptjs';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../database/generated/prisma/client';

for (const file of ['.env', '.env.local']) {
  try {
    process.loadEnvFile(path.join(process.cwd(), file));
  } catch {
    // Optional.
  }
}

const connectionString = process.env.DATABASE_URL;
const email = process.env.ADMIN_BOOTSTRAP_EMAIL?.trim().toLowerCase();
const password = process.env.ADMIN_BOOTSTRAP_PASSWORD;

function fail(message: string): never {
  console.error(message);
  process.exit(1);
}

if (!connectionString) fail('DATABASE_URL is not set.');
if (!email) fail('ADMIN_BOOTSTRAP_EMAIL is not set.');
if (!password) fail('ADMIN_BOOTSTRAP_PASSWORD is not set.');
if (password.length < 12) fail('ADMIN_BOOTSTRAP_PASSWORD must be at least 12 characters.');
if (!/[a-z]/.test(password) || !/[A-Z]/.test(password) || !/\d/.test(password)) {
  fail('ADMIN_BOOTSTRAP_PASSWORD needs an upper-case letter, a lower-case letter, and a number.');
}

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString }) });

async function main() {
  const passwordHash = await bcrypt.hash(password!, 12);

  const existing = await prisma.user.findUnique({ where: { email: email! }, select: { id: true } });

  const user = existing
    ? await prisma.user.update({
        where: { id: existing.id },
        data: { passwordHash, role: 'SUPER_ADMIN', isActive: true, deletedAt: null },
        select: { id: true, email: true, role: true },
      })
    : await prisma.user.create({
        data: {
          email: email!,
          passwordHash,
          role: 'SUPER_ADMIN',
          emailVerified: true,
          preferences: { create: {} },
        },
        select: { id: true, email: true, role: true },
      });

  await prisma.auditLog.create({
    data: {
      action: 'ADMIN_CREATE',
      actorEmail: user.email,
      entityType: 'User',
      entityId: user.id,
      metadata: { via: 'admin:create script', updated: Boolean(existing) },
    },
  });

  console.log(`${existing ? 'Updated' : 'Created'} administrator: ${user.email} (${user.role})`);
  console.log('Sign in at /admin/login');
}

main()
  .catch((error) => {
    console.error('Could not create the administrator:', error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
