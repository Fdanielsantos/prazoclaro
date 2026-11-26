import Ionicons from '@expo/vector-icons/Ionicons';
import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { AdvogadoIntimado, Destinatario } from '@/db/repo';
import { CampoCabecalho, destacar, TipoDestaque } from '@/djen/formatar';
import { cores, esp } from '@/theme';

const ESTILO_DESTAQUE: Record<TipoDestaque, object> = {
  prazo: { backgroundColor: cores.ambarClaro, color: '#92400E', fontWeight: '700' },
  data: { color: cores.primaria, fontWeight: '700' },
  pena: { color: cores.vermelho, fontWeight: '600' },
  comando: { fontWeight: '800' },
};

/** Parágrafo com prazos, datas, cominações e comandos destacados. */
export function ParagrafoDestacado({ texto, tamanho, style }: { texto: string; tamanho: number; style?: object }) {
  const trechos = useMemo(() => destacar(texto), [texto]);
  return (
    <Text selectable style={[{ fontSize: tamanho, lineHeight: Math.round(tamanho * 1.55), color: cores.texto }, style]}>
      {trechos.map((t, i) => (
        <Text key={i} style={t.destaque ? ESTILO_DESTAQUE[t.destaque] : undefined}>
          {t.texto}
        </Text>
      ))}
    </Text>
  );
}

const TAMANHOS = [14, 16, 18, 20];

/** Teor em parágrafos, recolhido nos primeiros e com ajuste do tamanho da letra. */
export function TeorIntimacao({ titulo, paragrafos }: { titulo: string | null; paragrafos: string[] }) {
  const [nivel, setNivel] = useState(1);
  const [expandido, setExpandido] = useState(false);
  const tamanho = TAMANHOS[nivel];

  // Recolhido: os primeiros parágrafos até ~700 caracteres.
  const visiveis = useMemo(() => {
    if (expandido) return paragrafos;
    let soma = 0;
    const out: string[] = [];
    for (const p of paragrafos) {
      if (out.length && soma + p.length > 700) break;
      out.push(p);
      soma += p.length;
    }
    return out;
  }, [paragrafos, expandido]);
  const ocultos = paragrafos.length - visiveis.length;

  return (
    <View style={{ gap: esp.m }}>
      <View style={st.topo}>
        <Text style={st.tituloAto}>{titulo ?? 'Teor da intimação'}</Text>
        <View style={st.fonte}>
          <Pressable hitSlop={8} disabled={nivel === 0} onPress={() => setNivel((n) => n - 1)} style={st.fonteBtn}>
            <Text style={[st.fonteTxt, { fontSize: 13, opacity: nivel === 0 ? 0.3 : 1 }]}>A</Text>
          </Pressable>
          <Pressable hitSlop={8} disabled={nivel === TAMANHOS.length - 1} onPress={() => setNivel((n) => n + 1)} style={st.fonteBtn}>
            <Text style={[st.fonteTxt, { fontSize: 19, opacity: nivel === TAMANHOS.length - 1 ? 0.3 : 1 }]}>A</Text>
          </Pressable>
        </View>
      </View>

      {visiveis.map((p, i) => (
        <ParagrafoDestacado key={i} texto={p} tamanho={tamanho} />
      ))}

      {(ocultos > 0 || expandido) && paragrafos.length > 1 && (
        <Pressable onPress={() => setExpandido(!expandido)} style={st.expandir} hitSlop={6}>
          <Text style={st.expandirTxt}>
            {expandido ? 'Mostrar menos' : `Ler texto completo · mais ${ocultos} parágrafo${ocultos === 1 ? '' : 's'}`}
          </Text>
          <Ionicons name={expandido ? 'chevron-up' : 'chevron-down'} size={16} color={cores.primaria} />
        </Pressable>
      )}
    </View>
  );
}

