# 13 · Contacts — полный разбор, код и запуск

[Исходное условие](../assignments/mobile-13-contacts.md) · [Проект](../../../PROJECT-README.md) · Общий запуск на Mac (исходная общая ссылка вне этого пакета)

## 1. Сначала условие: что требуется

Создать мобильное приложение, которое **после нажатия кнопки** показывает все доступные контакты устройства в **FlatList**, с именами и телефонными номерами. Название кнопки на образце — `GET CONTACTS`.

Не требуются создание/редактирование/удаление контактов, сервер, API-ключ или сохранение адресной книги. В нашем решении контакт без имени или телефона не исчезает, а у контакта с несколькими телефонами выводятся все номера. «Все» означает записи, к которым ОС дала доступ; приложение не обходит отказ пользователя или ограничение iOS.

Маршрут: распаковать проект → установить зависимости → понять точку входа → связать кнопку с разрешением и чтением → вывести данные → проверить состояния и несколько страниц → продемонстрировать на устройстве.

## 2. Где находятся исходники и что скопировать

Архив содержит самостоятельную папку `13-contacts/contacts-app`. В ней уже есть весь код, конфигурация, lock-файл, тесты и этот мануал. Git-истории и привязки к удалённому репозиторию нет.

```text
13-contacts/
  contacts-app/
    App.tsx
    index.ts
    app.json
    package.json
    package-lock.json
    tsconfig.json
    src/
      contacts.ts
      expoContacts.ts
      ContactRow.tsx
    tests/contacts.test.ts
    docs/ASSIGNMENT.md
    docs/MANUAL.md
    docs/SOURCE.png
    README.md
```

Извлечь `13-contacts` в `<локальный-путь>`. Должен получиться путь `HW.Group-2/13-contacts/contacts-app/package.json`. Если Finder создал лишнюю внешнюю папку, переместить внутреннюю `13-contacts` на этот уровень. Не смешивать файлы с Shopping List: это отдельное приложение.

## 3. Подготовка и первый запуск на Mac

Готовый проект использует **Expo SDK 57, React Native и TypeScript**, а не React Web/Vite. Нужен **Node.js 24.x**. В Terminal:

```bash
node --version
cd <папка-этого-репозитория>
npm ci
npm run typecheck
npm test
npm start
```

`npm ci` здесь работает, потому что `package-lock.json` включён в архив и соответствует `package.json`. Для своего пустого проекта без lock-файла сначала выполнить `npm install`. Не запускать установку из внешней папки `13-contacts`, где нет `package.json`.

Если Node другой версии и уже используется NVM:

```bash
source "$HOME/.nvm/nvm.sh"
nvm install 24
nvm use 24
```

Это не установка NVM: команды применяются только если он уже есть. После смены Node повторить `npm ci`.

`npm start` запускает Metro и печатает QR-код: открыть его в **Expo Go совместимого SDK** на телефоне. Для своего development build устанавливается эта же конфигурация проекта. Телефон должен видеть компьютер по сети; при проблеме сети можно попробовать `npx expo start --tunnel` после обычного запуска. Для iOS Simulator нужен установленный Xcode, для Android — Android Studio/SDK и настроенный эмулятор:

```bash
npm run ios
# Или:
npm run android
```

На симуляторе сначала создать несколько тестовых контактов. Не использовать личную адресную книгу для публичных скриншотов.

### Общий build-and-run.sh, который уже использовали

```bash
cd <папка-этого-репозитория>
bash ./build-and-run.sh --list
bash ./build-and-run.sh --project "13-contacts/contacts-app" --expo-platform ios
```

Для Android заменить `ios` на `android`. Если старая копия скрипта не понимает параметры, посмотреть `bash ./build-and-run.sh --help` и запустить индивидуально командами выше. Не угадывать номер в меню: список изменяется при добавлении проектов. Открывать адрес, который напечатал запускатель. JSON на корневом порту Metro — манифест, не приложение и не эмулятор.

