const fs = require('fs');
const file = 'src/lib/crm/actions.ts';
let code = fs.readFileSync(file, 'utf8');

const regex = /export async function deleteCustomer\(id: string\) \{[\s\S]*?catch \(error: any\) \{/m;

const replacement = `export async function deleteCustomer(id: string) {
  const session = await requirePermission('CLIENTES', 'DELETE');
  try {
    await prisma.$transaction(async tx => {
      const before = await tx.customer.findFirst({ where: tenantWhere(id, session.companyId), select: { id: true, name: true, phone: true } });
      if (!before) throw new Error('CUSTOMER_NOT_FOUND');

      await tx.sale.updateMany({
        where: { customerId: id, companyId: session.companyId, customerNameSnapshot: null },
        data: { customerNameSnapshot: before.name, customerPhoneSnapshot: before.phone }
      });

      await tx.sale.updateMany({
        where: { customerId: id, companyId: session.companyId },
        data: { customerId: null }
      });

      await tx.accountsReceivable.updateMany({
        where: { customerId: id, companyId: session.companyId },
        data: { customerId: null }
      });

      const deleted = await tx.customer.delete({ where: tenantWhere(id, session.companyId) });

      await writeActivityLog({
        context: session,
        action: 'CUSTOMER_DELETE',
        module: 'CUSTOMERS',
        recordId: deleted.id,
        details: 'Cliente excluído permanentemente',
        metadata: { name: deleted.name, phone: deleted.phone },
      }, { policy: 'CRITICAL', tx });
    });

    return { success: true };
  } catch (error: any) {`;

if (regex.test(code)) {
    code = code.replace(regex, replacement);
    fs.writeFileSync(file, code);
    console.log("Patched successfully");
} else {
    console.log("Regex not found");
}
