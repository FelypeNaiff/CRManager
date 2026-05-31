npx tsc --noEmit
npx tsx scripts/run-etl.ts
npx tsx scripts/run-products-etl.ts
npx tsx scripts/run-financial-etl.ts
npx tsx scripts/test-crm-flow.ts
npx tsx scripts/test-products-flow.ts
npx tsx scripts/test-financial-flow.ts
npx prisma migrate status
