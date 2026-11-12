// AI-assisted: see docs/AI_LOG.md #6
import React from 'react';
import { ScrollView, View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRegistration } from '../../context/RegistrationContext';
import FormInput from '../../components/FormInput';
import ImagePickerField from '../../components/ImagePickerField';
import SelectField from '../../components/SelectField';

const CATEGORY_OPTIONS = [
  { label: 'Económico', value: 'economy' },
  { label: 'XL (Mínimo 6 pasajeros)', value: 'xl' },
  { label: 'Premium', value: 'premium' },
];

const COLOR_OPTIONS = [
  { label: 'Seleccionar color...', value: '' },
  { label: 'Blanco', value: 'Blanco' },
  { label: 'Negro', value: 'Negro' },
  { label: 'Gris / Plata', value: 'Gris' },
  { label: 'Rojo', value: 'Rojo' },
  { label: 'Azul', value: 'Azul' },
  { label: 'Otro', value: 'Otro' },
];

export default function VehicleTab({ navigation }) {
  const {
    vehicle,
    updateVehicleField,
    tab2Errors,
    touched,
    setTouched,
    isTab2Valid,
  } = useRegistration();

  const getError = (field) => (touched[`vehicle.${field}`] ? tab2Errors[field] : null);

  const handleNextTab = () => {
    setTouched((prev) => ({
      ...prev,
      'vehicle.category': true,
      'vehicle.plate': true,
      'vehicle.brand': true,
      'vehicle.model': true,
      'vehicle.year': true,
      'vehicle.color': true,
      'vehicle.capacity': true,
      'vehicle.photoUrl': true,
    }));

    if (isTab2Valid) {
      navigation.navigate('Documents');
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
      <View style={styles.headerBox}>
        <Ionicons name="car-sport-outline" size={28} color="#111827" />
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>Pestaña 2: Datos del vehículo</Text>
          <Text style={styles.subtitle}>Verifica que la placa sea visible en la fotografía.</Text>
        </View>
      </View>

      <SelectField
        label="Categoría del servicio"
        iconName="options-outline"
        selectedValue={vehicle.category}
        onValueChange={(val) => updateVehicleField('category', val)}
        options={CATEGORY_OPTIONS}
        error={getError('category')}
      />

      <FormInput
        label="Placa (Formato colombiano ABC123)"
        iconName="pricetag-outline"
        value={vehicle.plate}
        onChangeText={(val) => updateVehicleField('plate', val.toUpperCase())}
        placeholder="Ej. ABC123"
        maxLength={6}
        autoCapitalize="characters"
        error={getError('plate')}
      />

      <FormInput
        label="Marca"
        iconName="construct-outline"
        value={vehicle.brand}
        onChangeText={(val) => updateVehicleField('brand', val)}
        placeholder="Ej. Renault, Chevrolet, Mazda"
        maxLength={30}
        error={getError('brand')}
      />

      <FormInput
        label="Modelo / Línea"
        iconName="car-outline"
        value={vehicle.model}
        onChangeText={(val) => updateVehicleField('model', val)}
        placeholder="Ej. Logan, Onix, CX-30"
        maxLength={30}
        error={getError('model')}
      />

      <FormInput
        label="Año del vehículo"
        iconName="calendar-number-outline"
        value={String(vehicle.year)}
        onChangeText={(val) => updateVehicleField('year', val.replace(/[^0-9]/g, ''))}
        placeholder="Ej. 2023"
        keyboardType="numeric"
        maxLength={4}
        error={getError('year')}
      />

      <SelectField
        label="Color"
        iconName="color-palette-outline"
        selectedValue={vehicle.color}
        onValueChange={(val) => updateVehicleField('color', val)}
        options={COLOR_OPTIONS}
        error={getError('color')}
      />

      <FormInput
        label={
          vehicle.category === 'xl'
            ? 'Capacidad de pasajeros (Mínimo 6 para XL)'
            : 'Capacidad de pasajeros'
        }
        iconName="people-outline"
        value={String(vehicle.capacity)}
        onChangeText={(val) => updateVehicleField('capacity', val.replace(/[^0-9]/g, ''))}
        placeholder={vehicle.category === 'xl' ? 'Ej. 6' : 'Ej. 4'}
        keyboardType="numeric"
        maxLength={2}
        error={getError('capacity')}
      />

      <ImagePickerField
        label="Foto del vehículo (placa visible)"
        value={vehicle.photoUrl}
        onChange={(uri) => updateVehicleField('photoUrl', uri)}
        error={getError('photoUrl')}
      />

      <TouchableOpacity style={styles.nextButton} onPress={handleNextTab}>
        <Text style={styles.nextButtonText}>Continuar a Documentos</Text>
        <Ionicons name="arrow-forward-outline" size={20} color="#FFFFFF" />
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16, paddingBottom: 40, backgroundColor: '#F3F4F6' },
  headerBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#FFFFFF',
    padding: 14,
    borderRadius: 10,
    marginBottom: 16,
  },
  title: { fontSize: 16, fontWeight: '700', color: '#111827' },
  subtitle: { fontSize: 12, color: '#6B7280' },
  nextButton: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#111827',
    paddingVertical: 14,
    borderRadius: 8,
    marginTop: 10,
  },
  nextButtonText: { color: '#FFFFFF', fontSize: 15, fontWeight: '600' },
});