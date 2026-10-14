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
