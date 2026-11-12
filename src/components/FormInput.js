// AI-assisted: see docs/AI_LOG.md #3
import React from 'react';
import { View, Text, TextInput, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

export default function FormInput({
    label, iconName, value, onChangeText, placeholder, error, keyboardType = 'default',
    maxLength,
    autoCapitalize = 'sentences',
    editable = true,
}){
    return(
        <View style={styles.container}>
            <Text style={styles.label}>{label} *</Text>
            <View
                style={[
                    styles.inputWrapper,
                    !editable && styles.inputWrapperDisabled,
                    error && styles.inputWrapperError,
                ]}
            >
                {iconName && (
                    <Ionicons name={iconName} size={20} color={error ? '#DC2626' : '#6B7280'} style={styles.icon}/>
                )}
                <TextInput 
                    style={[styles.input, !editable && styles.inputDisabled]}
                    value={value}
                    onChangeText={onChangeText}
                    placeholder={placeholder}
                    placeholderTextColor='#9CA3AF'
                    keyboardType={keyboardType}
                    maxLength={maxLength}
                    autoCapitalize={autoCapitalize}
                    editable={editable}
                />
            </View>
            {error && (
                <View style={styles.errorRow}>
                    <Ionicons name='alert-circle-outline' size={15} color='#DC2626'/>
                    <Text style={styles.errorText}>{error}</Text>
                </View>
            )}
        </View>
    )
}

const styles = StyleSheet.create({
  container: { marginBottom: 14 },
  label: { fontSize: 14, fontWeight: '600', marginBottom: 6, color: '#1F2937' },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 8,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 12,
    height: 48,
  },
  inputWrapperError: { borderColor: '#DC2626', backgroundColor: '#FEF2F2' },
  inputWrapperDisabled: { backgroundColor: '#E5E7EB', borderColor: '#D1D5DB' },
  icon: { marginRight: 8 },
  input: { flex: 1, fontSize: 15, color: '#111827' },
  inputDisabled: { color: '#4B5563' },
  errorRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 },
  errorText: { color: '#DC2626', fontSize: 12 },
});