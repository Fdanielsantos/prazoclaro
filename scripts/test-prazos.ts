import { calcularPrazo, explicarMudanca } from '../src/prazos/calculo';
import { pascoa } from '../src/prazos/feriados';
import { partesComPrazoEmDobro, sugerirPrazo } from '../src/prazos/sugestao';
import { agruparDiasNaoUteis } from '../src/relatorio';

let falhas = 0;
function eq(nome: string, obtido: unknown, esperado: unknown) {
  const ok = JSON.stringify(obtido) === JSON.stringify(esperado);
  if (!ok) falhas++;
  console.log(`${ok ? '✔' : '✘'} ${nome}${ok ? '' : `  obtido=${JSON.stringify(obtido)} esperado=${JSON.stringify(esperado)}`}`);
}
const uteis = (d: string, dias: number, calendario = {}) => calcularPrazo(d, { dias, contagem: 'uteis', calendario });

eq('Páscoa 2026', pascoa(2026), '2026-04-05');
eq('Páscoa 2027', pascoa(2027), '2027-03-28');

// 1) Disponibilizado sexta 06/11/2026 -> publicação seg 09/11 -> início ter 10/11.
// 15 dias úteis a partir de 10/11 pulando 15/11 (dom) e 20/11 (sex, feriado): fim 01/12.
let r = uteis('2026-11-06', 15);
eq('sexta: publicação', r.dataPublicacao, '2026-11-09');
eq('sexta: início', r.dataInicio, '2026-11-10');
eq('sexta: fim', r.dataFim, '2026-12-01');
eq('fundamento do feriado', r.diasPulados.find((d) => d.data === '2026-11-20')?.fundamento, 'Lei 14.759/2023');

// 2) Carnaval 2027 (08 e 09/02). Disponibilizado qui 04/02 -> pub sex 05/02.
// Padrão (Carnaval não é feriado nacional em lei): início seg 08/02; 5 úteis -> sex 12/02.
r = uteis('2027-02-04', 5);
eq('carnaval padrão: início', r.dataInicio, '2027-02-08');
eq('carnaval padrão: fim', r.dataFim, '2027-02-12');
// Com a opção "tradicionais": início qua 10/02; 10,11,12,15,16 -> fim 16/02.
r = uteis('2027-02-04', 5, { tradicionais: true });
eq('carnaval opção: início', r.dataInicio, '2027-02-10');
eq('carnaval opção: fim', r.dataFim, '2027-02-16');
// Justiça Federal: Carnaval por lei (Lei 5.010/66, art. 62, III), sem depender da opção.
r = uteis('2027-02-04', 5, { tribunal: 'TRF1' });
eq('carnaval TRF1: fim', r.dataFim, '2027-02-16');
eq('carnaval TRF1: fundamento', r.diasPulados.find((d) => d.data === '2027-02-08')?.fundamento, 'Lei 5.010/1966, art. 62, II e III');

// 3) Semana Santa 2027 (Páscoa 28/03): Justiça Federal não tem expediente de qua 24 a sex 26/03.
// Disponibilizado seg 22/03 -> pub ter 23/03 -> início (TRF) seg 29/03; no TJ (padrão) qua 24/03.
eq('semana santa TRF3: início', uteis('2027-03-22', 1, { tribunal: 'TRF3' }).dataInicio, '2027-03-29');
eq('semana santa TJ padrão: início', uteis('2027-03-22', 1).dataInicio, '2027-03-24');

// 4) Recesso: disponibilizado sex 18/12/2026 -> pub = qui 21/01/2027 (fim do recesso); início sex 22/01.
// 15 úteis: 22,25-29 jan (6); 1-5 fev (5); 8,9,10,11 fev -> 11/02 (sem Carnaval) ou 15/02 (com).
r = uteis('2026-12-18', 15);
eq('recesso: publicação', r.dataPublicacao, '2027-01-21');
eq('recesso: início', r.dataInicio, '2027-01-22');
eq('recesso: fim', r.dataFim, '2027-02-11');
eq('recesso: aviso de véspera', r.avisos.length, 1);
eq('recesso + carnaval: fim', uteis('2026-12-18', 15, { tradicionais: true }).dataFim, '2027-02-15');

