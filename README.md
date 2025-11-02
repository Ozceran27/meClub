# meClub

## Resumen de club

meClub App

## Configuración de Google Maps

Para habilitar el mapa web necesitás exponer tu clave de Google Maps como una variable de entorno accesible para Expo:

```bash
export EXPO_PUBLIC_GOOGLE_MAPS_API_KEY="tu_clave_de_maps"
export EXPO_PUBLIC_GOOGLE_MAPS_MAP_ID="tu_map_id_de_maps"
```

Podés agregar estas variables en un archivo `.env` ubicado en la raíz del proyecto para que Expo las cargue automáticamente.

Al iniciar la aplicación con esas variables definidas, el mapa mostrará la ubicación actual y permitirá arrastrar el marcador o hacer clic para seleccionar nuevas coordenadas. Con el `EXPO_PUBLIC_GOOGLE_MAPS_MAP_ID` configurado, la aplicación utilizará los **Advanced Markers**; si omitís esa variable se mostrará el marcador clásico automáticamente.

## API de usuarios

### `GET /api/usuarios/buscar`

Permite a los clubes buscar jugadores cuyo nombre, apellido, email o teléfono coincidan con el término enviado en el parámetro `q`.

- **Autenticación**: requiere `Bearer token` válido y rol `club`.
- **Parámetros de consulta**:
  - `q` (string, requerido): al menos 3 caracteres.
  - `limit` (número, opcional): cantidad máxima de registros (por defecto 10, máximo 25).

#### Respuestas de error

- `400 Bad Request`: cuando `q` tiene menos de 3 caracteres.
- `429 Too Many Requests`: reservado para cuando se active rate limiting sobre este recurso.
