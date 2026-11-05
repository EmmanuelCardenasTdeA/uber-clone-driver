const CLOUD_NAME = 'bmjxycrc';
const UPLOAD_PRESET = 'uber_clone_drivers';

//Subir una imagen desde camara o galeria

export const uploadImageToCloudinary = async (imageUri, folderSection = 'general') => {
    if (!imageUri || typeof imageUri !== 'string') {
        throw new Error('No se proporcionó imagen válida');
    }

    //si ya existe en Cloudinary no volver a subir
    if (imageUri.startsWith('http://') || imageUri.startsWith('https://')) {
        return imageUri;
    }

    //Extraer extension y nombre desde la URI local del dispositivo
    const filename = imageUri.split('/').pop() || `photo_${Date.now()}.jpg`;
    const match = /\.(\w+)$/.exec(filename);
    const type = match ? `image/${match[1].toLowerCase()}` : 'image/jpeg';

    const formData = new FormData();

    formData.append('file', {
        uri: imageUri,
        name: filename,
        type: type,
    });
    formData.append('upload_preset', String(UPLOAD_PRESET));
    formData.append('folder', `uber-drivers/${folderSection}`);

    // Usamos XMLHttpRequest nativo de React Native porque el nuevo fetch de Expo SDK 58
    // (expo/src/winter/fetch/convertFormData.ts) no soporta objetos { uri, name, type } en FormData
    const data = await new Promise((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open('POST', `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/image/upload`);
        xhr.setRequestHeader('Accept', 'application/json');

        xhr.onload = () => {
            try {
                const responseData = JSON.parse(xhr.responseText);
                if (xhr.status >= 200 && xhr.status < 300 && responseData.secure_url) {
                    resolve(responseData);
                } else {
                    reject(
                        new Error(
                            responseData.error?.message || 'Error al subir la imagen a Cloudinary'
                        )
                    );
                }
            } catch (err) {
                reject(new Error('Respuesta inválida del servidor al subir la imagen'));
            }
        };

        xhr.onerror = () => {
            reject(new Error('Error de red al subir la imagen a Cloudinary'));
        };

        xhr.send(formData);
    });

    return data.secure_url;
};
