// AI-assisted: see docs/AI_LOG.md #6
import React from 'react';
import {
  ScrollView,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Checkbox from 'expo-checkbox';
import { Ionicons } from '@expo/vector-icons';
import { useRegistration } from '../../context/RegistrationContext';
import { PRICING_CONFIG } from '../../config/pricing';
import FormInput from '../../components/FormInput';
import ImagePickerField from '../../components/ImagePickerField';
import DatePickerField from '../../components/DatePickerField';

export default function DocumentsTab() {
  const insets = useSafeAreaInsets();
  const {
    personalData,
    vehicle,
    documents,
    updateDocumentsField,
    tab3Errors,
    touched,
    isTab1Valid,
    isTab2Valid,
    isTab3Valid,
    tecnoApplies,
    canSubmitRegistration,
    submitting,
    submitError,
    submitRegistration,
  } = useRegistration();

  const getError = (field) => (touched[`documents.${field}`] ? tab3Errors[field] : null);
  const commissionPercentage = Math.round(PRICING_CONFIG.COMMISSION_RATE * 100);

  // Fecha mínima seleccionable: mañana
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: '#F3F4F6' }}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 80}
    >
      <ScrollView
        contentContainerStyle={[
          styles.container,
          { paddingBottom: Math.max(insets.bottom + 28, 44) },
        ]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
      <View style={styles.headerBox}>
        <Ionicons name="document-text-outline" size={28} color="#111827" />
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>Pestaña 3: Documentos y pagos</Text>
          <Text style={styles.subtitle}>
            Vigencias posteriores a hoy. Sin cuentas bancarias ni tarjetas.
          </Text>
        </View>
      </View>

      {/* Resumen de estado de las 3 pestañas */}
      <View style={styles.statusRow}>
        <View style={[styles.badge, isTab1Valid ? styles.badgeOk : styles.badgePending]}>
          <Ionicons
            name={isTab1Valid ? 'checkmark-circle' : 'time-outline'}
            size={16}
            color={isTab1Valid ? '#16A34A' : '#D97706'}
          />
          <Text style={styles.badgeText}>1. Personal</Text>
        </View>
        <View style={[styles.badge, isTab2Valid ? styles.badgeOk : styles.badgePending]}>
          <Ionicons
            name={isTab2Valid ? 'checkmark-circle' : 'time-outline'}
            size={16}
            color={isTab2Valid ? '#16A34A' : '#D97706'}
          />
          <Text style={styles.badgeText}>2. Vehículo</Text>
        </View>
        <View style={[styles.badge, isTab3Valid ? styles.badgeOk : styles.badgePending]}>
          <Ionicons
            name={isTab3Valid ? 'checkmark-circle' : 'time-outline'}
            size={16}
            color={isTab3Valid ? '#16A34A' : '#D97706'}
          />
          <Text style={styles.badgeText}>3. Documentos</Text>
        </View>
      </View>

      {/* Sección Licencia de Conducción */}
      <Text style={styles.sectionHeader}>Licencia de conducción</Text>
      <FormInput
        label="Número de licencia"
        iconName="id-card-outline"
        value={personalData.documentId || documents.licenseNumber}
        onChangeText={(val) => updateDocumentsField('licenseNumber', val.replace(/[^0-9]/g, ''))}
        placeholder="Se completa con tu documento de la Pestaña 1"
        keyboardType="numeric"
        maxLength={10}
        editable={false}
        error={getError('licenseNumber')}
      />
      <ImagePickerField
        label="Foto de la licencia de conducción"
        value={documents.licensePhotoUrl}
        onChange={(uri) => updateDocumentsField('licensePhotoUrl', uri)}
        error={getError('licensePhotoUrl')}
      />
      <DatePickerField
        label="Fecha de vencimiento de la licencia"
        value={documents.licenseExpiration}
        onChange={(dateStr) => updateDocumentsField('licenseExpiration', dateStr)}
        minimumDate={tomorrow}
        error={getError('licenseExpiration')}
      />

      {/* Sección SOAT */}
      <Text style={styles.sectionHeader}>SOAT vigente</Text>
      <ImagePickerField
        label="Foto del SOAT"
        value={documents.soatPhotoUrl}
        onChange={(uri) => updateDocumentsField('soatPhotoUrl', uri)}
        error={getError('soatPhotoUrl')}
      />
      <DatePickerField
        label="Fecha de vencimiento del SOAT"
        value={documents.soatExpiration}
        onChange={(dateStr) => updateDocumentsField('soatExpiration', dateStr)}
        minimumDate={tomorrow}
        error={getError('soatExpiration')}
      />

      {/* Sección Revision Tecno*/}
      <Text style={styles.sectionHeader}>Revisión Técnico-Mecánica</Text>
      {tecnoApplies ? (
        <>
          <ImagePickerField
            label={`Foto Técnico-Mecánica (Vehículo modelo ${vehicle.year})`}
            value={documents.tecnoPhotoUrl}
            onChange={(uri) => updateDocumentsField('tecnoPhotoUrl', uri)}
            error={getError('tecnoPhotoUrl')}
          />
          <DatePickerField
            label="Fecha de vencimiento Técnico-Mecánica"
            value={documents.tecnoExpiration}
            onChange={(dateStr) => updateDocumentsField('tecnoExpiration', dateStr)}
            minimumDate={tomorrow}
            error={getError('tecnoExpiration')}
          />
        </>
      ) : (
        <View style={styles.infoBanner}>
          <Ionicons name="information-circle-outline" size={20} color="#2563EB" />
          <Text style={styles.infoBannerText}>
            {vehicle.year
              ? `El vehículo modelo ${vehicle.year} aún está exento de Revisión Técnico-Mecánica.`
              : 'Ingresa el año del vehículo en la Pestaña 2 para verificar si aplica.'}
          </Text>
        </View>
      )}

      {/* Seccion Mercado Pago */}
      <Text style={styles.sectionHeader}>Cuenta de pagos (Mercado Pago)</Text>
      <FormInput
        label="Correo de la cuenta de Mercado Pago"
        iconName="wallet-outline"
        value={documents.mercadoPagoEmail}
        onChangeText={(val) => updateDocumentsField('mercadoPagoEmail', val)}
        placeholder="pagos.conductor@correo.com"
        keyboardType="email-address"
        autoCapitalize="none"
        error={getError('mercadoPagoEmail')}
      />

      {/* Checkbox de Términos y Comisión del 20% */}
      <View style={styles.termsContainer}>
        <View style={styles.checkboxRow}>
          <Checkbox
            value={documents.termsAccepted}
            onValueChange={(val) => updateDocumentsField('termsAccepted', val)}
            color={documents.termsAccepted ? '#111827' : undefined}
          />
          <Text style={styles.termsText}>
            Acepto los términos y condiciones del servicio y autorizo la comisión de plataforma del{' '}
            <Text style={{ fontWeight: '700' }}>{commissionPercentage}%</Text> sobre cada viaje. *
          </Text>
        </View>
        {getError('termsAccepted') && (
          <View style={styles.errorRow}>
            <Ionicons name="alert-circle-outline" size={15} color="#DC2626" />
            <Text style={styles.errorText}>{getError('termsAccepted')}</Text>
          </View>
        )}
      </View>

      {/* Error de subida o red debajo del formulario*/}
      {submitError && (
        <View style={styles.submitErrorBox}>
          <Ionicons name="warning-outline" size={18} color="#DC2626" />
          <Text style={styles.submitErrorText}>{submitError}</Text>
        </View>
      )}

      {/* Botón Enviar registro deshabilitado hasta que Pestañas 1, 2 y 3 sean 100% válidas */}
      <TouchableOpacity
        style={[
          styles.submitButton,
          !canSubmitRegistration && styles.submitButtonDisabled,
        ]}
        disabled={!canSubmitRegistration}
        onPress={submitRegistration}
      >
        {submitting ? (
          <>
            <ActivityIndicator size="small" color="#FFFFFF" />
            <Text style={styles.submitButtonText}>Subiendo fotos y registrando...</Text>
          </>
        ) : (
          <>
            <Ionicons name="cloud-done-outline" size={20} color="#FFFFFF" />
            <Text style={styles.submitButtonText}>Enviar registro</Text>
          </>
        )}
      </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
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
    marginBottom: 12,
  },
  title: { fontSize: 16, fontWeight: '700', color: '#111827' },
  subtitle: { fontSize: 12, color: '#6B7280' },
  statusRow: { flexDirection: 'row', gap: 8, marginBottom: 16 },
  badge: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
  },
  badgeOk: { backgroundColor: '#DCFCE7', borderColor: '#86EFAC' },
  badgePending: { backgroundColor: '#FEF3C7', borderColor: '#FDE68A' },
  badgeText: { fontSize: 12, fontWeight: '600', color: '#1F2937' },
  sectionHeader: {
    fontSize: 15,
    fontWeight: '700',
    color: '#111827',
    marginTop: 8,
    marginBottom: 10,
  },
  infoBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#EFF6FF',
    borderColor: '#BFDBFE',
    borderWidth: 1,
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
  },
  infoBannerText: { flex: 1, fontSize: 13, color: '#1E40AF' },
  termsContainer: {
    backgroundColor: '#FFFFFF',
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#D1D5DB',
    marginBottom: 16,
  },
  checkboxRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  termsText: { flex: 1, fontSize: 13, color: '#1F2937', lineHeight: 18 },
  errorRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 6 },
  errorText: { color: '#DC2626', fontSize: 12 },
  submitErrorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#FEF2F2',
    borderColor: '#FECACA',
    borderWidth: 1,
    padding: 12,
    borderRadius: 8,
    marginBottom: 14,
  },
  submitErrorText: { flex: 1, color: '#DC2626', fontSize: 13 },
  submitButton: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#16A34A',
    paddingVertical: 15,
    borderRadius: 8,
  },
  submitButtonDisabled: { backgroundColor: '#9CA3AF' },
  submitButtonText: { color: '#FFFFFF', fontSize: 16, fontWeight: '700' },
});