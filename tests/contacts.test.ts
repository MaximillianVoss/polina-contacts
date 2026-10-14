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
