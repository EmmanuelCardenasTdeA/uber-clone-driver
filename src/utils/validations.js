// AI-assisted: see docs/AI_LOG.md #3
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const NAME_REGEX = /^[a-zA-ZáéíóúÁÉÍÓÚñÑüÜ\s]+$/;
const COLOMBIAN_CAR_PLATE_REGEX = /^[A-Z]{3}\d{3}$/;

//mayor a 18 años

export const isAdult = (birthDateString) => {
    if (!birthDateString) return false;
    const today = new Date();
    const birtDate = new Date(birthDateString);
    if(isNaN(birtDate.getTime())) return false;

    let age = today.getFullYear() - birtDate.getFullYear();
    const monthDiff = today.getMonth() - birtDate.getMonth();

    if(monthDiff < 0 || (monthDiff === 0 && today.getDate() < birtDate.getDate())){
        age--;
    }
    return age >= 18;
};

//verificar que una fecha es posterior a hoy
export const isFutureDate = (dateString) => {
    if(!dateString) return false;
    const inputDate = new Date(dateString);
    if(isNaN(inputDate.getTime())) return false;

    const today = new Date();
    today.setHours(0,0,0,0);
    inputDate.setHours(0,0,0,0);

    return inputDate > today;
};

/**
 * Determina si el vehículo requiere Revisión Técnico-Mecánica según su año.
 * En Colombia aplica para vehículos con antigüedad >= 5 años respecto al año actual.
 */
export const requiresTecnoMecanica = (vehicleYear) => {
  const currentYear = new Date().getFullYear();
  const yearNum = Number(vehicleYear);
  if (!yearNum || isNaN(yearNum)) return false;
  return currentYear - yearNum >= 5;
};

/**
 * Valida la Pestaña 1: Datos personales
 */
export const validatePersonalData = (data) => {
  const errors = {};

  if (!data.profilePhotoUrl?.trim()) {
    errors.profilePhotoUrl = 'La foto de perfil es obligatoria.';
  }

  const name = data.fullName?.trim() || '';
  if (!name) {
    errors.fullName = 'El nombre completo es obligatorio.';
  } else if (name.length > 50) {
    errors.fullName = 'Máximo 50 caracteres permitidos.';
  } else if (!NAME_REGEX.test(name)) {
    errors.fullName = 'Solo se permiten letras y espacios.';
  }

  const docId = data.documentId?.trim() || '';
  if (!docId) {
    errors.documentId = 'El documento de identidad es obligatorio.';
  } else if (!/^\d{6,10}$/.test(docId)) {
    errors.documentId = 'Debe ser numérico y tener entre 6 y 10 dígitos.';
  }

  const phone = data.phone?.trim() || '';
  if (!phone) {
    errors.phone = 'El número de celular es obligatorio.';
  } else if (!/^\d{10}$/.test(phone)) {
    errors.phone = 'Debe ser numérico de exactamente 10 dígitos.';
  }

  if (!data.birthDate) {
    errors.birthDate = 'La fecha de nacimiento es obligatoria.';
  } else if (!isAdult(data.birthDate)) {
    errors.birthDate = 'Debes ser mayor de 18 años para registrarte.';
  }

  if (!data.gender?.trim()) {
    errors.gender = 'Selecciona un género.';
  }

  const email = data.email?.trim() || '';
  if (!email) {
    errors.email = 'El correo electrónico es obligatorio.';
  } else if (!EMAIL_REGEX.test(email)) {
    errors.email = 'Ingresa un correo válido con @ y dominio.';
  }

  return errors;
};

/**
 * Valida la Pestaña 2: Vehículo
 */
