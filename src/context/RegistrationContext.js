// AI-assisted: see docs/AI_LOG.md #5`
import React, { createContext, useContext, useState, useEffect, useMemo, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { validatePersonalData, validateDocumentsData, validateVehicleData, requiresTecnoMecanica } from "../utils/validations"; 
import { uploadImageToCloudinary } from "../services/cloudinary";
import { registerDriverInDB, subscribeToDriverStatus } from "../services/driverService";


const RegistrationContext = createContext(null);

const STORAGE_KEYS = {
    DRIVER_ID: '@uber_driver_session_id',
}

export const RegistrationProvider = ({ children }) => {

    // 1. Estado de la Pestaña 1: Datos personales
    const [personalData, setPersonalData] = useState({
        profilePhotoUrl: '',
        fullName: '',
        documentId: '',
        phone: '',
        birthDate: '',
        gender: '',
        email: '',
    });

    // 2. Estado de la Pestaña 2: Vehículo
    const [vehicle, setVehicle] = useState({
        category: 'economy',
        plate: '',
        brand: '',
        model: '',
        year: '',
        color: '',
        capacity: '',
        photoUrl: '',
    });

    // 3. Estado de la Pestaña 3: Documentos y pagos
    const [documents, setDocuments] = useState({
        licenseNumber: '',
        licensePhotoUrl: '',
        licenseExpiration: '',
        soatPhotoUrl: '',
        soatExpiration: '',
        tecnoPhotoUrl: '',
        tecnoExpiration: '',
        mercadoPagoEmail: '',
        termsAccepted: false,
    });

    // Control de errores visuales debajo de cada campo
    const [touched, setTouched] = useState({});
    const [submitting, setSubmitting] = useState(false);
    const [submitError, setSubmitError] = useState(null);

    // Sesión del conductor tras enviar el registro
    const [driverId, setDriverId] = useState(null);
    const [driverProfile, setDriverProfile] = useState(null);

    // Cargar sesión guardada en AsyncStorage al iniciar la app
    useEffect(() => {
        const loadPreferences = async () => {
        try {
            const savedDriverId = await AsyncStorage.getItem(STORAGE_KEYS.DRIVER_ID);
            if (savedDriverId) {
            setDriverId(savedDriverId);
            }
        } catch (e) {
            // Lectura inicial silenciosa
        }
        };
        loadPreferences();
    }, []);

    // Suscripción en tiempo real a Firestore (para saber cuándo pasa de pending_approval a approved)
    useEffect(() => {
        if (!driverId) return;

        const unsubscribe = subscribeToDriverStatus(driverId, (data) => {
        setDriverProfile(data);
        });

        // Función de limpieza obligatoria (cleanup de useEffect)
        return () => {
        unsubscribe();
        };
    }, [driverId]);

    //Actualizar un campo de la pestaña 1 Conductor
    const updatePersonalField = useCallback(async(field, value) =>{
        setPersonalData((prev) => ({...prev, [field]: value}));
        setTouched((prev) => ({...prev, [`personal.${field}`] : true}));

        // En Colombia el número de licencia de conducción es el mismo número de documento
        if (field === 'documentId') {
            setDocuments((prev) => ({ ...prev, licenseNumber: value }));
        }
    }, []);

    //Actualizar un campo de la pestaña 2 Vehiculo (PLACA EN MAYUS)
    const updateVehicleField = useCallback((field, value) => {
        const normalizedValue = field === 'plate' ? value.toUpperCase() : value;
        setVehicle((prev) => ({...prev, [field] : normalizedValue}));
        setTouched((prev) => ({...prev, [`vehicle.${field}`] : true}));
    },[]);

    // Actualizar un campo de la Pestaña 3 documentos
    const updateDocumentsField = useCallback((field, value) => {
        setDocuments((prev) => ({ ...prev, [field]: value }));
        setTouched((prev) => ({ ...prev, [`documents.${field}`]: true }));
    }, []);

    // Validaciones por pestaña memorizadas con useMemo
    const tab1Errors = useMemo(() => validatePersonalData(personalData), [personalData]);
    const tab2Errors = useMemo(() => validateVehicleData(vehicle), [vehicle]);
    const tab3Errors = useMemo(
        () => validateDocumentsData(documents, vehicle.year),
        [documents, vehicle.year]
    );

    const isTab1Valid = useMemo(() => Object.keys(tab1Errors).length === 0, [tab1Errors]);
    const isTab2Valid = useMemo(() => Object.keys(tab2Errors).length === 0, [tab2Errors]);
    const isTab3Valid = useMemo(() => Object.keys(tab3Errors).length === 0, [tab3Errors]);

    //aplica tecno?
    const tecnoApplies = useMemo(() => requiresTecnoMecanica(vehicle.year), [vehicle.year]);

    // Solo habilita el botón "Enviar registro" si las 3 pestañas están completas y válidas
    const canSubmitRegistration = useMemo(
        () => isTab1Valid && isTab2Valid && isTab3Valid && !submitting,
        [isTab1Valid, isTab2Valid, isTab3Valid, submitting]
    );

    // Función que sube las fotos a Cloudinary y guarda el conductor en Firebase Firestore
    const submitRegistration = useCallback(async () => {
        setSubmitError(null);

        if (!isTab1Valid || !isTab2Valid || !isTab3Valid) {
        setSubmitError('Completa correctamente todos los campos de las 3 pestañas antes de enviar.');
        return false;
        }

        try {
        setSubmitting(true);

        // 1. Subir fotos a Cloudinary en paralelo
        const [
            uploadedProfilePhoto,
            uploadedVehiclePhoto,
            uploadedLicensePhoto,
            uploadedSoatPhoto,
            uploadedTecnoPhoto,
        ] = await Promise.all([
            uploadImageToCloudinary(personalData.profilePhotoUrl, 'profile'),
            uploadImageToCloudinary(vehicle.photoUrl, 'vehicle'),
            uploadImageToCloudinary(documents.licensePhotoUrl, 'documents'),
            uploadImageToCloudinary(documents.soatPhotoUrl, 'documents'),
            tecnoApplies
            ? uploadImageToCloudinary(documents.tecnoPhotoUrl, 'documents')
            : Promise.resolve(null),
        ]);

        // 2. Guardar documento en Firestore con estado inicial 'pending_approval'
        const registeredId = await registerDriverInDB({
            personalData: {
            ...personalData,
            profilePhotoUrl: uploadedProfilePhoto,
            },
            vehicle: {
            ...vehicle,
            photoUrl: uploadedVehiclePhoto,
            },
            documents: {
            ...documents,
            licenseNumber: personalData.documentId || documents.licenseNumber,
            tecnoApplies,
            licensePhotoUrl: uploadedLicensePhoto,
            soatPhotoUrl: uploadedSoatPhoto,
            tecnoPhotoUrl: uploadedTecnoPhoto,
            },
        });

        // 3. Guardar el ID del conductor en AsyncStorage para mantener la sesión activa
        await AsyncStorage.setItem(STORAGE_KEYS.DRIVER_ID, registeredId);
        setDriverId(registeredId);
        return true;
        } catch (error) {
        setSubmitError(error.message || 'Ocurrió un error al enviar el registro.');
        return false;
        } finally {
        setSubmitting(false);
        }
    }, [
        isTab1Valid,
        isTab2Valid,
        isTab3Valid,
        personalData,
        vehicle,
        documents,
        tecnoApplies,
    ]);

    // Función auxiliar para cerrar sesión o reiniciar el registro durante tus pruebas (BASICAMENTE SE LIMIAN TODOS LOS DATOS)
    const resetSession = useCallback(async () => {
        await AsyncStorage.removeItem(STORAGE_KEYS.DRIVER_ID);
        setDriverId(null);
        setDriverProfile(null);
    }, []);

    const value = useMemo(
        () => ({
        personalData,
        vehicle,
        documents,
        touched,
        setTouched,
        updatePersonalField,
        updateVehicleField,
        updateDocumentsField,
        tab1Errors,
        tab2Errors,
        tab3Errors,
        isTab1Valid,
        isTab2Valid,
        isTab3Valid,
        tecnoApplies,
        canSubmitRegistration,
        submitting,
        submitError,
        submitRegistration,
        driverId,
        driverProfile,
        resetSession,
        }),
        [
        personalData,
        vehicle,
        documents,
        touched,
        updatePersonalField,
        updateVehicleField,
        updateDocumentsField,
        tab1Errors,
        tab2Errors,
        tab3Errors,
        isTab1Valid,
        isTab2Valid,
        isTab3Valid,
        tecnoApplies,
        canSubmitRegistration,
        submitting,
        submitError,
        submitRegistration,
        driverId,
        driverProfile,
        resetSession,
        ]
    );

    return <RegistrationContext.Provider value={value}>{children}</RegistrationContext.Provider>;
};

// Hook personalizado para consumir el contexto desde cualquier pestaña
export const useRegistration = () => {
  const context = useContext(RegistrationContext);
  if (!context) {
    throw new Error('useRegistration debe usarse dentro de un RegistrationProvider');
  }
  return context;
};

