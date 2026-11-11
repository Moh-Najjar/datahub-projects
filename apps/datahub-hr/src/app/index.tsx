import { StyleSheet, Text, View } from 'react-native';
import { getDeviceLocale } from '@/i18n/locales';
import { getMessages } from '@/i18n/messages';

/**
 * Entry route. Intentionally minimal until DataHubHR features are designed.
 */
export default function Index() {
  const messages = getMessages(getDeviceLocale());

  return (
    <View style={styles.container}>
      <Text style={styles.title}>DataHubHR</Text>
      <Text style={styles.subtitle}>{messages.organizationName}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#fff' },
  title: { fontSize: 24, fontWeight: '600' },
  subtitle: { marginTop: 8, fontSize: 15, color: '#696969' },
});
