import * as Notifications from 'expo-notifications';

import { addDays, formatBR, ISODate } from '@/prazos/datas';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

export async function pedirPermissao(): Promise<boolean> {
  const atual = await Notifications.getPermissionsAsync();
  if (atual.granted) return true;
  const r = await Notifications.requestPermissionsAsync();
  return r.granted;
}

function dataLocal(d: ISODate, hora: number): Date {
  const [y, m, day] = d.split('-').map(Number);
  return new Date(y, m - 1, day, hora, 0, 0);
}

/** Agenda alertas para D-antecedência, D-1 e o dia do vencimento. Retorna os IDs. */
export async function agendarAlertas(
  prazo: { id: number; processo: string; descricao: string; data_fim: ISODate },
  opts: { hora: number; antecedencia: number },
): Promise<string[]> {
  if (!(await pedirPermissao())) return [];
  const marcos = Array.from(new Set([opts.antecedencia, 1, 0])).filter((n) => n >= 0);
  const ids: string[] = [];
  const agora = Date.now();
  for (const n of marcos) {
    const quando = dataLocal(addDays(prazo.data_fim, -n), opts.hora);
    if (quando.getTime() <= agora) continue;
    const titulo =
      n === 0 ? '⚠️ Prazo vence HOJE' : n === 1 ? '⏰ Prazo vence amanhã' : `📅 Prazo vence em ${n} dias`;
    const id = await Notifications.scheduleNotificationAsync({
      content: {
        title: titulo,
        body: `${prazo.descricao} · Proc. ${prazo.processo} · Vencimento ${formatBR(prazo.data_fim)}`,
        data: { prazoId: prazo.id },
      },
      trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: quando },
    });
    ids.push(id);
  }
  return ids;
}

export async function cancelarAlertas(ids: string[]) {
  for (const id of ids) {
    try {
      await Notifications.cancelScheduledNotificationAsync(id);
    } catch {}
  }
}

export async function notificacaoTeste() {
  if (!(await pedirPermissao())) return false;
  await Notifications.scheduleNotificationAsync({
    content: { title: '🔔 PrazoClaro', body: 'Os alertas de prazo estão funcionando.' },
    trigger: { type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL, seconds: 5 },
  });
  return true;
}
