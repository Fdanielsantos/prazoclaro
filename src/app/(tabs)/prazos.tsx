import { router, useFocusEffect } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useState } from 'react';
import { FlatList, View } from 'react-native';

import { PrazoCard } from '@/components/PrazoCard';
import { Botao, Segmentado, Vazio } from '@/components/ui';
import { listarPrazos, Prazo } from '@/db/repo';
import { esp } from '@/theme';

export default function Prazos() {
  const db = useSQLiteContext();
  const [status, setStatus] = useState<'pendente' | 'cumprido'>('pendente');
  const [itens, setItens] = useState<Prazo[]>([]);

  useFocusEffect(
    useCallback(() => {
      listarPrazos(db, status).then(setItens);
    }, [db, status]),
  );

  return (
    <FlatList
      data={itens}
      keyExtractor={(p) => String(p.id)}
      contentContainerStyle={{ padding: esp.l, gap: esp.m, paddingBottom: 40 }}
      ListHeaderComponent={
        <View style={{ marginBottom: esp.xs }}>
          <Segmentado
            opcoes={[
              { valor: 'pendente', rotulo: 'Em aberto' },
              { valor: 'cumprido', rotulo: 'Cumpridos' },
            ]}
            valor={status}
            onChange={setStatus}
          />
        </View>
      }
      ListEmptyComponent={
        status === 'pendente' ? (
          <Vazio
            icone="calendar-outline"
            titulo="Nenhum prazo em aberto"
            texto="Abra uma intimação e toque em “Salvar prazo” para começar a controlar."
            acao={<Botao titulo="Ir para intimações" icone="mail-unread-outline" onPress={() => router.push('/intimacoes')} />}
          />
        ) : (
          <Vazio icone="checkmark-done-outline" titulo="Nada por aqui" texto="Prazos marcados como cumpridos aparecem nesta lista." />
        )
      }
      renderItem={({ item }) => <PrazoCard prazo={item} />}
    />
  );
}
