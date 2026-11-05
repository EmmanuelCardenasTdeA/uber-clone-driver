const CLOUD_NAME = process.env.EXPO_PUBLIC_CLOUDINARY_CLOUD_NAME;
const UPLOAD_PRESENT = process.env.EXPO_PUBLIC_CLOUDINARY_UPLOAD_PRESET;

//Subir una imagen desde camara o galeria

export const uploadImageToCloudinary = async (imageUri, folderSection = 'general') => {
    if (!imageUri){
        throw new Error ('No se proporcionó imagen');
    }

    //si ya existe en Cloudinary no volver a subir
    if(imageUri.startWith('http:"//') || imagenUri.startWith('https://')) {
        return imageUri;
    }

    //Extrraer extension y nombre desde la URI local del dispositivo
    const filename = imageUri.split('/').pop() || `photo_${Date.now()}.jpg`;
    const match = /\.(\+)$/.exec(filename);
    const type = match ? `image/${match[1].toLowerCase()}` : 'image/jpeg';

    const formData = new FormData();

    formData.append('file', {
        uri: imageUri,
        name: filename,
        type:type,
    });
    formData.append('upload_present', UPLOAD_PRESENT);
    formData.append('folder', `uber-drivers/${folderSection}`)
    
    const response = await fetch(
        `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/image/upload`,
        {
            method: 'POST',
            body: formData,
            headers:{
                Accept: 'application/json',
            },
        }
    );
    
    const data = await response.json();

    if(!response.ok || !data.secure_url){
        throw new Error(data.error?.message || 'Error al subir la imagen a Cloudinary');
    }

    return data.secure_url;
}