/** Quadro com as frases que pedem providência. */
export function PontosDeAtencao({ frases }: { frases: string[] }) {
  if (!frases.length) return null;
  return (
    <View style={st.atencao}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
        <Ionicons name="alert-circle" size={18} color={cores.ambar} />
        <Text style={st.atencaoTitulo}>Pontos de atenção</Text>
      </View>
      {frases.map((f, i) => (
        <View key={i} style={{ flexDirection: 'row', gap: 8 }}>
          <Text style={{ color: cores.ambar, fontSize: 15, lineHeight: 21 }}>•</Text>
          <ParagrafoDestacado texto={f} tamanho={14} style={{ flex: 1, lineHeight: 21 }} />
        </View>
      ))}
      <Text style={st.atencaoNota}>Extraído automaticamente do texto. Confira no teor completo.</Text>
    </View>
  );
}

const POLOS: Record<string, string> = { A: 'Polo ativo', P: 'Polo passivo' };

/** Partes e advogados: dados estruturados da API; na falta, o cabeçalho lido do texto. */
export function PartesIntimacao({
  destinatarios,
  advogados,
  cabecalho,
  partesTexto,
}: {
  destinatarios: Destinatario[];
  advogados: AdvogadoIntimado[];
  cabecalho: CampoCabecalho[];
  partesTexto: string | null;
}) {
  // O cabeçalho do texto é mais completo (traz as duas partes e os advogados de cada uma);
  // os destinatários da API listam só quem foi intimado.
  const linhas: CampoCabecalho[] = cabecalho.length
    ? cabecalho
    : destinatarios.length
      ? agrupar(destinatarios.map((d) => ({ rotulo: POLOS[d.polo ?? ''] ?? 'Destinatário', valor: d.nome })))
      : partesTexto
        ? [{ rotulo: 'Partes', valor: partesTexto }]
        : [];

  if (!linhas.length && !advogados.length) return null;
  return (
    <View style={{ gap: 10 }}>
      {linhas.map((l, i) => (
        <View key={i} style={{ gap: 2 }}>
          <Text style={st.rotulo}>{l.rotulo}</Text>
          <Text style={st.valor} selectable>
            {l.valor}
          </Text>
        </View>
      ))}
      {advogados.length > 0 && (
        <View style={{ gap: 2 }}>
          <Text style={st.rotulo}>Advogado{advogados.length > 1 ? 's' : ''} intimado{advogados.length > 1 ? 's' : ''}</Text>
          {advogados.map((a, i) => (
            <Text key={i} style={st.valor} selectable>
              {a.nome}
              {a.oab ? <Text style={{ color: cores.textoSec }}>{`  ·  OAB ${a.oab}/${a.uf ?? ''}`}</Text> : null}
            </Text>
          ))}
        </View>
      )}
    </View>
  );
}

function agrupar(itens: CampoCabecalho[]): CampoCabecalho[] {
  const out: CampoCabecalho[] = [];
  for (const it of itens) {
    const ex = out.find((o) => o.rotulo === it.rotulo);
    if (ex) ex.valor += `\n${it.valor}`;
    else out.push({ ...it });
  }
  return out;
}

const st = StyleSheet.create({
  topo: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  tituloAto: { flex: 1, fontSize: 13, fontWeight: '800', color: cores.textoSec, textTransform: 'uppercase', letterSpacing: 0.6 },
  fonte: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: cores.cinzaClaro, borderRadius: 10, padding: 2 },
  fonteBtn: { width: 34, height: 30, alignItems: 'center', justifyContent: 'center' },
  fonteTxt: { fontWeight: '700', color: cores.primaria },
  expandir: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 8 },
  expandirTxt: { fontSize: 14, fontWeight: '700', color: cores.primaria },
  atencao: { backgroundColor: '#FFFBEB', borderColor: '#FDE68A', borderWidth: 1, borderRadius: 16, padding: esp.m, gap: 8 },
  atencaoTitulo: { fontSize: 15, fontWeight: '800', color: '#92400E' },
  atencaoNota: { fontSize: 11, color: '#B45309' },
  rotulo: { fontSize: 12, fontWeight: '700', color: cores.textoSec, textTransform: 'uppercase', letterSpacing: 0.4 },
  valor: { fontSize: 15, color: cores.texto, lineHeight: 21 },
});
