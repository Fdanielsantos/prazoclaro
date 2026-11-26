import { buscarDJEN } from '../src/djen/api';
import { sugerirDescricao, sugerirPrazo } from '../src/prazos/sugestao';

(async () => {
  const itens = await buscarDJEN('100000', 'SP', 10);
  console.log('total', itens.length);
  for (const i of itens.slice(0, 3)) {
    const s = sugerirPrazo(i.texto);
    console.log({ processo: i.processo, tribunal: i.tribunal, data: i.data_disponibilizacao, sug: s.dias, contagem: s.contagem, desc: sugerirDescricao(i.texto), trecho: s.trecho?.slice(0, 90) });
  }
})();
