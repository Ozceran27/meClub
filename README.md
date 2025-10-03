# meClub

## Resumen de club

meClub App

## Configuración de Google Maps

Para habilitar el mapa web necesitás exponer tu clave de Google Maps como una variable de entorno accesible para Expo:

```bash
export EXPO_PUBLIC_GOOGLE_MAPS_API_KEY="tu_clave_de_maps"
```

Al iniciar la aplicación con esa variable definida, el mapa mostrará la ubicación actual y permitirá arrastrar el marcador o hacer clic para seleccionar nuevas coordenadas.