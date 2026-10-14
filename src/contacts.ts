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
