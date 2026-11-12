# Bitácora de Uso de Inteligencia Artificial (AI Log) — UberClone Versión Conductor

Este documento registra las consultas conceptuales, de arquitectura, depuración y asesoramiento técnico realizadas durante el desarrollo de la aplicación **UberClone — Versión Conductor**, siguiendo los lineamientos académicos de honestidad y trazabilidad (Sección 8 del instructivo). En todas las interacciones se empleó la IA como tutor y asesor técnico, escribiendo e integrando la implementación manualmente en el proyecto.

---

### Entrada #1
- Fecha: 2026-11-04
- Integrante: Emmanuel Cárdenas (EmmanuelCardenasTdeA)
- Herramienta: Gemini / 
- Objetivo: Definir el patrón de diseño y manejo de errores inline en componentes de formulario reutilizables sin utilizar Alert
- Prompt: "Estoy diseñando los componentes base de formulario (inputs de texto, selectores desplegables y selectores de fecha/imagen) para una app en React Native con Expo. La especificación prohíbe usar Alert para mostrar errores de validación y exige que cada error se muestre debajo de su campo. Sin darme código, ¿qué propiedades (props) y criterios de estado debo considerar en cada componente para manejar el foco, los mensajes de error inline y los campos de solo lectura de forma consistente?"
- Resumen de la respuesta: Explicó el patrón de componentes controlados recibiendo `value`, `onChangeText`, `error` y `editable` como props, recomendando reservar un contenedor condicional debajo del campo para renderizar el texto de error con cambio de color en el borde y separar la lógica de validación del componente visual.
- Qué se usó / modificó / descartó: Se adoptó la recomendación de mantener los componentes puramente presentacionales controlados por props (`error`, `editable`, `keyboardType`). Se modificó el enfoque de validación en `onBlur` para validar en tiempo real al cambiar cada pestaña del registro. Se descartó el uso de librerías externas de formularios como Formik para mantener control directo con `useState`.
- Archivos y commit: `src/components/FormInput.js`, `src/components/SelectField.js`, `src/components/DateField.js`, `src/components/ImagePickerField.js` — `3069889`
- Verificación: Revisión visual en Expo Go comprobando que al dejar un campo vacío o con formato inválido se pinta el borde en rojo y aparece el texto descriptivo debajo del input sin disparar ningún `Alert`.
- Aprendizaje: Comprendí cómo desacoplar la presentación de los inputs de las reglas de negocio, facilitando reutilizar el mismo componente en las tres pestañas del registro.

---

### Entrada #2
- Fecha: 2026-11-04
- Integrante: Emmanuel Cárdenas (EmmanuelCardenasTdeA)
- Herramienta: Gemini / 
- Objetivo: Estructurar el modelo de documento del conductor en Firestore y el almacenamiento de imágenes en Cloudinary sin requerir Firebase Blaze
- Prompt: "Necesito orientación arquitectónica para conectar una app de conductor en React Native con Firebase Firestore y Cloudinary. Como Firebase Storage exige el plan Blaze en cuentas nuevas, voy a subir las fotos de perfil, vehículo y documentos a Cloudinary con un preset unsigned y guardar solo las URLs en Firestore. Sin escribir código, ¿cómo conviene estructurar el documento dentro de la colección drivers y qué flujo debo seguir antes de crear el registro en la base de datos para no guardar documentos incompletos si falla una subida de imagen?"
- Resumen de la respuesta: Aconsejó subir primero todas las imágenes a Cloudinary mediante peticiones `multipart/form-data` y recolectar sus `secure_url` antes de ejecutar la escritura en Firestore. Además, sugirió agrupar el documento `drivers/{driverId}` en subobjetos lógicos (`personalData`, `vehicle`, `documents`) junto con banderas de estado (`approvalStatus: 'pending'`, `isAvailable: false`, `balance: 0`).
- Qué se usó / modificó / descartó: Se aplicó el orden sugerido (subida previa a Cloudinary y escritura atómica posterior en Firestore) y la división en subobjetos dentro de `drivers/{driverId}`. Se agregó persistencia del `driverId` en `AsyncStorage` únicamente para restaurar la sesión no sensible. Se descartó el uso de Firebase Auth con teléfono para simplificar las pruebas del flujo de aprobación en Firestore.
- Archivos y commit: `src/config/firebase.js`, `src/services/cloudinaryService.js`, `src/services/driverService.js` — `987c77c`
- Verificación: Creación de un conductor de prueba desde el emulador y verificación en la consola de Firebase Firestore de que las URLs corresponden a enlaces HTTPS válidos de Cloudinary y que el estado inicial es `pending`.
- Aprendizaje: Entendí por qué nunca deben guardarse rutas locales (`file://`) en una base de datos en la nube y cómo asegurar que el documento de Firestore solo se cree cuando todos los recursos multimedia están disponibles.

