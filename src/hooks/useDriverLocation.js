import { useState, useEffect, useCallback } from "react";
import * as Location from 'expo-location';
import AsyncStorage from "@react-native-async-storage/async-storage";
import { doc, updateDoc, serverTimestamp } from "firebase/firestore";
import { db } from "../config/firebase";

const AVAILABILITY_STORAGE_KEY = '@uber_driver_last_availability';

//este hook sincronizara la ubicación y la gestion del estado de disponible y no disponible

export const useDriverLocation =(driverId, initialIsAvailable = false) =>{
    const[isAvailable, setIsAvailable] = useState(initialIsAvailable);
    const [location, setLocation] = useState({
        latitude: 6.2442,
        longitude: -75.5812,
    });
    const [locationError, setLocationError] = useState(null);

    //cargar ultimo estado de disponibilidad
    useEffect(() => {
        const loadSavedAvailability = async () => {
            try {
                const saved = await AsyncStorage.getItem(AVAILABILITY_STORAGE_KEY);
                if(saved !== null){
                    const parsed = JSON.parse(saved);
                    setIsAvailable(parsed);
                }
            } catch (error) {
            }
        };
        loadSavedAvailability();
    },[]);

    //obtener ubicacion inicial una  sola vez para centrar el mapa al abrir la pantalla
    useEffect(() => {
        let isMounted = true;

        (async () => {
            try {
                const { status } = await Location.requestForegroundPermissionsAsync();
                if(status !== 'granted'){
                    if(isMounted){
                        setLocationError('Permiso de ubicación negado. Activalo para recibir viajes');
                    }
                    return;
                }
                const currentPos = await Location.getCurrentPositionAsync({
                    accuracy: Location.Accuracy.Balanced,
                });
                if(isMounted && currentPos?.coords){
                    setLocation({
                        latitude: currentPos.coords.latitude,
                        longitude: currentPos.coords.longitude,
                    });
                }
            } catch (error) {
                if (isMounted) {
                    setLocationError('No se pudo obtener la ubicación actual');
                }
            }
        })();
        return ()=> {
            isMounted = false;
        };
    }, []);

    //Seguimiento continuo en tiempo real mientras esta disponible
    useEffect(() => {
        let locationSuscription = null;
        
        const startTracking = async () => {
            if (!driverId || !isAvailable) return;

            setLocationError(null);
            const { status } = await Location.requestForegroundPermissionsAsync();
            if (status !== 'granted') {
                setLocationError('Debes permitir el acceso al GPS para ponerte Disponible');
                setIsAvailable(false);
                return;
            }

            //watchPositionAsync : actualizsa cada 5 s o cada 10 m
            locationSuscription = await Location.watchPositionAsync(
                {
                    accuracy: Location.Accuracy.High,
                    timeInterval: 5000,
                    distanceInterval: 10,
                },
                async (pos) => {
                    const { latitude, longitude } = pos.coords;
                    setLocation({ latitude, longitude });

                    try {
                        const driverRef = doc(db, 'drivers', driverId);
                        await updateDoc(driverRef, {
                            location:{
                                lat: latitude,
                                lng: longitude,
                            },
                            updatedAt: serverTimestamp(),
                        })
                        
                    } catch (error) {
                        setLocationError('Error sincronizando en tiempo real')
                    }
                }
            );
        };

        if (isAvailable) 
        {
            startTracking();
        }

        //Funcion de limpieza al pasar a No Disponible
        return () => {
            if(locationSuscription){
                locationSuscription.remove();
            }
        };
    }, [driverId, isAvailable]);

    //cambiar entre disponible y no disponibel
    const toggleAvailability = useCallback(
        async (nextState) => {
            if(!driverId) return;
            setIsAvailable(nextState);

            try {
                await AsyncStorage.setItem(AVAILABILITY_STORAGE_KEY, JSON.stringify(nextState));
                const driverRef = doc(db, 'drivers', driverId);
                await updateDoc (driverRef,{
                    isAvailable: nextState,
                    updatedAt: serverTimestamp(),
                });
            } catch (error) {
                setLocationError('No se pudo cambiar el estado de disponibilidad');
            }
        },[driverId]);

        return {
            isAvailable,
            location,
            locationError,
            toggleAvailability
        };
};