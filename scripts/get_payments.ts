import { PrismaClient } from '@prisma/client';
const p = new PrismaClient();
p.paymentMethod.findMany().then(r => console.log(JSON.stringify(r))).finally(() => p.$disconnect());
