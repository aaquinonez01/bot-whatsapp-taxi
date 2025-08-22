# 🗺️ Configuración de Mapbox Geocoding API

## Configuración del Token de Mapbox

Para que el bot pueda detectar automáticamente el sector/barrio desde las coordenadas GPS, necesitas configurar un token de acceso de Mapbox.

### 1. Crear Cuenta en Mapbox

1. Ve a [mapbox.com](https://www.mapbox.com/)
2. Crea una cuenta gratuita
3. Verifica tu email

### 2. Obtener Token de Acceso

1. Inicia sesión en tu cuenta de Mapbox
2. Ve a [Account Tokens](https://account.mapbox.com/access-tokens/)
3. Copia tu **Default public token** (comienza con `pk.`)

### 3. Configurar el Token

Edita el archivo `.env` y agrega tu token:

```env
MAPBOX_ACCESS_TOKEN=pk.eyJ1IjoiTUlfdXN1YXJpbyIsImEiOiJjbGV1czJlc3kxaW1qM3BuN2NhdGt4c2Y0In0.abcd1234567890
```

### 4. Límites del Tier Gratuito

✅ **100,000 requests por mes GRATIS**
- Más que suficiente para un bot de taxi pequeño/mediano
- ~3,300 requests por día
- Rate limit: 1,000 requests/minuto

### 5. Verificar Configuración

El bot validará automáticamente que el token esté configurado al iniciar:

```bash
npm run dev
```

Si ves este error, falta configurar el token:
```
❌ Missing required environment variables: MAPBOX_ACCESS_TOKEN
```

### 6. Funcionamiento

Una vez configurado, cuando un usuario envíe su ubicación GPS:

1. 📍 **Usuario envía ubicación GPS**
2. 🔍 **Bot dice**: "Detectando sector automáticamente..."
3. 🏘️ **Bot dice**: "Sector detectado: Villa Olímpica"
4. ✅ **Procesa la solicitud** con ubicación + sector automático

### 7. Fallback

Si Mapbox falla o no puede detectar el sector:
- El bot usará "Ubicación GPS" como sector
- La solicitud continuará normalmente
- No se interrumpe el flujo del usuario

### 8. Monitoreo de Uso

Puedes revisar tu uso en:
- [Mapbox Account Dashboard](https://account.mapbox.com/)
- Sección "API Usage"

## Troubleshooting

### Error: "Invalid access token"
- Verifica que el token esté bien copiado
- Asegúrate de usar el token público (comienza con `pk.`)

### Error: "Network timeout"
- El servicio tiene timeout de 10 segundos
- Si falla, usa el fallback automáticamente

### Error: "Rate limit exceeded"
- Espera unos minutos
- Revisa tu uso en el dashboard de Mapbox

## Soporte

Si tienes problemas:
1. Revisa que el token esté configurado correctamente
2. Verifica tu conexión a internet
3. Consulta los logs del bot para más detalles