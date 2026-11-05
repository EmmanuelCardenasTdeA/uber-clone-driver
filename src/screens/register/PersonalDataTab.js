// AI-assisted: see docs/AI_LOG.md #5
import React from "react";
import { ScrollView, View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRegistration } from "../../context/RegistrationContext";
import FormInput from "../../components/FormInput";
import ImagePickerField from "../../components/ImagePickerField";
import DatePickerField from "../../components/DatePickerField";
import SelectField from "../../components/SelectField";

const GENDER_OPTIONS = [
  { label: 'Seleccionar género...', value: '' },
  { label: 'Masculino', value: 'M' },
  { label: 'Femenino', value: 'F' },
  { label: 'Otro / Prefiero no decir', value: 'O' },
];

const LANGUAGE_OPTIONS = [
  { label: 'Español (ES)', value: 'es' },
  { label: 'English (EN)', value: 'en' },
];

export default function PersonalDataTab({navigation}){
    const {
        personalData,
        updatePersonalField,
        tab1Errors,
        touched,
        setTouched,
        isTab1Valid
    } = useRegistration();

    const getError = (field) => (touched[`personal.${field}`] ? tab1Errors[field] : null) 

    //marcar los  campos para verificar si estan correctos
    const handleNextTab = () => {
        setTouched((prev) => ({
            ...prev,
            'personal.profilePhotoUrl': true,
            'personal.fullName': true,
            'personal.documentId': true,
            'personal.phone': true,
            'personal.birthDate': true,
            'personal.gender': true,
            'personal.email': true,
            'personal.language': true,
        }));

        if(isTab1Valid){
            navigation.navigate('Vehicle')
        }
    };
    return (
        <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
            <View style={styles.headerBox}>
                <Ionicons name="person-circle-outline" size={28} color="#111827" />
                <View style={{ flex: 1 }}>
                <Text style={styles.title}>Pestaña 1: Datos personales</Text>
                <Text style={styles.subtitle}>Todos los campos son obligatorios para continuar.</Text>
                </View>
            </View>

            <ImagePickerField
                label="Foto de perfil"
                value={personalData.profilePhotoUrl}
                onChange={(uri) => updatePersonalField('profilePhotoUrl', uri)}
                error={getError('profilePhotoUrl')}
            />
            <FormInput
                label="Nombre completo"
                iconName="person-outline"
                value={personalData.fullName}
                onChangeText={(val) => updatePersonalField('fullName', val)}
                placeholder="Ej. Carlos Andrés Gómez"
                maxLength={50}
                error={getError('fullName')}
            />

            <FormInput
                label="Documento de identidad"
                iconName="card-outline"
                value={personalData.documentId}
                onChangeText={(val) => updatePersonalField('documentId', val.replace(/[^0-9]/g, ''))}
                placeholder="6 a 10 dígitos numéricos"
                keyboardType="numeric"
                maxLength={10}
                error={getError('documentId')}
            />

            <FormInput
                label="Número de celular"
                iconName="call-outline"
                value={personalData.phone}
                onChangeText={(val) => updatePersonalField('phone', val.replace(/[^0-9]/g, ''))}
                placeholder="Ej. 3001234567 (10 dígitos)"
                keyboardType="phone-pad"
                maxLength={10}
                error={getError('phone')}
            />

            <DatePickerField
                label="Fecha de nacimiento (Mayor de 18 años)"
                value={personalData.birthDate}
                onChange={(dateStr) => updatePersonalField('birthDate', dateStr)}
                maximumDate={new Date()}
                error={getError('birthDate')}
            />

            <SelectField
                label="Género"
                iconName="male-female-outline"
                selectedValue={personalData.gender}
                onValueChange={(val) => updatePersonalField('gender', val)}
                options={GENDER_OPTIONS}
                error={getError('gender')}
            />

            <FormInput
                label="Correo electrónico"
                iconName="mail-outline"
                value={personalData.email}
                onChangeText={(val) => updatePersonalField('email', val)}
                placeholder="conductor@dominio.com"
                keyboardType="email-address"
                autoCapitalize="none"
                error={getError('email')}
            />

            <SelectField
                label="Idioma de la aplicación"
                iconName="language-outline"
                selectedValue={personalData.language}
                onValueChange={(val) => updatePersonalField('language', val)}
                options={LANGUAGE_OPTIONS}
                error={getError('language')}
            />

            <TouchableOpacity style={styles.nextButton} onPress={handleNextTab}>
                <Text style={styles.nextButtonText}>Continuar a Vehículo</Text>
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