import React from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { createDrawerNavigator } from "@react-navigation/drawer";
import { Ionicons } from "@expo/vector-icons";
import HomeScreen from "../screens/driver/HomeScreen";
import EarningsScreen from "../screens/driver/EarningsScreen";
import TripHistoryScreen from "../screens/driver/TripHistoryScreen";
import { useRegistration } from "../context/RegistrationContext";


const Drawer = createDrawerNavigator();

function PlaceholderScreen({title, subtitle, icon}){
    const { resetSession } = useRegistration();
    return(
    <View style={styles.center}>
      <Ionicons name={icon} size={52} color="#111827" />
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.subtitle}>{subtitle}</Text>
      {title === 'Perfil y configuración' && (
        <TouchableOpacity style={styles.logoutBtn} onPress={resetSession}>
          <Ionicons name="log-out-outline" size={18} color="#FFFFFF" />
          <Text style={styles.logoutText}>Cerrar sesión / Nuevo registro</Text>
        </TouchableOpacity>
      )}
    </View>

    );
}

export default function DriverDrawer() {
  return (
    <Drawer.Navigator
      screenOptions={{
        headerStyle: { backgroundColor: '#111827' },
        headerTintColor: '#FFFFFF',
        drawerActiveTintColor: '#111827',
        drawerInactiveTintColor: '#4B5563',
      }}
    >
      <Drawer.Screen
        name="DriverHome"
        component={HomeScreen}
        options={{
          title: 'Mapa',
          drawerIcon: ({ color, size }) => (
            <Ionicons name="map-outline" size={size} color={color} />
          ),
        }}
      />
      <Drawer.Screen
        name="Earnings"
        component={EarningsScreen}
        options={{
          title: 'Mis Ganancias',
          drawerIcon: ({ color, size }) => (
            <Ionicons name="cash-outline" size={size} color={color} />
          ),
        }}
      />
      <Drawer.Screen
        name="TripHistory"
        component={TripHistoryScreen}
        options={{
          title: 'Historial de carreras',
          drawerIcon: ({ color, size }) => (
            <Ionicons name="time-outline" size={size} color={color} />
          ),
        }}
      />
      <Drawer.Screen
        name="ProfileConfig"
        options={{
          title: 'Perfil y configuración',
          drawerIcon: ({ color, size }) => (
            <Ionicons name="settings-outline" size={size} color={color} />
          ),
        }}
      >
        {() => (
          <PlaceholderScreen
            title="Perfil y configuración"
            subtitle="Datos editables, vehículo y documentos."
            icon="person-circle-outline"
          />
        )}
      </Drawer.Screen>
    </Drawer.Navigator>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24, gap: 8 },
  title: { fontSize: 20, fontWeight: '700', color: '#111827' },
  subtitle: { fontSize: 14, color: '#6B7280', textAlign: 'center' },
  logoutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 20,
    backgroundColor: '#DC2626',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 8,
  },
  logoutText: { color: '#FFFFFF', fontWeight: '600' },
});