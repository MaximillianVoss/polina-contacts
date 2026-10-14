import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Platform,
  Pressable,
  StatusBar,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';

import { ContactRow } from './src/ContactRow';
import { ContactsLoadError, loadContacts } from './src/contacts';
import type { ContactsLoadResult, DisplayContact } from './src/contacts';
import { expoContactsApi } from './src/expoContacts';

type ScreenState =
  | { kind: 'idle' }
  | { kind: 'loading'; loadedCount: number }
  | { kind: 'error'; message: string }
  | ContactsLoadResult;

function StateMessage({ state }: { state: ScreenState }) {
  let title: string;
  let detail: string;

  if (state.kind === 'loading') {
    return (
      <View style={styles.message} accessibilityLiveRegion="polite">
        <ActivityIndicator size="large" color="#244d91" accessibilityLabel="Чтение контактов" />
        <Text style={styles.messageTitle}>Читаем контакты…</Text>
        <Text style={styles.messageDetail}>Загружено записей: {state.loadedCount}</Text>
      </View>
    );
  }
  if (state.kind === 'permission-denied') {
    title = 'Нет разрешения';
    detail = state.canAskAgain
      ? 'Доступ к контактам не предоставлен. Нажмите GET CONTACTS, чтобы запросить разрешение повторно.'
      : 'Система больше не показывает запрос разрешения. Откройте настройки этого приложения и разрешите доступ к контактам, затем нажмите GET CONTACTS.';
  } else if (state.kind === 'unavailable' || (state.kind === 'idle' && Platform.OS === 'web')) {
    title = 'Адресная книга недоступна';
    detail = 'Expo Contacts читает системные контакты на Android и iOS. Откройте проект в Expo Go на телефоне или в настроенном эмуляторе. В браузере контакты не подставляются.';
  } else if (state.kind === 'error') {
    title = 'Не удалось загрузить';
    detail = state.message;
  } else if (state.kind === 'success') {
    title = 'Список пуст';
    detail = state.limited
      ? 'Среди контактов, к которым iOS предоставила доступ, записей не найдено. Доступ можно изменить в настройках приложения.'
      : 'Адресная книга не вернула ни одной доступной записи. Добавьте контакт средствами устройства и повторите чтение.';
  } else {
    title = 'Нажмите GET CONTACTS';
    detail = 'Приложение запросит разрешение и прочитает доступные записи. Контакты без имени или телефона тоже появятся в списке.';
  }

  return (
    <View style={styles.message} accessibilityLiveRegion="polite">
      <Text style={styles.messageTitle}>{title}</Text>
      <Text style={styles.messageDetail}>{detail}</Text>
    </View>
  );
}

