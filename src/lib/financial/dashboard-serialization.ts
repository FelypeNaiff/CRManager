type DecimalLike = { toNumber(): number };

function decimalToNumber(value: DecimalLike | number | string | null) {
  if (value === null) return null;
  if (typeof value === 'object' && 'toNumber' in value) return value.toNumber();
  return Number(value);
}

export function serializeFinancialDashboardData<
  TAccount extends { currentBalance: DecimalLike | number | string },
  TRegister extends {
    openingBalance: DecimalLike | number | string;
    closingBalance: DecimalLike | number | string | null;
    expectedBalance: DecimalLike | number | string | null;
    difference: DecimalLike | number | string | null;
    bankAccount: {
      initialBalance: DecimalLike | number | string;
      currentBalance: DecimalLike | number | string;
    };
  },
>(bankAccounts: TAccount[], openCashRegister: TRegister | null) {
  return {
    bankAccounts: bankAccounts.map(account => ({
      ...account,
      currentBalance: decimalToNumber(account.currentBalance)!,
    })),
    openCashRegister: openCashRegister
      ? {
          ...openCashRegister,
          openingBalance: decimalToNumber(openCashRegister.openingBalance)!,
          closingBalance: decimalToNumber(openCashRegister.closingBalance),
          expectedBalance: decimalToNumber(openCashRegister.expectedBalance),
          difference: decimalToNumber(openCashRegister.difference),
          bankAccount: {
            ...openCashRegister.bankAccount,
            initialBalance: decimalToNumber(openCashRegister.bankAccount.initialBalance)!,
            currentBalance: decimalToNumber(openCashRegister.bankAccount.currentBalance)!,
          },
        }
      : null,
  };
}
