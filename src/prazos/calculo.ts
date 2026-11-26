import { addDays, formatBR, ISODate } from './datas';
import { ContextoCalendario, emRecesso, infoDia, MotivoNaoUtil } from './feriados';

export type Contagem = 'uteis' | 'corridos';

export interface DiaPulado {
  data: ISODate;
  motivo: MotivoNaoUtil;
  descricao: string;
  fundamento?: string;
}

export interface ResultadoPrazo {
  dataDisponibilizacao: ISODate;
  dataPublicacao: ISODate;
  dataInicio: ISODate;
  dataFim: ISODate;
  dias: number;
  contagem: Contagem;
  diasPulados: DiaPulado[];
  /** Situações que pedem conferência manual (ex.: recesso perto da publicação). */
  avisos: string[];
}

export interface OpcoesCalculo {
  dias: number;
  contagem: Contagem;
  calendario?: ContextoCalendario;
  /** true quando a data informada já é a de publicação. */
  dataJaEhPublicacao?: boolean;
}

/** Primeiro dia útil estritamente posterior a `d`, registrando os dias pulados. */
function proximoUtil(d: ISODate, ctx: ContextoCalendario, pulados?: DiaPulado[]): ISODate {
  let cur = addDays(d, 1);
  for (;;) {
    const info = infoDia(cur, ctx);
    if (info.util) return cur;
    pulados?.push({ data: cur, motivo: info.motivo!, descricao: info.descricao!, fundamento: info.fundamento });
    cur = addDays(cur, 1);
  }
}

/** Dia útil imediatamente anterior a `d`. */
export function utilAnterior(d: ISODate, ctx: ContextoCalendario = {}): ISODate {
  let cur = addDays(d, -1);
  while (!infoDia(cur, ctx).util) cur = addDays(cur, -1);
  return cur;
}

/** Quantidade de dias úteis de `hoje` (exclusive) até `fim` (inclusive). Negativo se vencido. */
export function diasUteisRestantes(hoje: ISODate, fim: ISODate, ctx: ContextoCalendario = {}): number {
  if (fim <= hoje) return fim === hoje ? 0 : -1;
  let n = 0;
  let cur = hoje;
  while (cur < fim) {
    cur = addDays(cur, 1);
    if (infoDia(cur, ctx).util) n++;
  }
  return n;
}

/**
 * Calcula o prazo processual a partir da disponibilização no DJEN.
 *
 * 1. Publicação = 1º dia útil seguinte à disponibilização (Lei 11.419/06, art. 4º, §3º; CPC, art. 224, §2º).
 * 2. Início da contagem = 1º dia útil seguinte à publicação (Lei 11.419/06, art. 4º, §4º; CPC, art. 224, §3º).
 * 3. Contagem em dias úteis (CPC, art. 219), excluindo fins de semana, feriados nacionais,
 *    do tribunal e locais, e o recesso de 20/12 a 20/01 (CPC, art. 220).
 * 4. Em dias corridos, se o vencimento cair em dia não útil, prorroga para o próximo dia útil
 *    (CPC, art. 224, §1º).
 */
export function calcularPrazo(dataBase: ISODate, opts: OpcoesCalculo): ResultadoPrazo {
  const ctx = opts.calendario ?? {};
  const pulados: DiaPulado[] = [];
  const avisos: string[] = [];

  const dataPublicacao = opts.dataJaEhPublicacao ? dataBase : proximoUtil(dataBase, ctx, pulados);
  const dataInicio = proximoUtil(dataPublicacao, ctx, pulados);

  // Disponibilização às vésperas ou durante o recesso: a data de publicação adotada varia entre tribunais.
  const recessoAntesDoInicio = pulados.some((d) => d.motivo === 'recesso');
  if (recessoAntesDoInicio && (emRecesso(dataBase) || emRecesso(addDays(dataBase, 1)))) {
    avisos.push(
      `A disponibilização (${formatBR(dataBase)}) ocorreu às vésperas ou durante o recesso forense. ` +
        `O app considerou a publicação em ${formatBR(dataPublicacao)}; há tribunais que adotam outra data. Confira.`,
    );
  }

  let dataFim = dataInicio;
  if (opts.contagem === 'uteis') {
    let contados = 1;
    while (contados < opts.dias) {
      dataFim = proximoUtil(dataFim, ctx, pulados);
      contados++;
    }
  } else {
    dataFim = addDays(dataInicio, opts.dias - 1);
    const info = infoDia(dataFim, ctx);
    if (!info.util) {
      pulados.push({ data: dataFim, motivo: info.motivo!, descricao: info.descricao!, fundamento: info.fundamento });
      dataFim = proximoUtil(dataFim, ctx, pulados);
    }
    let cur = dataInicio;
    let passaRecesso = false;
    while (cur <= dataFim && !passaRecesso) {
      passaRecesso = emRecesso(cur);
      cur = addDays(cur, 1);
    }
    if (passaRecesso) {
      avisos.push(
        'Contagem em dias corridos atravessando o recesso: o app não suspendeu a contagem (ex.: prazos do CPP). ' +
          'Se o prazo for regido pelo CPC, use dias úteis.',
      );
    }
  }

  if (opts.contagem === 'uteis' && !avisos.length && pulados.some((d) => d.motivo === 'recesso')) {
    avisos.push('A contagem atravessa o recesso forense (20/12 a 20/01, CPC, art. 220), durante o qual os prazos ficam suspensos.');
  }

  return {
    dataDisponibilizacao: dataBase,
    dataPublicacao,
    dataInicio,
    dataFim,
    dias: opts.dias,
    contagem: opts.contagem,
    diasPulados: pulados,
    avisos,
  };
}

/** Diferença entre dois cálculos, para explicar por que o vencimento mudou. */
export function explicarMudanca(antes: DiaPulado[], depois: DiaPulado[]): string[] {
  const chave = (d: DiaPulado) => `${d.data}|${d.motivo}`;
  const a = new Set(antes.map(chave));
  const b = new Set(depois.map(chave));
  const novos = depois.filter((d) => !a.has(chave(d)) && d.motivo !== 'sabado' && d.motivo !== 'domingo');
  const removidos = antes.filter((d) => !b.has(chave(d)) && d.motivo !== 'sabado' && d.motivo !== 'domingo');
  return [
    ...novos.map((d) => `+ ${formatBR(d.data)}: ${d.descricao} passou a ser dia não útil`),
    ...removidos.map((d) => `− ${formatBR(d.data)}: ${d.descricao} deixou de ser considerado dia não útil`),
  ];
}