---

### Entrada #3
- Fecha: 2026-11-05
- Integrante: Emmanuel Cárdenas (EmmanuelCardenasTdeA)
- Herramienta: Gemini / 
- Objetivo: Diseñar el estado global del registro en tres pestañas con React Context y sincronización de datos entre pestañas
- Prompt: "Tengo un flujo de registro dividido en tres pestañas (Datos personales, Vehículo y Documentos) usando Material Top Tabs en React Native. El botón final de enviar registro solo debe habilitarse cuando las tres pestañas estén completas y válidas, y además el número de documento de identidad ingresado en la Pestaña 1 debe reflejarse automáticamente como número de licencia de conducción en la Pestaña 3. No me des código, solo explícame cómo estructurar el Context para compartir el estado entre las tres pestañas sin perder datos al cambiar de pestaña."
- Resumen de la respuesta: Recomendó envolver el navegador de pestañas dentro de un `RegistrationProvider` que mantenga tres estados independientes (`personalData`, `vehicle`, `documents`) y exponer funciones actualizadoras específicas. Indicó que al actualizar `documentId` en la función del primer bloque se debe sincronizar el campo `licenseNumber` del tercer bloque, y evaluar la validez global combinando las tres funciones validadoras.
- Qué se usó / modificó / descartó: Se implementó el proveedor de contexto con estados separados por pestaña y la sincronización directa de `documentId` hacia `licenseNumber` dejando este último de solo lectura en la pestaña de documentos. Se modificó la validación del año del vehículo para permitir hasta el año actual más uno (`currentYear + 1`) según las políticas comerciales de modelos nuevos.
- Archivos y commit: `src/context/RegistrationContext.js`, `src/screens/register/PersonalDataTab.js` — `e0629f0`
- Verificación: Prueba en emulador ingresando datos en la Pestaña 1, navegando a las Pestañas 2 y 3, comprobando que el número de cédula aparece prellenado en el campo de licencia y que el botón de envío permanece deshabilitado hasta completar el último campo.
- Aprendizaje: Aprendí a centralizar el estado de formularios multipaso usando `useContext` para evitar pasar props a través de múltiples niveles de navegación.

---

### Entrada #4
- Fecha: 2026-11-05
- Integrante: Emmanuel Cárdenas (EmmanuelCardenasTdeA)
- Herramienta: Gemini / 
- Objetivo: Definir las reglas de validación condicional para vehículos (categoría XL y revisión técnico-mecánica según antigüedad) y manejo del teclado en formularios largos
- Prompt: "En las pestañas de Vehículo y Documentos de mi app en React Native tengo dos validaciones condicionales: si la categoría es XL la capacidad mínima debe ser de 6 pasajeros, y la revisión técnico-mecánica solo es obligatoria según el año del vehículo. Además, en pantallas pequeñas el teclado tapa los últimos inputs y la barra inferior del sistema tapa el botón de enviar. Sin darme código, ¿qué estrategia de validación condicional y qué componentes nativos de layout debo combinar para resolver ambos problemas?"
- Resumen de la respuesta: Explicó que el validador de documentos debe recibir como segundo parámetro el año del vehículo para exigir la foto y fecha de tecnomecánica únicamente cuando supera el umbral de antigüedad. Para el layout, recomendó envolver cada pantalla con `KeyboardAvoidingView` configurado según la plataforma (`padding` en iOS, `height` en Android) junto con `ScrollView` (`keyboardShouldPersistTaps="handled"`) y sumar el `insets.bottom` de `useSafeAreaInsets` al `paddingBottom`.
- Qué se usó / modificó / descartó: Se aplicó la firma `validateDocuments(data, vehicleYear)` en el módulo de validaciones y se integró `KeyboardAvoidingView` + `useSafeAreaInsets` en las tres pestañas del registro. Se descartó el uso de alturas fijas en píxeles que rompían el scroll en pantallas con barra de navegación por gestos.
- Archivos y commit: `src/screens/register/VehicleTab.js`, `src/screens/register/DocumentsTab.js`, `src/screens/register/PendingApprovalScreen.js`, `src/utils/validations.js` — `0718c8a`
- Verificación: Prueba en dispositivo Android cambiando la categoría entre `economy` y `xl` con capacidad de 4 pasajeros, y abriendo el teclado en el último campo de correo de Mercado Pago sin que quede oculto.
- Aprendizaje: Comprendí la importancia de las validaciones cruzadas entre entidades del formulario y el uso de `react-native-safe-area-context` para garantizar diseños responsivos en distintos tamaños de pantalla.