// 5) Feriado local e calendários estaduais/superiores.
eq('feriado local: fim', uteis('2026-11-06', 15, { locais: [{ data: '2026-11-25', descricao: 'Feriado municipal' }] }).dataFim, '2026-12-02');
eq('TJSP 9 de julho', uteis('2027-07-05', 5, { tribunal: 'TJSP' }).dataFim, '2027-07-14');
eq('TJMG sem 9 de julho', uteis('2027-07-05', 5, { tribunal: 'TJMG' }).dataFim, '2027-07-13');
eq('STJ 11 de agosto', uteis('2026-08-07', 5, { tribunal: 'STJ' }).dataInicio, '2026-08-12');

// 6) Corridos: 5 dias a partir de 10/11 -> 14/11 (sáb) -> prorroga para seg 16/11.
eq('corridos: prorroga', calcularPrazo('2026-11-06', { dias: 5, contagem: 'corridos' }).dataFim, '2026-11-16');

// 7) Explicação de mudança na revisão.
const antes = uteis('2027-07-05', 5).diasPulados;
const depois = uteis('2027-07-05', 5, { tribunal: 'TJSP' }).diasPulados;
eq('revisão: motivo', explicarMudanca(antes, depois), ['+ 09/07/2027: Revolução Constitucionalista passou a ser dia não útil']);

// 8) Agrupamento para o texto de tempestividade.
eq('agrupar recesso', agruparDiasNaoUteis(uteis('2026-12-18', 5).diasPulados), ['20/12/2026 a 20/01/2027: recesso forense (CPC, art. 220)']);

// Sugestão de prazo
eq('sugestão 15', sugerirPrazo('Intime-se a parte para, no prazo de 15 (quinze) dias, apresentar réplica.').dias, 15);
eq('sugestão comum 5', sugerirPrazo('manifestação, no prazo comum de 5 (cinco) dias. Intimem-se.').dias, 5);
eq('sugestão padrão (art. 218, §3º)', [sugerirPrazo('Vistas às partes.').dias, sugerirPrazo('Vistas às partes.').origem], [5, 'padrao']);
eq('sugestão por extenso', sugerirPrazo('Junte a parte, em cinco dias, o comprovante.').dias, 5);
eq('sugestão extenso composto', sugerirPrazo('no prazo de trinta e cinco dias').dias, 35);
eq('sugestão "é de"', sugerirPrazo('o prazo para recurso é de 10 (dez) dias corridos.').contagem, 'corridos');
eq('sugestão menor de vários', sugerirPrazo('EDITAL - PRAZO DE 30 DIAS. Pague no prazo de 03 (três) dias; embargos em 15 (quinze) dias.').dias, 3);
eq('sugestão "há 5 dias" ignorado', sugerirPrazo('Há 5 dias o autor peticionou. Intime-se.').origem, 'padrao');
const h = sugerirPrazo('Cumpra-se em 48 horas, sob pena de multa.');
eq('sugestão horas', [h.origem, h.dias, h.contagem, h.horas?.quantidade], ['horas', 2, 'corridos', 48]);
eq('sugestão penal pela classe', sugerirPrazo('Intime-se.', 'AÇÃO PENAL - PROCEDIMENTO ORDINÁRIO').contagem, 'corridos');
eq('cláusula penal não é criminal', sugerirPrazo('Cobrança de cláusula penal. Intime-se.').contagem, 'uteis');

// Prazo em dobro
eq('dobro: Fazenda/MP', partesComPrazoEmDobro('UNIÃO (FAZENDA NACIONAL)', 'MINISTÉRIO PÚBLICO DO ESTADO DE MINAS GERAIS'), [
  'UNIÃO',
  'FAZENDA NACIONAL',
  'MINISTÉRIO PÚBLICO DO ESTADO DE MINAS GERAIS',
]);
eq('dobro: empresa "União" não', partesComPrazoEmDobro('União Química Farmacêutica S.A.'), []);

console.log(falhas ? `\n${falhas} falha(s)` : '\nTodos os testes passaram.');
process.exit(falhas ? 1 : 0);
