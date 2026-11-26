import { router } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, ScrollView, Text, View } from 'react-native';

import { Aviso, Botao, Campo, Rotulo, Segmentado } from '@/components/ui';
import { inserirIntimacao, listarFeriadosLocais } from '@/db/repo';
import { addDays, formatBR, hojeISO, ISODate, parseEntrada } from '@/prazos/datas';
import { infoDia } from '@/prazos/feriados';
import { cores, esp } from '@/theme';

export default function NovaIntimacao() {
  const db = useSQLiteContext();
  const [processo, setProcesso] = useState('');
  const [tribunal, setTribunal] = useState('');
  const [data, setData] = useState(formatBR(hojeISO()));
  const [tipoData, setTipoData] = useState<'disp' | 'pub'>('disp');
  const [texto, setTexto] = useState('');
  const [salvando, setSalvando] = useState(false);

  async function salvar() {
    const iso = parseEntrada(data);
    if (!processo.trim()) return Alert.alert('Informe o número do processo');
    if (!iso) return Alert.alert('Data inválida', 'Use o formato dd/mm/aaaa.');
    if (texto.trim().length < 10) return Alert.alert('Cole o texto da intimação');
    setSalvando(true);
    let disp: ISODate = iso;
    if (tipoData === 'pub') {
      // Converte a data de publicação na data de disponibilização equivalente (dia útil anterior).
      const locais = await listarFeriadosLocais(db);
      disp = addDays(iso, -1);
      while (!infoDia(disp, locais).util) disp = addDays(disp, -1);
    }
    const id = await inserirIntimacao(db, {
      djen_id: null,
      processo: processo.trim(),
      tribunal: tribunal.trim().toUpperCase() || null,
      orgao: null,
      tipo: 'Intimação',
      classe: null,
      texto: texto.trim(),
      data_disponibilizacao: disp,
      link: null,
      partes: null,
      origem: 'manual',
    });
    setSalvando(false);
    router.replace(`/intimacao/${id}`);
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={60}>
      <ScrollView contentContainerStyle={{ padding: esp.l, gap: esp.l, paddingBottom: 60 }} keyboardShouldPersistTaps="handled">
        <Text style={{ fontSize: 15, color: cores.textoSec, lineHeight: 21 }}>
          Recebeu uma intimação por e-mail, PDF ou sistema do tribunal? Cole o texto aqui para calcular o prazo.
        </Text>
        <Campo rotulo="Número do processo" value={processo} onChangeText={setProcesso} placeholder="0000000-00.0000.0.00.0000" />
        <Campo rotulo="Tribunal (opcional)" value={tribunal} onChangeText={setTribunal} placeholder="TJSP" autoCapitalize="characters" />
        <View style={{ gap: 6 }}>
          <Rotulo>A data informada é a de…</Rotulo>
          <Segmentado
            opcoes={[
              { valor: 'disp', rotulo: 'Disponibilização' },
              { valor: 'pub', rotulo: 'Publicação' },
            ]}
            valor={tipoData}
            onChange={setTipoData}
          />
        </View>
        <Campo value={data} onChangeText={setData} placeholder="dd/mm/aaaa" keyboardType="numbers-and-punctuation" />
        <Campo
          rotulo="Texto da intimação"
          value={texto}
          onChangeText={setTexto}
          multiline
          placeholder="Cole aqui o teor da decisão/despacho…"
          style={{ minHeight: 180, textAlignVertical: 'top' }}
        />
        <Aviso texto="No DJEN, a publicação considera-se feita no 1º dia útil após a disponibilização, e o prazo começa no dia útil seguinte." />
        <Botao titulo="Continuar" icone="arrow-forward" onPress={salvar} carregando={salvando} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
