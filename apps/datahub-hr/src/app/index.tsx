import { getMessages } from '@datahub/shared-i18n';
import { getLocales } from 'expo-localization';
import { StyleSheet, Text, View } from 'react-native';

/**
 * Entry route. Intentionally minimal until DataHubHR features are designed; it also verifies that
 * the shared packages resolve inside the mobile bundle.
 */
export default function Index() {
  const locale = getLocales()[0]?.languageCode === 'ar' ? 'ar' : 'en';
  const messages = getMessages(locale);

  return (
    <View style={styles.container}>
      <Text style={styles.title}>DataHubHR</Text>
      <Text style={styles.subtitle}>{messages.organization.name}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#fff' },
  title: { fontSize: 24, fontWeight: '600' },
  subtitle: { marginTop: 8, fontSize: 15, color: '#696969' },
});