export const validateVehicleData = (vehicle) => {
  const errors = {};
  const currentYear = new Date().getFullYear();

  if (!vehicle.category || !['economy', 'xl', 'premium'].includes(vehicle.category)) {
    errors.category = 'Selecciona una categoría (Económico, XL o Premium).';
  }

  // Convertir a mayúsculas antes de validar como exige el documento
  const plate = (vehicle.plate || '').trim().toUpperCase();
  if (!plate) {
    errors.plate = 'La placa del vehículo es obligatoria.';
  } else if (!COLOMBIAN_CAR_PLATE_REGEX.test(plate)) {
    errors.plate = 'Formato inválido. Usa el formato colombiano ABC123.';
  }

  const brand = vehicle.brand?.trim() || '';
  if (!brand) {
    errors.brand = 'La marca es obligatoria.';
  } else if (brand.length > 30) {
    errors.brand = 'Máximo 30 caracteres para la marca.';
  }

  const model = vehicle.model?.trim() || '';
  if (!model) {
    errors.model = 'El modelo es obligatorio.';
  } else if (model.length > 30) {
    errors.model = 'Máximo 30 caracteres para el modelo.';
  }

  const yearStr = String(vehicle.year || '').trim();
  const yearNum = Number(yearStr);
  const maxAllowedYear = currentYear + 1;
  if (!yearStr) {
    errors.year = 'El año del vehículo es obligatorio.';
  } else if (!/^\d{4}$/.test(yearStr)) {
    errors.year = 'El año debe ser numérico de 4 dígitos.';
  } else if (yearNum > maxAllowedYear || yearNum < 1990) {
    errors.year = `El año debe estar entre 1990 y ${maxAllowedYear} (año actual + 1).`;
  }

  if (!vehicle.color?.trim()) {
    errors.color = 'Selecciona un color de la lista.';
  }

  const capStr = String(vehicle.capacity || '').trim();
  const capNum = Number(capStr);
  if (!capStr || isNaN(capNum) || capNum <= 0) {
    errors.capacity = 'Ingresa una capacidad de pasajeros numérica válida.';
  } else if (vehicle.category === 'xl' && capNum < 6) {
    errors.capacity = 'La categoría XL exige una capacidad mínima de 6 pasajeros.';
  }

  if (!vehicle.photoUrl?.trim()) {
    errors.photoUrl = 'La foto del vehículo (donde se vea la placa) es obligatoria.';
  }

  return errors;
};

/**
 * Valida la Pestaña 3: Documentos y pagos
 */
export const validateDocumentsData = (documents, vehicleYear) => {
  const errors = {};
  const tecnoApplies = requiresTecnoMecanica(vehicleYear);

  if (!documents.licenseNumber?.trim()) {
    errors.licenseNumber = 'El número de licencia de conducción es obligatorio.';
  }

  if (!documents.licensePhotoUrl?.trim()) {
    errors.licensePhotoUrl = 'La foto de la licencia de conducción es obligatoria.';
  }

  if (!documents.licenseExpiration) {
    errors.licenseExpiration = 'La fecha de vencimiento de la licencia es obligatoria.';
  } else if (!isFutureDate(documents.licenseExpiration)) {
    errors.licenseExpiration = 'La fecha de vencimiento debe ser posterior a hoy.';
  }

  if (!documents.soatPhotoUrl?.trim()) {
    errors.soatPhotoUrl = 'La foto del SOAT es obligatoria.';
  }

  if (!documents.soatExpiration) {
    errors.soatExpiration = 'La fecha de vencimiento del SOAT es obligatoria.';
  } else if (!isFutureDate(documents.soatExpiration)) {
    errors.soatExpiration = 'El SOAT debe tener fecha de vencimiento posterior a hoy.';
  }

  // Validación condicional de Revisión Técnico-Mecánica según año del vehículo
  if (tecnoApplies) {
    if (!documents.tecnoPhotoUrl?.trim()) {
      errors.tecnoPhotoUrl = 'Por el año del vehículo, la foto de la Técnico-Mecánica es obligatoria.';
    }
    if (!documents.tecnoExpiration) {
      errors.tecnoExpiration = 'La fecha de vencimiento de la Técnico-Mecánica es obligatoria.';
    } else if (!isFutureDate(documents.tecnoExpiration)) {
      errors.tecnoExpiration = 'La Técnico-Mecánica debe tener fecha posterior a hoy.';
    }
  }

  const mpEmail = documents.mercadoPagoEmail?.trim() || '';
  if (!mpEmail) {
    errors.mercadoPagoEmail = 'El correo de la cuenta de Mercado Pago es obligatorio.';
  } else if (!EMAIL_REGEX.test(mpEmail)) {
    errors.mercadoPagoEmail = 'Ingresa un formato de correo válido para recibir tus pagos.';
  }

  if (!documents.termsAccepted) {
    errors.termsAccepted = 'Debes aceptar los términos y el porcentaje de comisión.';
  }

  return errors;
};