`npm run web` годится для проверки экрана и сообщения о недоступности, **но не для чтения телефонных контактов**. У `expo-contacts` нет такого доступа в браузере. [Официальный Contacts API](https://docs.expo.dev/versions/latest/sdk/contacts-legacy/).

## 4. Если делаем с нуля, а не распаковываем готовое

В `create-project.sh` выбрать Expo / React Native / TypeScript и пустой шаблон без Router. Создать `contacts-app` внутри `13-contacts`. Для задания не нужен веб-шаблон Vite.

Для проекта **того же SDK 57** разместить полные файлы ниже и установить зависимости:

```bash
npm install
npx expo install --check
```

Если добавляем только возможности в уже существующий Expo-проект, устанавливать библиотеку через `npx expo install expo-contacts react-native-safe-area-context`. Команда подберёт версии под его SDK. **Не переносить package.json SDK 57 в SDK 54** и не смешивать версии React Native. Для SDK 54 старые функции импортировались из `expo-contacts`; в этом решении SDK 57 используется `expo-contacts/legacy`. Правильный импорт определяется версией проекта, не расширением `.tsx`. [API SDK 54](https://docs.expo.dev/versions/v54.0.0/sdk/contacts/), [актуальный legacy API](https://docs.expo.dev/versions/latest/sdk/contacts-legacy/).

## 5. Как устроено решение от входа до списка

1. `package.json` указывает `main: "index.ts"`.
2. `index.ts` вызывает `registerRootComponent(App)`. Изменяем именно корневой `App.tsx`, а не чужой `src/App.tsx` от Vite-шаблона.
3. `App` включает `SafeAreaProvider`, а `ContactsScreen` показывает заголовок, кнопку и `FlatList`.
4. До нажатия состояние `idle`. При открытии экрана запрос разрешения **не выполняется**.
5. `handleGetContacts` включает `loading` и вызывает `loadContacts`.
6. Логика проверяет доступность, спрашивает разрешение и читает страницы по очереди до `hasNextPage === false`.
7. `formatContact` превращает системную запись в `DisplayContact`: ID, отображаемое имя, массив телефонов.
8. `setState(result)` передаёт готовый список React. `FlatList` создаёт строки через `ContactRow`.
9. Ошибки, отказ, пустой список и ограниченное разрешение показываются отдельно, не маскируются под «контактов нет».

### Три ответственности

| Файл | За что отвечает | Почему отдельно |
|---|---|---|
| `src/contacts.ts` | Правила чтения, типы и нормализация | Можно тестировать без телефона, React и Expo |
| `src/expoContacts.ts` | Вызовы настоящего нативного API | Смена SDK не меняет всю логику |
| `App.tsx`, `ContactRow.tsx` | Кнопка, состояния и отображение | Экран не смешивает оформление с обработкой страниц |

Интерфейс `ContactsApi` — контракт из трёх функций. Настоящий адаптер читает устройство, а тестовый возвращает заранее заданные страницы. Тестовая реализация не включена в рабочий экран и не выдаётся за настоящие контакты.

## 6. Функции и конструкции: что делают и почему

| Элемент | Назначение | Причина выбора |
|---|---|---|
| `SourceContact`, `DisplayContact` | Описывают данные ОС и данные экрана | Поля устройства могут отсутствовать; экран получает предсказуемую модель |
| `ContactsLoadResult` | `unavailable`, `permission-denied` или `success` | TypeScript не позволяет перепутать отказ со списком |
| `textOrEmpty` | Убирает пробелы и заменяет отсутствующую строку на пустую | Не вызываем `.trim()` у `undefined` |
| `formatContact` | Имя → части имени → компания → «Без имени»; все телефоны с подписями | Не теряем неполные записи и дополнительные номера |
| `uniqueKey` | Создаёт различимые ключи даже при повторном ID | React не должен перепутать строки или телефоны |
| `readStage` | Проверяет отмену, выполняет этап и классифицирует ошибку | Не показываем системное исключение с личными данными |
| `loadContacts` | Разрешение и последовательное чтение всех страниц | Первая страница — ещё не все контакты |
| `pageOffset += page.data.length` | Сдвигает начало на фактически прочитанные записи | Короткая страница не приводит к пропуску контактов |
| `onProgress` | Передаёт счётчик чтения экрану | Понятно, что длинная операция не зависла |
| `requestPermissionsAsync` | Просит ОС разрешить чтение | Нельзя читать адресную книгу без согласия |
| `getContactsAsync` | Читает страницу с именами и телефонами | Системный источник вместо ручного списка |
| `useState` | Хранит состояние для отображения | Изменение состояния вызывает перерисовку |
| `useRef` (`reading`) | Мгновенно блокирует второй запуск | До следующего рендера `disabled` ещё может не обновиться |
| `generation`, `isCancelled` | Отличают актуальный запрос от старого | После ухода с экрана не обновляем снятый компонент |
| `useEffect` | Только устанавливает/снимает флаг жизни экрана | Не загружает контакты автоматически, условие кнопки сохранено |
| `try / catch / finally` | Результат, ошибка, освобождение блокировки | После сбоя можно повторить чтение |
| `StateMessage` | Разные пояснения для отказа, пустоты, ошибки, web | Пользователь понимает причину отсутствия списка |
| `FlatList`, `renderItem`, `keyExtractor` | Отображают список строк с устойчивыми ID | Это прямо требуемый компонент, удобный для длинного списка |
| `SafeAreaView` | Не перекрывает содержимое вырезом/системными областями | Один экран работает на разных телефонах |
| `StyleSheet.create` | Объявляет стили React Native | Здесь нет HTML и отдельного CSS, как в Vite |

### Почему чтение страниц защищено

Размер страницы — 200 записей. Пустая страница с `hasNextPage: true`, повторение уже прочитанных ID и защитный предел 10 000 страниц вызывают понятную ошибку, а не бесконечный цикл. При ошибке частичный список не выдаётся за «все контакты». Контакты с пустыми телефонами не фильтруются. Все записи хранятся в памяти, а `FlatList` экономит работу по отрисовке видимых строк; это не означает, что данные никогда не загружаются целиком.

На iOS ограниченное разрешение отмечается `limited`. В таком режиме приложение показывает все **разрешённые** записи и объясняет ограничение. Если `canAskAgain === false`, повторный запрос не поможет: доступ изменить в настройках системы.

В собственной Android-сборке конфигурация блокирует `WRITE_CONTACTS`: нам нужно только чтение. Параметры native permissions в `app.json` применяются при сборке своего бинарного приложения; Expo Go имеет собственную нативную конфигурацию. Исходники не вызывают операции записи, независимо от оболочки запуска.

## 7. Полезные ошибки и их исправление

| Симптом | Что проверить |
|---|---|
| `npm ci` требует lock-файл | Находимся в `contacts-app`? В архиве есть `package-lock.json`; не копировать только App.tsx |
| `Cannot resolve entry file` | `main` указывает на существующий `index.ts`; он импортирует `./App` |
| В браузере адресная книга недоступна | Ожидаемое ограничение; запустить на iOS/Android |
| Пустой список в симуляторе | Создать тестовые контакты средствами симулятора |
| Разрешение больше не спрашивается | Изменить доступ в настройках приложения/Expo Go |
| Видна только часть адресной книги | Проверить выбранные контакты/полный доступ iOS и отсутствие ошибки пагинации |
| Старые Contacts функции сообщают о deprecated API | Для SDK 57 использовать импорт `/legacy`, как в адаптере; не менять его на корневой импорт |
| Симулятор не открывается | Настроить Xcode/Android Studio или использовать телефон с совместимым Expo Go |

## 8. Проверки и демонстрация

```bash
npm run typecheck
npm test
npx expo install --check
npm run build
```

`npm test` проверяет логику с искусственными страницами. Это не чтение реальной адресной книги. `npm run build` экспортирует JavaScript и ресурсы для Android/iOS/web; **это не создание APK/IPA** и не доказательство показа системного разрешения на Mac/телефоне.

Ручная проверка на устройстве:

| Шаг | Ожидаемый результат |
|---|---|
| Открыть приложение | Нет автоматического системного запроса; видна GET CONTACTS |
| Нажать и отказать | Сообщение об отказе, контакты не прочитаны |
| Разрешить доступ | Имя и номер тестового контакта видны |
| Контакт с двумя телефонами | Оба номера показаны |
| Контакт без номера/имени | Запись остаётся, есть понятная подстановка |
| Пустая адресная книга | Отдельное сообщение «Список пуст» |
| Более 200 тестовых контактов | Видна последняя запись, а не только первая страница |
| Ограниченный доступ iOS | Показаны только разрешённые записи и предупреждение |
| Повторно нажать во время чтения | Второй параллельный запрос не запускается |
| Закрыть экран во время чтения | Нет обновления размонтированного экрана |

### Что показать и как объяснить ученице

Начать с `App.tsx`: где кнопка, `onPress`, состояние и `FlatList`. Затем перейти к `loadContacts`: сначала доступность и разрешение, потом цикл страниц. Показать `formatContact` на неполной записи и `ContactRow` с двумя номерами. В завершение запустить тесты и пройти ручные сценарии с тестовыми контактами. Реальные контакты не публиковать и не логировать.

На сдачу: исходники, конфигурация, lock-файл, README и демонстрация на устройстве. `node_modules`, `dist`, личные данные не нужны. Дата и точный канал сдачи на исходном скриншоте не указаны; это не мешает реализовать само задание.

`package-lock.json` формируется npm, входит в проект целиком и не редактируется вручную. Его длинный список зависимостей не дублируется ниже; все написанные нами файлы кода, конфигурации и тестов приведены полностью.

## Полное содержимое файлов

Код ниже получен непосредственно из проверяемого проекта. Не нужно угадывать пропущенные строки или дописывать JSX. Создавайте файлы по указанным путям, относительно корня приложения.

### package.json

Зависимости, версия Node и команды проверки/запуска.

```json
{
  "name": "assignment13-contacts",
  "version": "1.0.0",
  "private": true,
  "type": "module",
  "main": "index.ts",
  "engines": {
    "node": ">=24 <25"
  },
  "scripts": {
    "start": "expo start",
    "android": "expo start --android",
    "ios": "expo start --ios",
    "web": "expo start --web",
    "typecheck": "tsc --noEmit",
    "test": "node --experimental-strip-types --test tests/*.test.ts",
    "build": "expo export --platform all --output-dir dist",
    "bundle:android": "expo export --platform android --output-dir dist-android",
    "bundle:ios": "expo export --platform ios --output-dir dist-ios"
  },
  "dependencies": {
    "@expo/metro-runtime": "~57.0.16",
    "expo": "~57.0.24",
    "expo-contacts": "~57.0.5",
    "react": "19.2.3",
    "react-dom": "19.2.3",
    "react-native": "0.86.3",
    "react-native-safe-area-context": "~5.7.0",
    "react-native-web": "~0.21.0"
  },
  "devDependencies": {
    "@types/node": "~24.0.0",
    "@types/react": "~19.2.2",
    "typescript": "~6.0.3"
  }
}
```

### app.json

Настройки Expo и разрешение на чтение контактов.

```json
{
  "expo": {
    "name": "Assignment 13 Contacts",
    "slug": "assignment13-contacts",
    "version": "1.0.0",
    "orientation": "portrait",
    "userInterfaceStyle": "light",
    "platforms": ["ios", "android", "web"],
    "ios": {
      "supportsTablet": true
    },
    "android": {
      "blockedPermissions": ["android.permission.WRITE_CONTACTS"]
    },
    "web": {
      "bundler": "metro"
    },
    "plugins": [
      [
        "expo-contacts",
        {
          "contactsPermission": "Allow $(PRODUCT_NAME) to read contact names and phone numbers when you tap GET CONTACTS."
        }
      ]
    ]
  }
}
```

### tsconfig.json

Строгая проверка TypeScript, включая тесты.

```json
{
  "extends": "expo/tsconfig.base",
  "compilerOptions": {
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "allowImportingTsExtensions": true,
    "noEmit": true,
    "types": ["react", "node"]
  },
  "include": ["**/*.ts", "**/*.tsx"],
  "exclude": ["node_modules", "dist", "dist-android", "dist-ios"]
}
```

### index.ts

Регистрация App как действительной точки входа Expo.

```typescript
import { registerRootComponent } from 'expo';

import App from './App';

registerRootComponent(App);
```

### src/contacts.ts

Типы данных, форматирование и чтение всех страниц без зависимости от устройства.

```typescript
// This module has no Expo or React Native imports, so it can be tested with Node.
export interface SourcePhoneNumber {
  id?: string | null;
  label?: string | null;
  number?: string | null;
  digits?: string | null;
}

export interface SourceContact {
  id?: string | null;
  name?: string | null;
  firstName?: string | null;
  middleName?: string | null;
  lastName?: string | null;
  company?: string | null;
  phoneNumbers?: readonly SourcePhoneNumber[] | null;
}

export interface ContactPhone {
  id: string;
  label: string;
  number: string;
}

export interface DisplayContact {
  id: string;
  name: string;
  phoneNumbers: ContactPhone[];
}

export interface ContactsPermission {
  status: 'granted' | 'denied' | 'undetermined';
  canAskAgain: boolean;
  accessPrivileges?: 'all' | 'limited' | 'none';
}

export interface ContactsPage {
  data: readonly SourceContact[];
  hasNextPage: boolean;
}

export interface PageQuery {
  pageSize: number;
  pageOffset: number;
}

export interface ContactsApi {
  isAvailableAsync: () => Promise<boolean>;
  requestPermissionsAsync: () => Promise<ContactsPermission>;
  getContactsPageAsync: (query: PageQuery) => Promise<ContactsPage>;
}

export type ContactsLoadResult =
  | { kind: 'unavailable' }
  | { kind: 'permission-denied'; canAskAgain: boolean }
  | { kind: 'success'; contacts: DisplayContact[]; limited: boolean };

export type ContactsErrorCode =
  | 'availability'
  | 'permission'
  | 'read'
  | 'pagination'
  | 'cancelled';

const ERROR_MESSAGES: Record<ContactsErrorCode, string> = {
  availability: 'Не удалось проверить доступность адресной книги. Попробуйте ещё раз.',
  permission: 'Не удалось запросить разрешение на чтение контактов. Попробуйте ещё раз.',
  read: 'Не удалось прочитать контакты. Проверьте разрешение и попробуйте ещё раз.',
  pagination: 'Чтение страниц контактов остановлено: API не продвигается корректно. Попробуйте ещё раз.',
  cancelled: 'Чтение контактов отменено.',
};

export class ContactsLoadError extends Error {
  readonly code: ContactsErrorCode;

  constructor(code: ContactsErrorCode) {
    // Do not display native exception messages: they may contain personal data.
    super(ERROR_MESSAGES[code]);
    this.name = 'ContactsLoadError';
    this.code = code;
  }
}

export interface LoadContactsOptions {
  pageSize?: number;
  maxPages?: number;
  isCancelled?: () => boolean;
  onProgress?: (loadedCount: number) => void;
}

function textOrEmpty(value: string | null | undefined): string {
  return value?.trim() ?? '';
}

function uniqueKey(base: string, occurrences: Map<string, number>): string {
  const occurrence = (occurrences.get(base) ?? 0) + 1;
  occurrences.set(base, occurrence);
  // Include the occurrence even for the first row so IDs cannot collide with suffixes.
  return JSON.stringify([base, occurrence]);
}

export function formatContact(
  source: SourceContact,
  id: string,
): DisplayContact {
  const parts = [source.firstName, source.middleName, source.lastName]
    .map(textOrEmpty)
    .filter((part) => part.length > 0)
    .join(' ');
  const name = textOrEmpty(source.name) || parts || textOrEmpty(source.company) || 'Без имени';
  const phoneKeys = new Map<string, number>();

  return {
    id,
    name,
    // Keep every phone entry, including duplicate numbers and incomplete entries.
    phoneNumbers: (source.phoneNumbers ?? []).map((phone, index) => ({
      id: uniqueKey(
        JSON.stringify([id, textOrEmpty(phone.id) || `phone-position:${index}`]),
        phoneKeys,
      ),
      label: textOrEmpty(phone.label) || 'Телефон',
      number: textOrEmpty(phone.number) || textOrEmpty(phone.digits) || 'Номер не указан',
    })),
  };
}

function checkCancellation(options: LoadContactsOptions): void {
  if (options.isCancelled?.()) {
    throw new ContactsLoadError('cancelled');
  }
}

async function readStage<T>(
  operation: () => Promise<T>,
  code: 'availability' | 'permission' | 'read',
  options: LoadContactsOptions,
): Promise<T> {
  checkCancellation(options);
  let result: T;
  try {
    result = await operation();
  } catch {
    checkCancellation(options);
    throw new ContactsLoadError(code);
  }
  checkCancellation(options);
  return result;
}

export async function loadContacts(
  api: ContactsApi,
  options: LoadContactsOptions = {},
): Promise<ContactsLoadResult> {
  const pageSize = options.pageSize ?? 200;
  // A defensive upper bound prevents an endless loop even if an API omits IDs.
  const maxPages = options.maxPages ?? 10_000;
  if (!Number.isSafeInteger(pageSize) || pageSize < 1) {
    throw new RangeError('pageSize must be a positive safe integer.');
  }
  if (!Number.isSafeInteger(maxPages) || maxPages < 1) {
    throw new RangeError('maxPages must be a positive safe integer.');
  }

  if (!(await readStage(api.isAvailableAsync, 'availability', options))) {
    return { kind: 'unavailable' };
  }

  const permission = await readStage(api.requestPermissionsAsync, 'permission', options);
  if (permission.status !== 'granted' || permission.accessPrivileges === 'none') {
    return { kind: 'permission-denied', canAskAgain: permission.canAskAgain };
  }

  const contacts: DisplayContact[] = [];
  const contactKeys = new Map<string, number>();
  const seenNativeIds = new Set<string>();
  let pageOffset = 0;

  for (let pageIndex = 0; pageIndex < maxPages; pageIndex += 1) {
    const page = await readStage(
      () => api.getContactsPageAsync({ pageSize, pageOffset }),
      'read',
      options,
    );

    if (page.hasNextPage && page.data.length === 0) {
      throw new ContactsLoadError('pagination');
    }
    const nativeIds = page.data.map((contact) => textOrEmpty(contact.id));
    // ExistingContact IDs are unique in the native API. A page containing only
    // previously read IDs means the provider ignored the requested pageOffset.
    if (
      nativeIds.length > 0 &&
      nativeIds.every((id) => id.length > 0 && seenNativeIds.has(id))
    ) {
      throw new ContactsLoadError('pagination');
    }

    page.data.forEach((source, index) => {
      const nativeId = textOrEmpty(source.id);
      const base = nativeId
        ? JSON.stringify(['native', nativeId])
        : JSON.stringify(['position', pageOffset + index]);
      contacts.push(formatContact(source, uniqueKey(base, contactKeys)));
      if (nativeId) {
        seenNativeIds.add(nativeId);
      }
    });

    options.onProgress?.(contacts.length);
    checkCancellation(options);
    if (!page.hasNextPage) {
      return {
        kind: 'success',
        contacts,
        limited: permission.accessPrivileges === 'limited',
      };
    }

    const nextOffset = pageOffset + page.data.length;
    if (!Number.isSafeInteger(nextOffset) || nextOffset <= pageOffset) {
      throw new ContactsLoadError('pagination');
    }
    // Advance by the actual page length; a shorter page must not skip records.
    pageOffset = nextOffset;
  }

  throw new ContactsLoadError('pagination');
}
```

### src/expoContacts.ts

Единственное подключение к реальному Expo Contacts API.

```typescript
import * as Contacts from 'expo-contacts/legacy';
import { Platform } from 'react-native';

import type { ContactsApi } from './contacts';

// The SDK 57 root export uses the newer class API; these functions belong to legacy.
export const expoContactsApi: ContactsApi = {
  async isAvailableAsync() {
    // Browsers have no system address book exposed through expo-contacts.
    if (Platform.OS === 'web') {
      return false;
    }
    return Contacts.isAvailableAsync();
  },
  async requestPermissionsAsync() {
    const permission = await Contacts.requestPermissionsAsync();
    return {
      status: permission.status,
      canAskAgain: permission.canAskAgain,
      accessPrivileges: permission.accessPrivileges,
    };
  },
  async getContactsPageAsync({ pageSize, pageOffset }) {
    const page = await Contacts.getContactsAsync({
      fields: [
        Contacts.Fields.ID,
        Contacts.Fields.Name,
        Contacts.Fields.FirstName,
        Contacts.Fields.MiddleName,
        Contacts.Fields.LastName,
        Contacts.Fields.Company,
        Contacts.Fields.PhoneNumbers,
      ],
      pageSize,
      pageOffset,
      sort: Contacts.SortTypes.FirstName,
    });
    return { data: page.data, hasNextPage: page.hasNextPage };
  },
};
```

### src/ContactRow.tsx

Отображение имени и всех телефонных номеров одного контакта.

```tsx
import { StyleSheet, Text, View } from 'react-native';

import type { DisplayContact } from './contacts';

interface ContactRowProps {
  contact: DisplayContact;
}

export function ContactRow({ contact }: ContactRowProps) {
  const initial = contact.name === 'Без имени' ? '?' : Array.from(contact.name)[0]?.toUpperCase();

  return (
    <View style={styles.card}>
      <View style={styles.avatar} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
        <Text style={styles.initial}>{initial || '?'}</Text>
      </View>
      <View style={styles.details}>
        <Text style={styles.name} accessibilityRole="header" selectable>{contact.name}</Text>
        {contact.phoneNumbers.length === 0 ? (
          <Text style={styles.noPhone}>Телефон не указан</Text>
        ) : (
          contact.phoneNumbers.map((phone) => (
            <View key={phone.id} style={styles.phone}>
              <Text style={styles.label}>{phone.label}</Text>
              <Text
                style={styles.number}
                selectable
                accessibilityLabel={`${phone.label}: ${phone.number}`}
              >
                {phone.number}
              </Text>
            </View>
          ))
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 14,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#dce5ed',
    borderRadius: 18,
    padding: 18,
    marginBottom: 12,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: '#e6eefb',
    alignItems: 'center',
    justifyContent: 'center',
  },
  initial: { fontSize: 22, fontWeight: '700', color: '#244d91' },
  details: { flex: 1, minWidth: 0 },
  name: { fontSize: 18, lineHeight: 25, fontWeight: '700', color: '#17283e' },
  phone: { marginTop: 10 },
  label: { fontSize: 12, lineHeight: 18, color: '#52657b' },
  number: { fontSize: 16, lineHeight: 23, color: '#244d91', flexShrink: 1 },
  noPhone: { marginTop: 8, fontSize: 14, lineHeight: 21, color: '#52657b' },
});
```

### App.tsx

Экран, кнопка GET CONTACTS, FlatList, состояния и защита асинхронного чтения.

```tsx
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
```

### tests/contacts.test.ts

Исполняемые проверки логики с подставным API, без личных контактов.

```typescript
import assert from 'node:assert/strict';
import { test } from 'node:test';

import { ContactsLoadError, formatContact, loadContacts } from '../src/contacts.ts';
import type { ContactsApi, ContactsPage, ContactsPermission, PageQuery } from '../src/contacts.ts';

function makeApi(options: {
  available?: boolean;
  permission?: ContactsPermission;
  pages?: ContactsPage[];
} = {}) {
  const events: string[] = [];
  const queries: PageQuery[] = [];
  const api: ContactsApi = {
    async isAvailableAsync() {
      events.push('available');
      return options.available ?? true;
    },
    async requestPermissionsAsync() {
      events.push('permission');
      return options.permission ?? { status: 'granted', canAskAgain: true, accessPrivileges: 'all' };
    },
    async getContactsPageAsync(query) {
      events.push('page');
      queries.push(query);
      const page = options.pages?.[queries.length - 1];
      if (!page) {
        throw new Error('Unexpected page request.');
      }
      return page;
    },
  };
  return { api, events, queries };
}

function hasErrorCode(code: string) {
  return (error: unknown) => error instanceof ContactsLoadError && error.code === code;
}

test('an unavailable API never asks permission or reads contacts', async () => {
  const { api, events, queries } = makeApi({ available: false });
  assert.deepEqual(await loadContacts(api), { kind: 'unavailable' });
  assert.deepEqual(events, ['available']);
  assert.deepEqual(queries, []);
});

test('denied, undetermined and explicitly empty access never read the address book', async () => {
  const permissions: ContactsPermission[] = [
    { status: 'denied', canAskAgain: true },
    { status: 'denied', canAskAgain: false },
    { status: 'undetermined', canAskAgain: true },
    { status: 'granted', canAskAgain: false, accessPrivileges: 'none' },
  ];
  for (const permission of permissions) {
    const { api, events } = makeApi({ permission });
    assert.deepEqual(await loadContacts(api), {
      kind: 'permission-denied',
      canAskAgain: permission.canAskAgain,
    });
    assert.deepEqual(events, ['available', 'permission']);
  }
});

test('all pages, including a short final page, are read with actual offsets', async () => {
  const { api, events, queries } = makeApi({
    pages: [
      { data: [{ id: 'a', name: 'A' }, { id: 'b', name: 'B' }], hasNextPage: true },
      { data: [{ id: 'c', name: 'C' }], hasNextPage: true },
      { data: [{ id: 'd', name: 'D' }], hasNextPage: false },
    ],
  });
  const counts: number[] = [];
  const result = await loadContacts(api, { pageSize: 2, onProgress: (count) => counts.push(count) });
  assert.equal(result.kind, 'success');
  if (result.kind !== 'success') throw new Error('Expected success.');
  assert.deepEqual(result.contacts.map((contact) => contact.name), ['A', 'B', 'C', 'D']);
  assert.equal(result.limited, false);
  assert.deepEqual(queries, [
    { pageSize: 2, pageOffset: 0 },
    { pageSize: 2, pageOffset: 2 },
    { pageSize: 2, pageOffset: 3 },
  ]);
  assert.deepEqual(counts, [2, 3, 4]);
  assert.deepEqual(events, ['available', 'permission', 'page', 'page', 'page']);
});

test('every phone remains visible with number, digits and empty-field fallbacks', () => {
  const row = formatContact({
    name: '  Ada Lovelace  ',
    phoneNumbers: [
      { id: 'p', label: ' mobile ', number: ' +1 234 ' },
      { id: 'p', label: 'work', number: '+1 234' },
      { label: '', number: ' ', digits: '5678' },
      {},
    ],
  }, 'contact-id');
  assert.equal(row.name, 'Ada Lovelace');
  assert.deepEqual(row.phoneNumbers.map((phone) => [phone.label, phone.number]), [
    ['mobile', '+1 234'],
    ['work', '+1 234'],
    ['Телефон', '5678'],
    ['Телефон', 'Номер не указан'],
  ]);
  assert.equal(new Set(row.phoneNumbers.map((phone) => phone.id)).size, 4);
});

test('name falls back to parts, company and Без имени without losing empty contacts', async () => {
  assert.equal(formatContact({ name: ' ', firstName: ' Ada ', middleName: '', lastName: 'Lovelace' }, '1').name, 'Ada Lovelace');
  assert.equal(formatContact({ company: '  Library ' }, '2').name, 'Library');
  assert.equal(formatContact({}, '3').name, 'Без имени');
  const { api } = makeApi({ pages: [{ data: [{}, {}, { id: '0', name: '', phoneNumbers: [] }], hasNextPage: false }] });
  const result = await loadContacts(api);
  if (result.kind !== 'success') throw new Error('Expected success.');
  assert.equal(result.contacts.length, 3);
  assert.ok(result.contacts.every((contact) => contact.name === 'Без имени' && contact.phoneNumbers.length === 0));
  assert.equal(new Set(result.contacts.map((contact) => contact.id)).size, 3);
});

test('iOS limited permission succeeds and clearly marks the result as limited', async () => {
  const { api } = makeApi({
    permission: { status: 'granted', canAskAgain: true, accessPrivileges: 'limited' },
    pages: [{ data: [{ id: 'chosen', name: 'Chosen' }], hasNextPage: false }],
  });
  const result = await loadContacts(api);
  if (result.kind !== 'success') throw new Error('Expected success.');
  assert.equal(result.limited, true);
  assert.equal(result.contacts.length, 1);
});

test('an empty last page is a valid empty address book', async () => {
  const { api, queries } = makeApi({ pages: [{ data: [], hasNextPage: false }] });
  assert.deepEqual(await loadContacts(api), { kind: 'success', contacts: [], limited: false });
  assert.equal(queries.length, 1);
});

test('stable native IDs survive reloading and duplicate rows receive distinct keys', async () => {
  const pages = [{ data: [{ id: 'a' }, { id: 'a' }, { id: 'a:2' }, {}], hasNextPage: false }];
  const first = await loadContacts(makeApi({ pages }).api);
  const second = await loadContacts(makeApi({ pages }).api);
  if (first.kind !== 'success' || second.kind !== 'success') throw new Error('Expected success.');
  const ids = first.contacts.map((contact) => contact.id);
  assert.deepEqual(ids, second.contacts.map((contact) => contact.id));
  assert.equal(new Set(ids).size, 4);
});

test('native failures are classified without exposing their private messages', async () => {
  for (const stage of ['availability', 'permission', 'read'] as const) {
    const { api } = makeApi({ pages: [{ data: [], hasNextPage: false }] });
    const failure = async () => { throw new Error('Private contact: 555-9999'); };
    if (stage === 'availability') api.isAvailableAsync = failure;
    if (stage === 'permission') api.requestPermissionsAsync = failure;
    if (stage === 'read') api.getContactsPageAsync = failure;
    await assert.rejects(loadContacts(api), (error: unknown) => {
      assert.ok(error instanceof ContactsLoadError);
      assert.equal(error.code, stage);
      assert.ok(!error.message.includes('555-9999'));
      return true;
    });
  }
});

test('an empty page promising more records fails instead of looping', async () => {
  const { api, queries } = makeApi({ pages: [{ data: [], hasNextPage: true }] });
  await assert.rejects(loadContacts(api), hasErrorCode('pagination'));
  assert.equal(queries.length, 1);
});

test('repeated native pages fail when the provider ignores the offset', async () => {
  const { api, queries } = makeApi({
    pages: [
      { data: [{ id: 'a' }, { id: 'b' }], hasNextPage: true },
      { data: [{ id: 'a' }, { id: 'b' }], hasNextPage: true },
    ],
  });
  await assert.rejects(loadContacts(api), hasErrorCode('pagination'));
  assert.equal(queries.length, 2);
});

test('a bounded number of anonymous pages prevents an unidentifiable endless feed', async () => {
  const { api, queries } = makeApi({ pages: [
    { data: [{}], hasNextPage: true },
    { data: [{}], hasNextPage: true },
  ] });
  await assert.rejects(loadContacts(api, { maxPages: 2 }), hasErrorCode('pagination'));
  assert.equal(queries.length, 2);
});

test('cancellation while permission is pending prevents any contact reads', async () => {
  const { api, events } = makeApi({ pages: [{ data: [], hasNextPage: false }] });
  let cancelled = false;
  api.requestPermissionsAsync = async () => {
    events.push('permission');
    cancelled = true;
    return { status: 'granted', canAskAgain: true };
  };
  await assert.rejects(loadContacts(api, { isCancelled: () => cancelled }), hasErrorCode('cancelled'));
  assert.deepEqual(events, ['available', 'permission']);
});

test('cancellation after a page prevents the next page and discards the partial result', async () => {
  const { api, queries } = makeApi({ pages: [
    { data: [{ id: 'a' }], hasNextPage: true },
    { data: [{ id: 'b' }], hasNextPage: false },
  ] });
  let cancelled = false;
  await assert.rejects(loadContacts(api, {
    isCancelled: () => cancelled,
    onProgress: () => { cancelled = true; },
  }), hasErrorCode('cancelled'));
  assert.equal(queries.length, 1);
});

test('invalid paging configuration is rejected before any native call', async () => {
  const { api, events } = makeApi();
  await assert.rejects(loadContacts(api, { pageSize: 0 }), RangeError);
  await assert.rejects(loadContacts(api, { maxPages: Number.NaN }), RangeError);
  assert.deepEqual(events, []);
});
```

### .gitignore

Исключения для зависимостей, сборок и локальных файлов.

```text
node_modules/
.expo/
dist/
dist-android/
dist-ios/
*.log
.DS_Store
```
