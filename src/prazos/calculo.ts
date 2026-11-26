import { addDays, ISODate } from './datas';
import { FeriadoLocal, infoDia, MotivoNaoUtil } from './feriados';

export type Contagem = 'uteis' | 'corridos';

export interface DiaPulado {
  data: ISODate;
  motivo: MotivoNaoUtil;
  descricao: string;
}

export interface ResultadoPrazo {
  dataDisponibilizacao: ISODate;
  dataPublicacao: ISODate;
  dataInicio: ISODate;
  dataFim: ISODate;
  dias: number;
  contagem: Contagem;
  diasPulados: DiaPulado[];
}

export interface OpcoesCalculo {
  dias: number;
  contagem: Contagem;
  feriadosLocais?: FeriadoLocal[];
  /** true quando a data informada já é a de publicação (ex.: intimação colada manualmente). */
  dataJaEhPublicacao?: boolean;
}

/** Primeiro dia útil estritamente posterior a `d`, registrando os dias pulados. */
function proximoUtil(d: ISODate, locais: FeriadoLocal[], pulados?: DiaPulado[]): ISODate {
  let cur = addDays(d, 1);
  for (;;) {
    const info = infoDia(cur, locais);
    if (info.util) return cur;
    pulados?.push({ data: cur, motivo: info.motivo!, descricao: info.descricao! });
    cur = addDays(cur, 1);
  }
}

/** Quantidade de dias úteis de `hoje` (exclusive) até `fim` (inclusive). Negativo se vencido. */
export function diasUteisRestantes(hoje: ISODate, fim: ISODate, locais: FeriadoLocal[] = []): number {
  if (fim <= hoje) return fim === hoje ? 0 : -1;
  let n = 0;
  let cur = hoje;
  while (cur < fim) {
    cur = addDays(cur, 1);
    if (infoDia(cur, locais).util) n++;
  }
  return n;
}

/**
 * Calcula o prazo processual a partir da disponibilização no DJEN.
 *
 * 1. Publicação = 1º dia útil seguinte à disponibilização (Lei 11.419/06, art. 4º, §3º).
 * 2. Início da contagem = 1º dia útil seguinte à publicação (art. 4º, §4º; CPC, art. 224).
 * 3. Contagem em dias úteis (CPC, art. 219), excluindo fins de semana, feriados
 *    nacionais e locais e o recesso de 20/12 a 20/01 (CPC, art. 220).
 * 4. Em dias corridos, se o vencimento cair em dia não útil, prorroga para o próximo dia útil
 *    (CPC, art. 224, §1º).
 */
export function calcularPrazo(dataBase: ISODate, opts: OpcoesCalculo): ResultadoPrazo {
  const locais = opts.feriadosLocais ?? [];
  const pulados: DiaPulado[] = [];

  const dataPublicacao = opts.dataJaEhPublicacao ? dataBase : proximoUtil(dataBase, locais, pulados);
  const dataInicio = proximoUtil(dataPublicacao, locais, pulados);

  let dataFim = dataInicio;
  if (opts.contagem === 'uteis') {
    let contados = 1;
    while (contados < opts.dias) {
      dataFim = proximoUtil(dataFim, locais, pulados);
      contados++;
    }
  } else {
    dataFim = addDays(dataInicio, opts.dias - 1);
    const info = infoDia(dataFim, locais);
    if (!info.util) {
      pulados.push({ data: dataFim, motivo: info.motivo!, descricao: info.descricao! });
      dataFim = proximoUtil(dataFim, locais, pulados);
    }
  }

  return {
    dataDisponibilizacao: dataBase,
    dataPublicacao,
    dataInicio,
    dataFim,
    dias: opts.dias,
    contagem: opts.contagem,
    diasPulados: pulados,
  };
}
