/**
 * Utilidad para comprimir imágenes en el navegador antes de subirlas al servidor.
 * Reduce las dimensiones si exceden los límites y ajusta la calidad JPEG.
 */
export async function compressImage(file: File): Promise<File> {
    // Solo procesar imágenes
    if (!file.type.startsWith('image/')) return file;
    
    // Umbral de activación: 800KB. Si es menor, no vale la pena el costo de procesamiento.
    if (file.size < 800 * 1024) return file;

    try {
        // Crear un bitmap de la imagen original
        const bitmap = await self.createImageBitmap(file);
        
        // Límites razonables para visualización en web/móvil
        const maxWidth = 1500;
        const maxHeight = 3000; // Un poco más alto para capturas de pantalla largas (screenshots)

        let width = bitmap.width;
        let height = bitmap.height;
        let shouldResize = false;

        // Calcular nuevas dimensiones manteniendo la proporción
        if (width > maxWidth) {
            height = Math.round((height * maxWidth) / width);
            width = maxWidth;
            shouldResize = true;
        }

        if (height > maxHeight) {
            width = Math.round((width * maxHeight) / height);
            height = maxHeight;
            shouldResize = true;
        }

        // Si la imagen es pesada (>2MB) o si superó las dimensiones máximas, la procesamos
        if (shouldResize || file.size > 2 * 1024 * 1024) {
            const canvas = document.createElement('canvas');
            canvas.width = width;
            canvas.height = height;
            const ctx = canvas.getContext('2d');

            if (ctx) {
                // Dibujar la imagen en el canvas con las nuevas dimensiones
                ctx.drawImage(bitmap, 0, 0, width, height);

                // Convertir el canvas a un Blob JPEG con 85% de calidad
                const blob = await new Promise<Blob | null>(resolve => {
                    canvas.toBlob(resolve, 'image/jpeg', 0.85);
                });

                if (blob) {
                    // Crear un nuevo objeto File a partir del Blob
                    const newFileName = file.name.replace(/\.[^/.]+$/, ".jpg");
                    const compressedFile = new File([blob], newFileName, { type: 'image/jpeg' });
                    
                    console.log(`[Compression] Original: ${(file.size / 1024).toFixed(0)}KB, Comprimida: ${(compressedFile.size / 1024).toFixed(0)}KB`);
                    
                    bitmap.close();
                    return compressedFile;
                }
            }
        }
        
        bitmap.close();
        return file;
    } catch (error) {
        console.error("Error comprimiendo imagen:", error);
        return file; // Retornar original en caso de error
    }
}