---

### Entrada #5
- Fecha: 2026-11-05
- Integrante: Emmanuel Cárdenas (EmmanuelCardenasTdeA)
- Herramienta: Gemini / 
- Objetivo: Diagnosticar problemas de variables de entorno en Expo y escucha en tiempo real del cambio de estado `pending` a `approved` en Firestore
- Prompt: "Al probar la app en Expo, algunas variables de entorno de mi archivo .env no se leen en tiempo de ejecución y quiero que la pantalla de 'Pendiente de aprobación' pase automáticamente al mapa del conductor apenas yo cambie el campo approvalStatus a 'approved' en la consola de Firestore, sin tener que reiniciar la app. Sin escribirme el código, ¿por qué Expo ignora ciertas variables del .env y qué mecanismo de Firestore debo usar para reaccionar al cambio en tiempo real con su respectiva limpieza?"
- Resumen de la respuesta: Aclaró que en el bundler de Expo solo las variables con el prefijo `EXPO_PUBLIC_` se exponen al cliente por seguridad (mientras que las llaves secretas de pasarelas nunca deben llevar ese prefijo ni estar en la app). Para la aprobación en tiempo real, indicó suscribirse al documento `drivers/{driverId}` con `onSnapshot` dentro de un `useEffect` y retornar la función `unsubscribe` en el cleanup.
- Qué se usó / modificó / descartó: Se renombraron las variables públicas del cliente con el prefijo `EXPO_PUBLIC_` y se configuró el listener `onSnapshot` para actualizar `approvalStatus` en el contexto tan pronto cambia en Firestore. Se descartó hacer polling periódico con `setInterval`.
- Archivos y commit: `src/context/RegistrationContext.js`, `src/config/firebase.js`, `src/services/cloudinaryService.js` — `81cff0b`
- Verificación: Con la pantalla `PendingApprovalScreen` abierta en el emulador, se editó el campo `approvalStatus` de `"pending"` a `"approved"` en Firebase Console y la app redirigió instantáneamente al `DriverDrawer`.
- Aprendizaje: Aprendí la diferencia entre variables de entorno públicas de Expo y credenciales privadas de backend, así como el ciclo de vida de una suscripción `onSnapshot` en React.

---

### Entrada #6
- Fecha: 2026-11-08
- Integrante: Emmanuel Cárdenas (EmmanuelCardenasTdeA)
- Herramienta: Gemini / 
- Objetivo: Asesoramiento matemático para la función pura `calculateFare` sin errores de punto flotante y diseño del hook de ubicación en tiempo real
- Prompt: "Debo implementar la función pura calculateFare({ distanceKm, durationMin, category, tip }) en pesos colombianos enteros aplicando tarifa base (3500), costo por km (1200), costo por minuto (250), multiplicador por categoría, tarifa mínima (6000), redondeo al múltiplo de 100 COP más cercano antes de calcular la comisión del 20%, y suma de propina íntegra al conductor. Sin darme código, ¿cómo debo estructurar el orden de las operaciones aritméticas y el redondeo para que coincida exactamente con el caso de prueba de 8.5 km y 22 min (19.200 COP en Económico y 26.900 COP en XL)?"
- Resumen de la respuesta: Explicó el orden exacto de precedencia: primero sumar `BASE_FARE + (distanceKm * COST_PER_KM) + (durationMin * COST_PER_MINUTE)`, luego multiplicar ese subtotal por el factor de la categoría, aplicar `Math.max` contra la tarifa mínima de 6.000 COP y redondear al múltiplo de 100 mediante `Math.round(valor / 100) * 100`. A partir de esa tarifa ya redondeada se calcula el 20% de comisión con `Math.round` y finalmente `driverEarnings = fare - commission + tip`.
- Qué se usó / modificó / descartó: Se utilizó exactamente esa jerarquía matemática y se guardaron todas las constantes en `src/config/pricing.js`. Además, se corrigió un error previo donde se restaba el costo de distancia en lugar de sumarlo y donde los nombres de las constantes no coincidían con el archivo de configuración.
- Archivos y commit: `src/utils/calculateFare.js`, `src/config/pricing.js`, `src/hooks/useDriverLocation.js`, `src/screens/driver/HomeScreen.js` — `d8ddcb3`
- Verificación: Se probó `calculateFare({ distanceKm: 8.5, durationMin: 22, category: 'economy', tip: 0 })` obteniendo exactamente `fare: 19200, commission: 3840, driverEarnings: 15360`, y para `'xl'` obteniendo `fare: 26900, commission: 5380, driverEarnings: 21520`.
- Aprendizaje: Comprendí cómo evitar discrepancias de redondeo en cálculos financieros aplicando el redondeo a múltiplos enteros antes de deducir porcentajes de comisión.

