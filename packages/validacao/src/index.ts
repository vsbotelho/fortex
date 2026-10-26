/**
 * Validação local de documentos: formato e dígitos verificadores.
 * Isso pega erro de digitação, mas não prova que o documento existe ou está
 * regular. A verificação na fonte (Receita, SENATRAN, ANTT) é etapa separada.
 */

const soDigitos = (v: string) => v.replace(/\D/g, '');
const todosIguais = (v: string) => /^(.)\1+$/.test(v);

/** CPF: 11 dígitos, dois dígitos verificadores módulo 11. */
export function normalizarCpf(valor: string): string | null {
  const cpf = soDigitos(valor);
  if (cpf.length !== 11 || todosIguais(cpf)) return null;
  const dv = (base: string, pesoInicial: number) => {
    let soma = 0;
    for (let i = 0; i < base.length; i++) soma += Number(base[i]) * (pesoInicial - i);
    const resto = (soma * 10) % 11;
    return resto === 10 ? 0 : resto;
  };
  const d1 = dv(cpf.slice(0, 9), 10);
  const d2 = dv(cpf.slice(0, 10), 11);
  return d1 === Number(cpf[9]) && d2 === Number(cpf[10]) ? cpf : null;
}

/**
 * CNPJ: 14 posições. Aceita o formato alfanumérico da Receita Federal
 * (IN RFB 2.229/2024): as 12 primeiras posições podem ter letras A–Z; os dois
 * dígitos verificadores são sempre numéricos. Valor de cada caractere = código
 * ASCII − 48, o que mantém o cálculo antigo para CNPJs só numéricos.
 */
export function normalizarCnpj(valor: string): string | null {
  const cnpj = valor.toUpperCase().replace(/[^0-9A-Z]/g, '');
  if (!/^[0-9A-Z]{12}\d{2}$/.test(cnpj) || todosIguais(cnpj)) return null;
  const val = (c: string) => c.charCodeAt(0) - 48;
  const dv = (base: string) => {
    const pesos = base.length === 12 ? [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2] : [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
    let soma = 0;
    for (let i = 0; i < base.length; i++) soma += val(base[i]) * pesos[i];
    const resto = soma % 11;
    return resto < 2 ? 0 : 11 - resto;
  };
  const d1 = dv(cnpj.slice(0, 12));
  const d2 = dv(cnpj.slice(0, 13));
  return d1 === Number(cnpj[12]) && d2 === Number(cnpj[13]) ? cnpj : null;
}

/**
 * CNH: número de registro com 11 dígitos. Aqui só o formato; a validade,
 * a categoria e a situação vêm da consulta ao SENATRAN.
 */
export function normalizarCnh(valor: string): string | null {
  const cnh = soDigitos(valor);
  return cnh.length === 11 && !todosIguais(cnh) ? cnh : null;
}

/** RENAVAM: 11 dígitos (completa com zeros à esquerda), DV módulo 11. */
export function normalizarRenavam(valor: string): string | null {
  const digitos = soDigitos(valor);
  if (digitos.length === 0 || digitos.length > 11) return null;
  const renavam = digitos.padStart(11, '0');
  if (todosIguais(renavam)) return null;
  const pesos = [3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
  let soma = 0;
  for (let i = 0; i < 10; i++) soma += Number(renavam[i]) * pesos[i];
  const resto = (soma * 10) % 11;
  const dv = resto === 10 ? 0 : resto;
  return dv === Number(renavam[10]) ? renavam : null;
}

/** Placa: padrão antigo (ABC1234) ou Mercosul (ABC1D23). */
export function normalizarPlaca(valor: string): string | null {
  const placa = valor.toUpperCase().replace(/[^0-9A-Z]/g, '');
  return /^[A-Z]{3}\d[A-Z0-9]\d{2}$/.test(placa) ? placa : null;
}

/**
 * RNTRC: aceita 8 ou 9 dígitos e guarda com 9 (zeros à esquerda). A situação
 * (ativo, categoria TAC/ETC/CTC, veículos vinculados) vem da consulta à ANTT.
 */
export function normalizarRntrc(valor: string): string | null {
  const rntrc = soDigitos(valor);
  if (rntrc.length < 8 || rntrc.length > 9) return null;
  const nove = rntrc.padStart(9, '0');
  return todosIguais(nove) ? null : nove;
}
