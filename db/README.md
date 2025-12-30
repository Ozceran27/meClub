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

## Ampliar horario nocturno de los clubes

Cuando necesites habilitar tarifas nocturnas en el panel de reservas asegurate de agregar las columnas `hora_nocturna_inicio` y `hora_nocturna_fin` en la tabla `clubes`. Desde DBeaver (o cualquier cliente MySQL compatible) podés ejecutar el siguiente script:

```sql
ALTER TABLE clubes
  ADD COLUMN hora_nocturna_inicio TIME NULL AFTER precio_grabacion,
  ADD COLUMN hora_nocturna_fin TIME NULL AFTER hora_nocturna_inicio;
```

Ambos campos aceptan valores nulos para conservar el comportamiento actual en instalaciones que todavía no definen un rango nocturno. Una vez ejecutado el cambio, recordá actualizar los formularios del panel para completar las horas utilizando el formato `HH:MM`.

## Normalizar `estado_pago` en `reservas`

Para que las reservas usen únicamente los estados de pago acordados (`pendiente_pago`, `senado`, `pagado`, `cancelado`) normalizá los datos históricos y luego ajustá el tipo de columna:

```sql
UPDATE reservas
SET estado_pago = 'pendiente_pago'
WHERE estado_pago IN ('sin_abonar', 'pendiente', 'pendiente_pago', 'sin_pagar');

UPDATE reservas
SET estado_pago = 'senado'
WHERE estado_pago IN ('senado', 'senia', 'senia_parcial', 'senia_total', 'seña', 'seña_parcial', 'seña_total');

UPDATE reservas
SET estado_pago = 'pagado'
WHERE estado_pago IN (
  'pagado', 'pagada', 'pagada_parcial', 'pagada_total', 'pago', 'pago_parcial',
  'abonada', 'abonado', 'abonada_parcial', 'abonado_parcial', 'abonada_total', 'abono'
);

UPDATE reservas
SET estado_pago = 'cancelado'
WHERE estado_pago IN ('rechazado', 'cancelado', 'cancelada');

ALTER TABLE reservas
  MODIFY COLUMN estado_pago ENUM('pendiente_pago', 'senado', 'pagado', 'cancelado')
  NOT NULL DEFAULT 'pendiente_pago';
```

El dump `dump-meclub-202511211351.txt` refleja esta enumeración actualizada.

El backend normaliza los valores históricos y usa `pendiente_pago` como estado por defecto, aceptando alias comunes como
`pendiente` o `sin_abonar` siempre que se mapeen a los valores de la enumeración anterior.

## Índice único para `club_servicios` (`club_id`, `nombre`)

Antes de crear el índice único, detectá si existen servicios duplicados por club para poder decidir una estrategia (merge, renombrar o eliminar). Podés ejecutar las siguientes consultas:

```sql
SELECT club_id, nombre, COUNT(*) AS cantidad
FROM club_servicios
GROUP BY club_id, nombre
HAVING COUNT(*) > 1;
```

Una vez identificados, aplicá la estrategia elegida. Por ejemplo:

- **Merge:** unificá atributos en un único registro y eliminá los duplicados.
- **Renombrar:** ajustá el campo `nombre` para conservar todos los registros.
- **Eliminar:** remové los duplicados y conservá el registro correcto.

Luego de limpiar los datos, creá el índice único:

```sql
ALTER TABLE club_servicios
  ADD UNIQUE KEY uniq_club_servicios_club_nombre (club_id, nombre);
```