---

### Entrada #7
- Fecha: 2026-11-09
- Integrante: Emmanuel Cárdenas (EmmanuelCardenasTdeA)
- Herramienta: Gemini / 
- Objetivo: Estructurar la navegación combinada (Stack, Tabs y Drawer) y el control de pantallas según el estado del viaje
- Prompt: "La arquitectura de navegación de mi app requiere combinar Tabs para el registro, Drawer para las secciones principales del conductor (Mapa, Ganancias, Historial, Perfil) y flujo tipo Stack para la atención del viaje. Además, tenemos la restricción estricta de cero emojis en toda la interfaz, usando únicamente Ionicons. Sin darme código, ¿cómo conviene organizar la jerarquía de navegadores en React Navigation para que el menú lateral esté disponible cuando el conductor está libre pero la pantalla de viaje activo tome el control durante una carrera?"
- Resumen de la respuesta: Sugirió colocar un navegador raíz condicional basado en el estado de sesión y aprobación del conductor: si no está registrado muestra las `RegistrationTabs`, si está pendiente muestra la pantalla de espera, y si está aprobado monta el `DriverDrawer`. Dentro del flujo operativo, recomendó que el estado `status` del viaje activo controle qué vista o modal se superpone al mapa principal, utilizando `<Ionicons />` en los `drawerIcon` y encabezados.
- Qué se usó / modificó / descartó: Se adoptó la estructura de navegación condicional en `AppNavigator.js` junto con `DriverDrawer.js` usando iconos de `@expo/vector-icons` (`map-outline`, `cash-outline`, `time-outline`, `settings-outline`). Se descartó colocar las pestañas de registro dentro del mismo Drawer para impedir que un conductor no aprobado acceda al mapa.
- Archivos y commit: `src/navigation/DriverDrawer.js`, `src/navigation/AppNavigator.js`, `src/components/IncomingTripModal.js` — `175dddd`
- Verificación: Recorrido completo en el emulador verificando la apertura del Drawer lateral, el cambio entre pantallas y la ausencia total de emojis en los títulos y botones.
- Aprendizaje: Entendí cómo separar los flujos de onboarding/registro de los flujos operativos mediante navegación condicional basada en contexto.

---

