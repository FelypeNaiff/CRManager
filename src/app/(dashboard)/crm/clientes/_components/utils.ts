export function formatPhone(v: string): string {
  if (!v) return ""
  const digits = v.replace(/\D/g, "")
  if (digits.length <= 10) {
    return digits.replace(/(\d{2})(\d{4})(\d{4})/, "($1) $2-$3")
  }
  return digits.replace(/(\d{2})(\d{5})(\d{4})/, "($1) $2-$3")
}

export function calcIdade(dataNascimento: string): string {
  if (!dataNascimento) return ""
  const hoje = new Date()
  const nasc = new Date(dataNascimento)
  let anos = hoje.getFullYear() - nasc.getFullYear()
  let meses = hoje.getMonth() - nasc.getMonth()
  if (meses < 0) { anos--; meses += 12 }
  if (anos > 0) return `${anos} ano${anos > 1 ? "s" : ""} e ${meses} mês${meses !== 1 ? "es" : ""}`
  return `${meses} mês${meses !== 1 ? "es" : ""}`
}
