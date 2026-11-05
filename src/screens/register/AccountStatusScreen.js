// AI-assisted: see docs/AI_LOG.md #6
import React, { useState } from 'react';
import { View, Text, Switch, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '../../config/firebase';
import { useRegistration } from '../../context/RegistrationContext';

export default function accountStatusScreen(){
    const {driverId, driverProfile} = useRegistration();
    const [updatingSwitch, setUpdatingSwitch] = useState(false);

    const isApproved = driverProfile?.accountStatus === 'approved'; 
    const isAvailable = Boolean(driverProfile?.isAvailable);

    const toggleAvailability = async (nextValue) => {
        if(!isApproved || !driverId || updatingSwitch) return;

        try{

            setUpdatingSwitch(true);
            await updateDoc(doc(db, 'drivers', driverId),{
                isApproved: nextValue
            });

        }finally{

            setUpdatingSwitch(false);

        }
    };
    return (
        <View style={styles.container}>
            <View style={styles.card}>
                <Ionicons
                name={isApproved ? 'checkmark-done-circle' : 'hourglass-outline'}
                size={64}
                color={isApproved ? '#16A34A' : '#D97706'}
                />

                <Text style={styles.title}>
                {isApproved ? 'Cuenta Aprobada' : 'Pendiente de aprobación'}
                </Text>

                <Text style={styles.description}>
                {isApproved
                    ? 'Tu documentación ha sido verificada. Ya puedes cambiar tu estado a Disponible.'
                    : 'Hemos recibido tu registro. No puedes ponerte Disponible hasta que el estado cambie a "approved" en Firestore.'}
                </Text>

                <View style={styles.infoRow}>
                    <Text style={styles.infoLabel}>Conductor:</Text>
                    <Text style={styles.infoValue}>{driverProfile?.personalData?.fullName}</Text>
                </View>
                <View style={styles.infoRow}>
                    <Text style={styles.infoLabel}>Vehículo:</Text>
                    <Text style={styles.infoValue}>
                        {driverProfile?.vehicle?.brand} {driverProfile?.vehicle?.model} ({driverProfile?.vehicle?.plate})
                    </Text>
                </View>

                <View style={styles.switchBox}>
                    <Text style={styles.switchLabel}>
                        Estado: {isAvailable ? 'Disponible' : 'No disponible'}
                    </Text>
                    <Switch
                        value={isAvailable}
                        onValueChange={toggleAvailability}
                        disabled={!isApproved || updatingSwitch}
                    />
                </View>
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    backgroundColor: '#F3F4F6',
  },
  card: {
    width: '100%',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 24,
    alignItems: 'center',
    elevation: 2,
  },
  title: { fontSize: 20, fontWeight: '700', color: '#111827', marginTop: 12, marginBottom: 8 },
  description: { fontSize: 14, color: '#4B5563', textAlign: 'center', marginBottom: 20 },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  infoLabel: { fontSize: 13, color: '#6B7280' },
  infoValue: { fontSize: 13, fontWeight: '600', color: '#111827' },
  switchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
    marginTop: 20,
    padding: 12,
    backgroundColor: '#F9FAFB',
    borderRadius: 8,
  },
  switchLabel: { fontSize: 15, fontWeight: '600', color: '#111827' },
});