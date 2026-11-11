import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';

/** Root navigator. HR navigation (auth, roles, tabs) will be defined here when features are built. */
export default function RootLayout() {
  return (
    <>
      <Stack screenOptions={{ headerShown: false }} />
      <StatusBar style="auto" />
    </>
  );
}
