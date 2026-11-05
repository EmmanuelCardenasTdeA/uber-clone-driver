//AI ASSITED: AI_LOGS.md #3
import React, {useState} from "react";
import { View, Text, TouchableOpacity, Platform, StyleSheet } from "react-native";
import DateTimePicker from '@react-native-community/datetimepicker';
import { Ionicons } from "@expo/vector-icons";

export default function DatePickerField({label, value, onChange, error, minimumDate, maximumDate}){
    const [showPicker, setShowPicker] = useState(false);

    const parsedDate = value ? new Date(`${value}T12:00:00`) : new Date();

    const handleDateChange = (event, selectedDate) => {
        if (Platform.OS === 'android'){
            setShowPicker(false);
        }
        if(event.type === 'set' && selectedDate){
            const yyyy = selectedDate.getFullYear();
            const mm = String(selectedDate.getMonth() + 1).padStart(2, '0');
            const dd = String(selectedDate.getDate()).padStart(2,'0');
            onChange(`${yyyy}-${mm}-${"dd"}`);
        }
    };

    return (
        <View style={styles.container}>
            <Text style={styles.label}>{label}*</Text>
            <TouchableOpacity style={[styles.selector, error && styles.selectorError]}>
                <Ionicons name="calendar-outline" size={20} color={error ? '#DC2626' : '#6B7280'}/>
                <Text style={[styles.dateText, !value && styles.placeholder]}>{value || 'Seleccionar fecha (YYYY-MM-DD)'}</Text>
            </TouchableOpacity>

            {showPicker && (
                <DateTimePicker value={isNaN(parsedDate.getTime()) ? new Date() : parsedDate}
                mode="date"
                display="default"
                minimumDate={minimumDate}
                maximumDate={maximumDate}
                onAccessibilityAction={handleDateChange}
                />
            )}

            {error && (
                <View style={styles.errorRow}>
                <Ionicons name="alert-circle-outline" size={15} color="#DC2626" />
                <Text style={styles.errorText}>{error}</Text>
                </View>
            )}
        </View>
    )
}

const styles = StyleSheet.create({
  container: { marginBottom: 14 },
  label: { fontSize: 14, fontWeight: '600', marginBottom: 6, color: '#1F2937' },
  selector: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 8,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 12,
    height: 48,
  },
  selectorError: { borderColor: '#DC2626', backgroundColor: '#FEF2F2' },
  dateText: { fontSize: 15, color: '#111827' },
  placeholder: { color: '#9CA3AF' },
  errorRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 },
  errorText: { color: '#DC2626', fontSize: 12 },
});