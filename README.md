# meClub

## Resumen de club

El backend expone la ruta `GET /api/clubes/:club_id/resumen`.
Devuelve un objeto `data` con los siguientes campos:

- `courtsAvailable`: cantidad de canchas registradas para el club.
- `reservasHoy`: reservas del día actual.
- `reservasSemana`: reservas realizadas en la semana actual.
- `economiaMes`: monto total de reservas del mes en curso.

Ejemplo:

```bash
curl http://localhost:3006/api/clubes/1/resumen
```

```json
{
  "data": {
    "courtsAvailable": 3,
    "reservasHoy": 0,
    "reservasSemana": 5,
    "economiaMes": 12000
  }
}
```


