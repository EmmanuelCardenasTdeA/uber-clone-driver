// AI-assisted: see docs/AI_LOG.md #5`
import {doc, setDoc, onSnapshot, serverTimestamp} from 'firebase/firestore';
import { db } from '../config/firebase';
import { PRICING_CONFIG } from '../config/pricing';

//Registra al conductor en la colección 'drivers' de Firestore dejando la cuenta en estado 'pending_approval' e 'isAvailable: false'.
 
export const registerDriverInDB = async (registrationData) => {
    const {personalData, vehicle, documents} = registrationData;

    //CC como id del documento en Firestore

    const driverId = personalData.documentId.trim();
    const driverRef = doc(db, 'drivers', driverId);

    const payload = {
        accountStatus:'pending_approval',
        isAvailable: false,
        personalData:{
            profilePhotoUrl: personalData.profilePhotoUri,
            fullname:personalData.fullName.trim(),
            documentId:driverId,
            phone: personalData.phone.trim(),
            birthDate: personalData.birthDate,
            gender: personalData.gender,
            email: personalData.email,
            language: personalData.language,
        },
        vehicle: {
            category: vehicle.category,
            plate: vehicle.plate.trim().toUpperCase(),
            brand: vehicle.brand.trim(),
            model: vehicle.model.trim(),
            year: Number(vehicle.year),
            color: vehicle.color,
            capacity: Number(vehicle.capacity),
            photoUrl: vehicle.photoUrl,
        },
        documents: {
            license: {
            number: documents.licenseNumber.trim(),
            photoUrl: documents.licensePhotoUrl,
            expirationDate: documents.licenseExpiration,
        },
        soat: {
            photoUrl: documents.soatPhotoUrl,
            expirationDate: documents.soatExpiration,
        },
        tecnoMecanica: {
            applies: Boolean(documents.tecnoApplies),
            photoUrl: documents.tecnoApplies ? documents.tecnoPhotoUrl : null,
            expirationDate: documents.tecnoApplies ? documents.tecnoExpiration : null,
        },
        mercadoPagoEmail: documents.mercadoPagoEmail.trim().toLowerCase(),
        termsAccepted: Boolean(documents.termsAccepted),
        acceptedCommissionRate: PRICING_CONFIG.COMMISSION_RATE,
        },
        location: {
            lat: 6.2442,
            lng: -75.5812,
        },
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
    };
    await setDoc(driverRef, payload);
    return driverId;
};

/**
 * Escucha en tiempo real el documento del conductor en Firestore (onSnapshot).
 * Retorna la función unsubscribe para limpiarla en el useEffect.
 */
export const subscribeToDriverStatus = (driverId, callback) => {
  const driverRef = doc(db, 'drivers', driverId);
  return onSnapshot(driverRef, (snapshot) => {
    if (snapshot.exists()) {
      callback(snapshot.data());
    }
  });
};