### Entrada #8
- Fecha: 2026-11-11
- Integrante: Emmanuel Cárdenas (EmmanuelCardenasTdeA)
- Herramienta: Gemini / 
- Objetivo: Resolver incompatibilidades de módulos nativos (`@react-native-community/geolocation` y `@react-native-firebase/messaging`) al emular en Expo Go y problema de Babel en Expo SDK 58
- Prompt: "Estoy teniendo dos errores al levantar la app en Expo SDK 58 con Expo Go: primero, al importar @react-native-community/geolocation aparece el error de que RNCGeolocation no está vinculado nativamente en Expo Go; segundo, al agregar un babel.config.js manual para reanimated, Metro falla con Cannot read properties of undefined (reading 'transformFile'). Sin darme código, explícame la causa raíz de ambos fallos en Expo SDK 58 y qué patrón de adaptador o configuración debo usar para cumplir con los paquetes obligatorios sin romper la ejecución en Expo Go."
- Resumen de la respuesta: Explicó que en Expo SDK 58 `babel-preset-expo` está anidado dentro del paquete `expo` y ya inyecta automáticamente el plugin de `react-native-reanimated`/`worklets`, por lo que crear un `babel.config.js` manual rompe la resolución de `@babel/core` en Metro. Para `@react-native-community/geolocation` y `@react-native-firebase/messaging`, indicó verificar primero en `NativeModules` si el binario nativo existe; si está presente (en development build) se usa el paquete nativo directamente, y si no (en Expo Go) se delega a un adaptador con la misma interfaz respaldado por `expo-location`.
- Qué se usó / modificó / descartó: Se eliminó el `babel.config.js` redundante y se implementó la verificación de `NativeModules.RNCGeolocation` antes de requerir el módulo, manteniendo exactamente las llamadas `watchPosition`, `getCurrentPosition` y `clearWatch` con limpieza en el retorno de `useEffect`.
- Archivos y commit: `src/hooks/useDriverLocation.js`, `src/services/notificationService.js`, `package.json` — `a2f5489`
- Verificación: Reinicio del servidor Metro con caché limpia (`--clear`), verificando que el bundle compila al 100% sin errores de transformación y que el seguimiento GPS actualiza Firestore cada pocos segundos al activar el interruptor Disponible.
- Aprendizaje: Comprendí cómo funciona la vinculación de módulos nativos (autolinking) frente al cliente precompilado de Expo Go y cómo diseñar adaptadores resilientes.

---

### Entrada #9
- Fecha: 2026-11-11
- Integrante: Emmanuel Cárdenas (EmmanuelCardenasTdeA)
- Herramienta: Gemini / 
- Objetivo: Garantizar la coherencia geográfica de los viajes simulados sobre calles reales usando OSRM, Nominatim y la máquina de 7 estados del viaje
- Prompt: "En mi simulador de solicitudes de viaje quiero que tanto el punto de recogida como el destino tengan sentido real con respecto a la ubicación actual del conductor en el mapa, que las coordenadas caigan sobre calles reales y no dentro de edificios, y que el vehículo no salte hacia atrás cuando avanza por la ruta en el emulador. Sin darme código, ¿cómo debo encadenar las consultas a OSRM / Google Directions y Nominatim al generar la solicitud, y cómo evitar que el GPS estático del emulador sobrescriba el avance simulado del vehículo durante los estados driver_arriving e in_progress?"
- Resumen de la respuesta: Recomendó partir siempre de la coordenada actual del conductor (`driverLocation`), generar desplazamientos dentro de un radio urbano cercano y consultar primero el servicio de ruteo (Google Directions con fallback a OSRM) para tomar los `snapped waypoints` sobre la vía pública y la polilínea real. Luego, usar esas coordenadas ajustadas para consultar Nominatim (respetando el límite de 1 petición por segundo y un `User-Agent` válido) y obtener nombres de calles reales. Para evitar saltos en el emulador, sugirió registrar una marca de tiempo en cada paso de la simulación para ignorar lecturas repetidas del GPS estático durante unos segundos.
- Qué se usó / modificó / descartó: Se implementó el ajuste a vía pública (road-snapping) y geocodificación inversa con Nominatim al crear la solicitud, el temporizador de 15 segundos con auto-rechazo en `useTripRequests`, la transición por los 7 estados (`requested`, `accepted`, `driver_arriving`, `in_progress`, `completed`, `paid`, `cancelled`) y el bloqueo de lecturas estáticas del emulador mediante `lastSimulatedTimestampRef`.
- Archivos y commit: `src/services/tripServices.js`, `src/hooks/useTripRequests.js`, `src/screens/driver/ActiveTripScreen.js` — `754cdf1`
- Verificación: Prueba completa en el mapa verificando que al solicitar un viaje el punto de recogida aparece a pocas cuadras de la posición actual del conductor, la línea azul sigue las calles reales hacia recogida y luego hacia el destino al tocar "Pasajero a bordo", y la cancelación solo se permite antes de `in_progress`.
- Aprendizaje: Aprendí a integrar servicios gratuitos de cartografía (OSRM y Nominatim) respetando sus políticas de consumo (llamar al servicio de rutas solo al crear y aceptar el viaje, nunca en cada movimiento) y a sincronizar máquinas de estados con Firestore.

---
