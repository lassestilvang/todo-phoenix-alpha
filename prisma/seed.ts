#!/usr/bin/env node
// Seed script - currently placeholder
// Prisma client not available in this environment
// This file is kept for database seeding when Prisma is properly configured

async function main() {
  console.log('Seed script placeholder - database seeding not configured');
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e);
    process.exit(1);
  });