function ContactsScreen() {
  const [state, setState] = useState<ScreenState>({ kind: 'idle' });
  const mounted = useRef(false);
  const reading = useRef(false);
  const generation = useRef(0);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      generation.current += 1;
      reading.current = false;
    };
  }, []);

  async function handleGetContacts() {
    // The ref prevents two requests before React renders the disabled button.
    if (reading.current || !mounted.current) {
      return;
    }
    reading.current = true;
    const request = ++generation.current;
    const isCancelled = () => !mounted.current || generation.current !== request;
    setState({ kind: 'loading', loadedCount: 0 });

    try {
      const result = await loadContacts(expoContactsApi, {
        isCancelled,
        onProgress(loadedCount) {
          if (!isCancelled()) {
            setState({ kind: 'loading', loadedCount });
          }
        },
      });
      if (!isCancelled()) {
        setState(result);
      }
    } catch (error: unknown) {
      if (!isCancelled()) {
        setState({
          kind: 'error',
          message: error instanceof ContactsLoadError
            ? error.message
            : 'Не удалось прочитать контакты. Попробуйте ещё раз.',
        });
      }
    } finally {
      if (!isCancelled()) {
        reading.current = false;
      }
    }
  }

  const busy = state.kind === 'loading';
  const contacts = state.kind === 'success' ? state.contacts : [];
  const header = (
    <View style={styles.header}>
      <Text style={styles.eyebrow}>ЗАДАНИЕ 13 · EXPO CONTACTS</Text>
      <Text style={styles.title} accessibilityRole="header">Контакты</Text>
      <Text style={styles.subtitle}>Имена и все телефонные номера из адресной книги устройства.</Text>
      <Pressable
        style={({ pressed }) => [styles.button, pressed && styles.buttonPressed, busy && styles.buttonDisabled]}
        onPress={handleGetContacts}
        disabled={busy}
        accessibilityRole="button"
        accessibilityLabel="GET CONTACTS — запросить доступ и прочитать контакты"
        accessibilityHint="На телефоне система может запросить разрешение на чтение адресной книги"
        accessibilityState={{ disabled: busy, busy }}
      >
        <Text style={styles.buttonText}>{busy ? 'ЧТЕНИЕ…' : 'GET CONTACTS'}</Text>
      </Pressable>
      <Text style={styles.privacy}>Чтение запускается только по кнопке. Данные остаются в памяти приложения.</Text>
      {state.kind === 'success' && state.limited ? (
        <View style={styles.notice} accessibilityLiveRegion="polite">
          <Text style={styles.noticeTitle}>Ограниченный доступ iOS</Text>
          <Text style={styles.noticeText}>
            Показаны все записи, доступные приложению. iOS разрешила читать только выбранные контакты; список разрешённых записей можно изменить в настройках приложения.
          </Text>
        </View>
      ) : null}
      {state.kind === 'success' ? (
        <Text style={styles.count} accessibilityLiveRegion="polite">Доступно записей: {contacts.length}</Text>
      ) : null}
    </View>
  );

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" />
      <View style={styles.container}>
        <FlatList<DisplayContact>
          data={contacts}
          keyExtractor={(contact) => contact.id}
          renderItem={({ item }) => <ContactRow contact={item} />}
          ListHeaderComponent={header}
          ListEmptyComponent={<StateMessage state={state} />}
          contentContainerStyle={styles.listContent}
          initialNumToRender={12}
          showsVerticalScrollIndicator
        />
      </View>
    </SafeAreaView>
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
      <ContactsScreen />
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#f3f6fb' },
  container: { flex: 1, width: '100%', maxWidth: 780, alignSelf: 'center' },
  listContent: { paddingHorizontal: 20, paddingBottom: 30 },
  header: { paddingTop: 24, paddingBottom: 18 },
  eyebrow: { fontSize: 11, lineHeight: 17, letterSpacing: 1.4, fontWeight: '700', color: '#52657b' },
  title: { marginTop: 10, fontSize: 34, lineHeight: 42, fontWeight: '800', color: '#17283e' },
  subtitle: { marginTop: 8, fontSize: 16, lineHeight: 25, color: '#52657b' },
  button: { marginTop: 24, backgroundColor: '#244d91', paddingVertical: 16, paddingHorizontal: 22, borderRadius: 14, alignItems: 'center' },
  buttonPressed: { backgroundColor: '#19396f' },
  buttonDisabled: { opacity: 0.65 },
  buttonText: { color: '#ffffff', fontSize: 15, lineHeight: 22, fontWeight: '700', letterSpacing: 0.6 },
  privacy: { marginTop: 12, fontSize: 12, lineHeight: 19, color: '#52657b' },
  notice: { marginTop: 20, borderRadius: 14, padding: 16, backgroundColor: '#fff2d4', borderWidth: 1, borderColor: '#e8cb83' },
  noticeTitle: { fontSize: 14, lineHeight: 21, fontWeight: '700', color: '#60490f' },
  noticeText: { marginTop: 6, fontSize: 13, lineHeight: 21, color: '#60490f' },
  count: { marginTop: 24, fontSize: 14, lineHeight: 22, fontWeight: '600', color: '#52657b' },
  message: { padding: 24, gap: 10, borderWidth: 1, borderColor: '#dce5ed', borderRadius: 18, backgroundColor: '#ffffff', alignItems: 'center' },
  messageTitle: { fontSize: 18, lineHeight: 25, fontWeight: '700', color: '#17283e', textAlign: 'center' },
  messageDetail: { fontSize: 14, lineHeight: 23, color: '#52657b', textAlign: 'center' },
});
