### Entrada #1
**Fecha:** 2026-11-04
**Integrante:** Emmanuel Cardenas
**Herramienta:** Gemini
**Objetivo:** Configurar Cloudinary con Upload Preset sin firma y crear el componente reutilizable de captura de imágenes desde cámara o galería.
**Prompt:** "Explicame la configuracion con Cloudinary para el proyecto"
**Resumen de la respuesta:** Explicó cómo configurar un Unsigned Upload Preset en Cloudinary y generó la función `uploadImageToCloudinary` usando `FormData` junto con el componente `ImagePickerField` que permite elegir entre cámara y galería mostrando errores debajo del campo sin usar `Alert`.
**Qué se usó / modificó / descartó:** Se usó la función de subida por `fetch` a la API REST de Cloudinary y el componente `ImagePickerField.js` ajustando la calidad de compresión a `0.7`.
**Archivos y commit:** `src/services/cloudinary.js`, `src/components/ImagePickerField.js`, `.env.example` — `[REEMPLAZAR_CON_HASH_DEL_COMMIT]`
**Verificación:** Se seleccionó una imagen en el emulador desde galería y cámara y se verificó que se genera el preview local y que al invocar `uploadImageToCloudinary` el archivo aparece en la carpeta `uber-drivers` de Cloudinary devolviendo `secure_url`.
**Aprendizaje:** Aprendí a enviar archivos multimedia desde React Native mediante objetos `FormData` hacia un endpoint `unsigned` de Cloudinary sin exponer credenciales privadas en la app móvil.

### Entrada #2
**Fecha:** 2026-11-04
**Integrante:** Emmanuel Cardenas
**Herramienta:** Gemini
**Objetivo:** Integrar la librería Ionicons (`@expo/vector-icons`) en los componentes de formulario y en el navegador de las 3 pestañas de registro.
**Prompt:** "Para iconos se usara la libreria de Ionicons implementar en los archivos actuales"
**Resumen de la respuesta:** Indicó la instalación mediante `@expo/vector-icons`, actualizó `ImagePickerField.js` con íconos de cámara, galería y alerta de error, y creó `RegistrationTabs.js` asignando íconos de Ionicons (`person`, `car-sport`, `document-text`) e indicadores visuales de validación por pestaña.
**Qué se usó / modificó / descartó:** Se usó la configuración de `tabBarIcon` con Ionicons y los badges de validación en el `BottomTabNavigator`.
**Archivos y commit:** `src/components/ImagePickerField.js`, `src/navigation/RegistrationTabs.js` — `[REEMPLAZAR_CON_HASH_DEL_COMMIT]`
**Verificación:** Se verificó en el emulador que los íconos de Ionicons cargan sin errores de fuentes y cambian entre su versión rellena y `outline` al alternar entre pestañas.
**Aprendizaje:** Aprendí a configurar `tabBarIcon` dinámicamente según `route.name` usando `@expo/vector-icons` y a mostrar el estado de completitud de cada pestaña mediante `tabBarBadge`.

### Entrada #3
**Fecha:** 2026-11-04
**Integrante:** Emmanuel Cardenas
**Herramienta:** Gemini
**Objetivo:** Crear las funciones de validación de las 3 pestañas, el contexto global `RegistrationContext` y los componentes `FormInput` y `DatePickerField`.
**Prompt:** "Construir el RegistrationContetx.js que sera el estado compartido entre las 3 pestañas" (Continuación para generar RegistrationContext.js y validaciones de las 3 pestañas)
**Resumen de la respuesta:** Generó `src/utils/validations.js` con las reglas de negocio de las 3 pestañas (edad >= 18, placa colombiana en mayúsculas, capacidad XL >= 6, fechas de vencimiento futuras y técnico-mecánica condicional), `src/context/RegistrationContext.js` usando `useState`, `useEffect`, `useMemo`, `useCallback` y `AsyncStorage`, y los componentes `FormInput.js` y `DatePickerField.js`.
**Qué se usó / modificó / descartó:** Se usaron las funciones validadoras puras y el `RegistrationProvider` integrando la subida en paralelo con `Promise.all` hacia Cloudinary antes de guardar en Firestore.
**Archivos y commit:** `src/utils/validations.js`, `src/context/RegistrationContext.js`, `src/components/FormInput.js`, `src/components/DatePickerField.js` — `[REEMPLAZAR_CON_HASH_DEL_COMMIT]`
**Verificación:** Se probaron casos borde en las funciones de validación (placas en minúscula, menores de 18 años, categoría XL con 4 pasajeros y documentos vencidos) comprobando el bloqueo de `canSubmitRegistration`.
**Aprendizaje:** Comprendí cómo usar `useMemo` para derivar la validez en tiempo real de múltiples pestañas sin causar renderizados innecesarios y cómo limpiar la suscripción `onSnapshot` en el retorno de `useEffect`.

### Entrada #4
**Fecha:** 2026-11-04
**Integrante:** Emmanuel Cardenas
**Herramienta:** Gemini
**Objetivo:** Crear las funciones de validación de las 3 pestañas, el contexto global `RegistrationContext` y los componentes `FormInput` y `DatePickerField`.
**Prompt:** "Implementar las validaciones, empezar con el proveedor del registro y los componentes"
**Resumen de la respuesta:** Generó `src/utils/validations.js` con las reglas de negocio de las 3 pestañas (edad >= 18, placa colombiana en mayúsculas, capacidad XL >= 6, fechas de vencimiento futuras y técnico-mecánica condicional), `src/context/RegistrationContext.js` usando `useState`, `useEffect`, `useMemo`, `useCallback` y `AsyncStorage`, y los componentes `FormInput.js` y `DatePickerField.js`.
**Qué se usó / modificó / descartó:** Se usaron las funciones validadoras puras y el `RegistrationProvider` integrando la subida en paralelo con `Promise.all` hacia Cloudinary antes de guardar en Firestore.
**Archivos y commit:** `src/utils/validations.js`, `src/context/RegistrationContext.js`, `src/components/FormInput.js`, `src/components/DatePickerField.js` — `[REEMPLAZAR_CON_HASH_DEL_COMMIT]`
**Verificación:** Se probaron casos borde en las funciones de validación (placas en minúscula, menores de 18 años, categoría XL con 4 pasajeros y documentos vencidos) comprobando el bloqueo de `canSubmitRegistration`.
**Aprendizaje:** Comprendí cómo usar `useMemo` para derivar la validez en tiempo real de múltiples pestañas sin causar renderizados innecesarios y cómo limpiar la suscripción `onSnapshot` en el retorno de `useEffect`.