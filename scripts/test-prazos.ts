import { calcularPrazo } from '../src/prazos/calculo';
import { pascoa } from '../src/prazos/feriados';
import { sugerirPrazo } from '../src/prazos/sugestao';

let falhas = 0;
function eq(nome: string, obtido: unknown, esperado: unknown) {
  const ok = JSON.stringify(obtido) === JSON.stringify(esperado);
  if (!ok) falhas++;
  console.log(`${ok ? '✔' : '✘'} ${nome}${ok ? '' : `  obtido=${JSON.stringify(obtido)} esperado=${JSON.stringify(esperado)}`}`);
}

eq('Páscoa 2026', pascoa(2026), '2026-04-05');
eq('Páscoa 2027', pascoa(2027), '2027-03-28');

// 1) Disponibilizado sexta 06/11/2026 -> publicação seg 09/11 -> início ter 10/11.
// 15 dias úteis a partir de 10/11 pulando 15/11 (dom) e 20/11 (sex, feriado): fim 01/12.
let r = calcularPrazo('2026-11-06', { dias: 15, contagem: 'uteis' });
eq('sexta: publicação', r.dataPublicacao, '2026-11-09');
eq('sexta: início', r.dataInicio, '2026-11-10');
eq('sexta: fim', r.dataFim, '2026-12-01');

// 2) Carnaval 2027: 08 e 09/02. Disponibilizado qui 04/02 -> pub sex 05/02 -> início qua 10/02.
// 5 dias úteis: 10,11,12,15,16 -> fim 16/02.
r = calcularPrazo('2027-02-04', { dias: 5, contagem: 'uteis' });
eq('carnaval: início', r.dataInicio, '2027-02-10');
eq('carnaval: fim', r.dataFim, '2027-02-16');
eq('carnaval: pulou carnaval', r.diasPulados.filter((d) => d.motivo === 'feriado').length, 2);

// 3) Recesso: disponibilizado sex 18/12/2026 -> pub seg 21/12? Não: 21/12 é recesso.
// Publicação = 1º dia útil após recesso = qui 21/01/2027; início = sex 22/01/2027.
// 15 dias úteis: 22,25,26,27,28,29 jan; 1,2,3,4,5 fev; 10,11,12,15 fev (carnaval 8/9) -> fim 15/02.
r = calcularPrazo('2026-12-18', { dias: 15, contagem: 'uteis' });
eq('recesso: publicação', r.dataPublicacao, '2027-01-21');
eq('recesso: início', r.dataInicio, '2027-01-22');
eq('recesso: fim', r.dataFim, '2027-02-15');

// 4) Feriado local na contagem.
r = calcularPrazo('2026-11-06', {
  dias: 15,
  contagem: 'uteis',
  feriadosLocais: [{ data: '2026-11-25', descricao: 'Feriado municipal' }],
});
eq('feriado local: fim', r.dataFim, '2026-12-02');

// 5) Corridos: 5 dias a partir de 10/11 -> 14/11 (sáb) -> prorroga para seg 16/11.
r = calcularPrazo('2026-11-06', { dias: 5, contagem: 'corridos' });
eq('corridos: prorroga', r.dataFim, '2026-11-16');

// Sugestão
eq('sugestão 15', sugerirPrazo('Intime-se a parte para, no prazo de 15 (quinze) dias, apresentar réplica.').dias, 15);
eq('sugestão comum 5', sugerirPrazo('manifestação, no prazo comum de 5 (cinco) dias. Intimem-se.').dias, 5);
eq('sugestão padrão', sugerirPrazo('Vistas às partes.').dias, 15);

console.log(falhas ? `\n${falhas} falha(s)` : '\nTodos os testes passaram.');
process.exit(falhas ? 1 : 0);
