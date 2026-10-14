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
