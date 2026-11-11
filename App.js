// AI-assisted: see docs/AI_LOG.md #6
import 'react-native-gesture-handler';
import React from 'react';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { NavigationContainer } from '@react-navigation/native';
import { RegistrationProvider, useRegistration } from './src/context/RegistrationContext';
import RegistrationTabs from './src/navigation/RegistrationTabs';
import AccountStatusScreen from './src/screens/register/AccountStatusScreen';
import DriverDrawer from './src/navigation/DriverDrawer';

function RootNavigator() {
  const { driverProfile } = useRegistration();

  // 1. Si no ha enviado el registro, mostrar las 3 pestañas
  if (!driverProfile) {
    return <RegistrationTabs />;
  }

  // 2. Si envió el registro pero sigue 'pending_approval' en Firebase, bloquear acceso
  if (driverProfile.accountStatus !== 'approved') {
    return <AccountStatusScreen />;
  }

  // 3. Si fue autorizado ('approved') en Firebase, mostrar el Drawer con el Mapa de Inicio
  return <DriverDrawer />;
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