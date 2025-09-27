# Guía de actualización para la columna `foto_logo`

Esta carpeta agrupa los recursos necesarios para mantener sincronizado el esquema de la base de datos de **meClub**. A continuación se documentan los pasos para extender la columna `foto_logo` cuando la aplicación necesita almacenar rutas largas o los binarios del logo del club.

## Conectarse a MySQL

```bash
mysql -h <host> -P <puerto> -u <usuario> -p meclub
```

Reemplazá los parámetros por los datos reales del entorno. El comando abrirá la consola interactiva de MySQL apuntando a la base `meclub`.

## Estrategia A: conservar rutas en disco (legado)

Si la instalación todavía persiste rutas públicas generadas por `logoUpload.middleware.js`, asegurate de que la columna acepte rutas largas:

```sql
ALTER TABLE clubes MODIFY COLUMN foto_logo TEXT NULL;
ALTER TABLE clubs_usuarios MODIFY COLUMN foto_logo TEXT NULL;
```

> `logoUpload.middleware.js` valida que los archivos subidos sean imágenes `image/png`, `image/jpeg` o `image/webp`, y con esta estrategia continúa guardando únicamente la ruta al archivo creado en disco.

## Estrategia B: almacenar el binario del logo (actual)

Cuando se migra a la persistencia binaria, el backend guarda directamente el buffer recibido por `logoUpload.middleware.js` en la base de datos. Ejecutá el siguiente ajuste para admitir blobs grandes:

```sql
ALTER TABLE clubes MODIFY COLUMN foto_logo LONGBLOB NULL;
ALTER TABLE clubs_usuarios MODIFY COLUMN foto_logo LONGBLOB NULL;
```

El middleware sigue restringiendo las cargas a `image/png`, `image/jpeg` y `image/webp`. El backend transforma esos buffers en *data URLs* al responder las APIs, por lo que el front-end puede seguir mostrando los logos sin depender de archivos en disco.

## Scripts y dumps

El archivo [`dump-meclub-202509261708.txt`](./dump-meclub-202509261708.txt) refleja la estructura actualizada utilizando `LONGBLOB` para `foto_logo` en las tablas `clubes` y `clubs_usuarios`. Si regenerás el dump o escribís nuevas migraciones, recordá mantener el mismo tipo de columna según la estrategia elegida.

