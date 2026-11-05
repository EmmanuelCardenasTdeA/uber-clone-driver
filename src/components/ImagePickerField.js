//AI ASSITED: AI_LOGS.md #3
import React, { useState } from "react";
import { View, Text, TouchableOpacity, Image, StyleSheet, ActivityIndicator } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';

export default function ImagePickerField({ label, value, onChange, error}){
    const [permissionError, setPermissionError] = useState(null);
    const [loading, setLoading] = useState(false);

    const handlePickImage = async (useCamera = false) => {
        setPermissionError(null);
        try {
            setLoading(true);
            const permissionResult = useCamera 
            ? await ImagePicker.requestCameraPermissionsAsync() 
            : await ImagePicker.requestMediaLibraryPermissionsAsync();

            if (!permissionResult.granted){
                setPermissionError(
                    useCamera
                    ? 'Debes otorgar permiso de cámara para la foto'
                    : 'Debes otorgar permiso de galería para seleccionar la foto'
                );
                return
            };

            const result = useCamera
            ? await ImagePicker.launchCameraAsync({
                mediaTypes: ['images'],
                allowsEditing: true,
                quality: 0.7,
            })
            : await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ['images'],
            allowsEditing: true,
            quality: 0.7,
            });

            if(!result.canceled && result.assets && result.assets.length > 0 ){
                onChange(result.assets[0].uri);
            }
        } catch(err){
            setPermissionError('No fue posible cargar la imagen');
        } finally{
            setLoading(false);
        }
    };
    
    return (
        <View style={styles.container}>
            <Text style={styles.label}>*</Text>
            {value ? (
                <View style ={styles.previewWrapper}>
                    <Image source={{uri:value}} style={styles.preview}/>
                    <View style={styles.checkBadge}>
                        <Ionicons name="checkmark-circle" size={22} color="#16A34A"/>
                    </View>
                </View>
            ) : (
                <View style={[styles.placeholder, error && styles.placeholderError]}>
                    <Ionicons name="cloud-upload-outline" size={34} color={error ? '#DC2626' : '#9CA3AF'}/>
                    <Text style={styles.placeholderText}>Sin imagen seleccionada</Text>
                </View>
            )}
            {loading ? (
            <ActivityIndicator size="small" color="#111827" style={{ marginVertical: 8 }} />
            ) : (
            <View style={styles.buttonRow}>
            <TouchableOpacity style={styles.button} onPress={() => handlePickImage(true)}>
                <Ionicons name="camera-outline" size={18} color="#FFFFFF" />
                <Text style={styles.buttonText}>Cámara</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.button} onPress={() => handlePickImage(false)}>
                <Ionicons name="images-outline" size={18} color="#FFFFFF" />
                <Text style={styles.buttonText}>Galería</Text>
            </TouchableOpacity>
            </View>
        )}

        {(error || permissionError) && (
            <View style={styles.errorRow}>
            <Ionicons name="alert-circle-outline" size={15} color="#DC2626" />
            <Text style={styles.errorText}>{error || permissionError}</Text>
            </View>
        )}
        </View>
    )
}

const styles = StyleSheet.create({
  container: { marginBottom: 16 },
  label: { fontSize: 14, fontWeight: '600', marginBottom: 6, color: '#1F2937' },
  previewWrapper: { position: 'relative', marginBottom: 8 },
  preview: { width: '100%', height: 160, borderRadius: 8, resizeMode: 'cover' },
  checkBadge: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 2,
  },
  placeholder: {
    width: '100%',
    height: 120,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderStyle: 'dashed',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
    backgroundColor: '#F9FAFB',
    gap: 4,
  },
  placeholderError: { borderColor: '#DC2626', backgroundColor: '#FEF2F2' },
  placeholderText: { color: '#6B7280', fontSize: 13 },
  buttonRow: { flexDirection: 'row', gap: 10 },
  button: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#111827',
    paddingVertical: 10,
    borderRadius: 6,
  },
  buttonText: { color: '#FFFFFF', fontSize: 13, fontWeight: '500' },
  errorRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 },
  errorText: { color: '#DC2626', fontSize: 12 },
});