// AI-assisted: see docs/AI_LOG.md #6
import React from 'react';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { NavigationContainer } from '@react-navigation/native';
import { RegistrationProvider, useRegistration } from './src/context/RegistrationContext';
import RegistrationTabs from './src/navigation/RegistrationTabs';
import AccountStatusScreen from './src/screens/register/AccountStatusScreen';

function RootNavigator() {
  const { driverProfile } = useRegistration();

  // Si ya envió el registro y existe el documento en Firestore, mostrar pantalla de estado
  if (driverProfile) {
    return <AccountStatusScreen />;
  }

  // De lo contrario, mostrar el flujo de 3 pestañas de registro
  return <RegistrationTabs />;
}

export default function App() {
  return (
    <SafeAreaProvider>
      <RegistrationProvider>
        <NavigationContainer>
          <StatusBar style="light" />
          <RootNavigator />
        </NavigationContainer>
      </RegistrationProvider>
    </SafeAreaProvider>
  );
}