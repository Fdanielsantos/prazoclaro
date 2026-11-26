import type { NovaIntimacao } from '@/db/repo';
import { addDays, hojeISO } from '@/prazos/datas';

/** Intimações fictícias, com datas relativas a hoje, para o modo demonstração. */
export function intimacoesDemo(): NovaIntimacao[] {
  const hoje = hojeISO();
  const base: Omit<NovaIntimacao, 'data_disponibilizacao' | 'djen_id' | 'origem'>[] = [
    {
      processo: '1012345-67.2026.8.26.0100',
      tribunal: 'TJSP',
      orgao: '5ª Vara Cível do Foro Central da Comarca de São Paulo',
      tipo: 'Intimação',
      classe: 'Procedimento Comum Cível',
      partes: 'Maria Aparecida Souza, Banco Exemplo S.A.',
      link: null,
      texto:
        'Vistos. Manifeste-se a parte autora sobre a contestação e documentos juntados, no prazo de 15 (quinze) dias, ' +
        'nos termos dos arts. 350 e 351 do CPC. No mesmo prazo, especifiquem as partes as provas que pretendem produzir, ' +
        'justificando sua pertinência. Intime-se.',
    },
    {
      processo: '0801234-55.2026.8.19.0001',
      tribunal: 'TJRJ',
      orgao: '2º Juizado Especial Cível da Comarca da Capital',
      tipo: 'Intimação',
      classe: 'Procedimento do Juizado Especial Cível',
      partes: 'João Pedro Lima, Operadora de Telefonia Fictícia Ltda.',
      link: null,
      texto:
        'SENTENÇA. Ante o exposto, JULGO PROCEDENTE EM PARTE o pedido para condenar a ré ao pagamento de R$ 5.000,00 ' +
        'a título de danos morais. Sem custas e honorários (art. 55 da Lei 9.099/95). Fica a parte intimada de que o prazo ' +
        'para interposição de recurso inominado é de 10 (dez) dias. P.R.I.',
    },
    {
      processo: '5004321-10.2026.4.03.6100',
      tribunal: 'TRF3',
      orgao: '12ª Vara Cível Federal de São Paulo',
      tipo: 'Intimação',
      classe: 'Mandado de Segurança Cível',
      partes: 'Comércio Exemplo Ltda., União Federal',
      link: null,
      texto:
        'DESPACHO. Intime-se a impetrante para que, no prazo de 5 (cinco) dias, comprove o recolhimento das custas ' +
        'iniciais, sob pena de cancelamento da distribuição. Cumpra-se.',
    },
    {
      processo: '0012233-44.2025.5.02.0011',
      tribunal: 'TRT2',
      orgao: '11ª Vara do Trabalho de São Paulo',
      tipo: 'Intimação',
      classe: 'Ação Trabalhista - Rito Ordinário',
      partes: 'Carlos Eduardo Santos, Empresa de Logística Modelo S.A.',
      link: null,
      texto:
        'Ficam as partes intimadas acerca do laudo pericial juntado aos autos, podendo apresentar manifestação no prazo ' +
        'comum de 8 (oito) dias. Após, voltem conclusos.',
    },
    {
      processo: '1009876-21.2026.8.13.0024',
      tribunal: 'TJMG',
      orgao: '3ª Vara de Família da Comarca de Belo Horizonte',
      tipo: 'Intimação',
      classe: 'Divórcio Litigioso',
      partes: 'Ana Paula Ferreira, Ricardo Ferreira',
      link: null,
      texto:
        'Designo audiência de conciliação para o dia a ser informado pelo CEJUSC. Intimem-se as partes, por seus ' +
        'procuradores, para ciência e para que informem, em 15 dias, eventual interesse na realização do ato por videoconferência.',
    },
  ];
  const offsets = [1, 3, 6, 9, 12];
  return base.map((b, i) => ({
    ...b,
    djen_id: `demo-${i + 1}`,
    data_disponibilizacao: addDays(hoje, -offsets[i]),
    origem: 'demo' as const,
  }));
}
