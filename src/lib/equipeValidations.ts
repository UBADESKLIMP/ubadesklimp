export const somenteDigitos = (valor: string) => valor.replace(/\D/g, '');

export const formatarCnpj = (valor: string) => {
  const d = somenteDigitos(valor);
  if (d.length <= 2) return d;
  if (d.length <= 5) return `${d.slice(0, 2)}.${d.slice(2)}`;
  if (d.length <= 8) return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5)}`;
  if (d.length <= 12) return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8)}`;
  return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8, 12)}-${d.slice(12, 14)}`;
};

/**
 * Valida CNPJ pelos dígitos verificadores. O CNPJ entra na advertência escrita,
 * que é documento trabalhista — um dígito trocado ali vira problema depois.
 */
export const cnpjValido = (valor: string): boolean => {
  const d = somenteDigitos(valor);
  if (d.length !== 14) return false;
  if (/^(\d)\1{13}$/.test(d)) return false;

  const digitoVerificador = (base: string, pesoInicial: number) => {
    let peso = pesoInicial;
    let soma = 0;
    for (const char of base) {
      soma += Number(char) * peso;
      peso = peso === 2 ? 9 : peso - 1;
    }
    const resto = soma % 11;
    return resto < 2 ? 0 : 11 - resto;
  };

  return (
    digitoVerificador(d.slice(0, 12), 5) === Number(d[12]) &&
    digitoVerificador(d.slice(0, 13), 6) === Number(d[13])
  );
};
