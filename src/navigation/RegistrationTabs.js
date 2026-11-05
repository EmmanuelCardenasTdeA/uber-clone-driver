// AI-assisted: see docs/AI_LOG.md #4
import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import PersonalDataTab from '../screens/register/PersonalDataTab';
import VehicleTab from '../screens/register/VehicleTab';
import DocumentsTab from '../screens/register/DocumentsTab';
import { useRegistration } from '../context/RegistrationContext';

const Tab = createBottomTabNavigator();

export default function RegistrationTabs() {
  const { isTab1Valid, isTab2Valid, isTab3Valid } = useRegistration();

  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerStyle: { backgroundColor: '#111827' },
        headerTintColor: '#FFFFFF',
        tabBarActiveTintColor: '#111827',
        tabBarInactiveTintColor: '#6B7280',
        tabBarStyle: { height: 62, paddingBottom: 8, paddingTop: 6 },
        tabBarIcon: ({ focused, color, size }) => {
          let iconName;

          if (route.name === 'PersonalData') {
            iconName = focused ? 'person' : 'person-outline';
          } else if (route.name === 'Vehicle') {
            iconName = focused ? 'car-sport' : 'car-sport-outline';
          } else if (route.name === 'Documents') {
            iconName = focused ? 'document-text' : 'document-text-outline';
          }

          return <Ionicons name={iconName} size={size} color={color} />;
        },
      })}
    >
      <Tab.Screen
        name="PersonalData"
        component={PersonalDataTab}
        options={{
          title: 'Datos personales',
          tabBarBadgeStyle: { backgroundColor: '#16A34A', color: '#FFF', fontSize: 10 },
        }}
      />
      <Tab.Screen
        name="Vehicle"
        component={VehicleTab}
        options={{
          title: 'Vehículo',
          tabBarBadgeStyle: { backgroundColor: '#16A34A', color: '#FFF', fontSize: 10 },
        }}
      />
      <Tab.Screen
        name="Documents"
        component={DocumentsTab}
        options={{
          title: 'Documentos',
          tabBarBadgeStyle: { backgroundColor: '#16A34A', color: '#FFF', fontSize: 10 },
        }}
      />
    </Tab.Navigator>
  );
}