// AI-assisted: see docs/AI_LOG.md #5

import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { Picker } from '@react-native-picker/picker';
import { Ionicons } from "@expo/vector-icons";

export default function SelectField({label, iconName, selectedValue, onValueChange, options, error}){
    return(
        <View style={styles.container}>
            <Text style={styles.label}>{label}*</Text>
            <View style={[styles.pickerWrapper, error && styles.pickerWrapperError]}>

                {iconName && (
                    <Ionicons name={iconName} size={20} color={error ? '#DC2626' : '#6B7280'} style={styles.icon} />)}
                <Picker selectedValue={selectedValue} onValueChange={onValueChange} style={styles.picker}>
                    {options.map((opt) => (
                        <Picker.Item key={opt.value} label={opt.label} value={opt.value} />
                    ))}
                </Picker>

            </View>

            {error && (
                <View style={styles.errorRow}>
                    <Ionicons name="alert-circle-outline" size={15} color='#DC2626' />
                    <Text style={styles.errorText}>{error}</Text>
                </View>
            )}
        </View>
    );
}

const styles = StyleSheet.create({
  container: { marginBottom: 14 },
  label: { fontSize: 14, fontWeight: '600', marginBottom: 6, color: '#1F2937' },
  pickerWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 8,
    backgroundColor: '#FFFFFF',
    paddingLeft: 12,
    height: 52,
    overflow: 'hidden',
  },
  pickerWrapperError: { borderColor: '#DC2626', backgroundColor: '#FEF2F2' },
  icon: { marginRight: 4 },
  picker: { flex: 1, color: '#111827' },
  errorRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 },
  errorText: { color: '#DC2626', fontSize: 12 },
});