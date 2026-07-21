# Portal Asesores (Replit)

Front-end externo al CRM donde los comerciales ven **sus** tickets, cargan nuevos,
reabren y comentan. El código vive en Replit (no en este repo); acá queda la
**referencia de integración** para que backend y front no se desincronicen.

Portal → **n8n** (`app.garantiaya.com.ar/webhook/…`) → **funciones Zoho**. Ver `../n8n`.

## Contrato de datos — objeto `ticket`

El listado recibe `{ ok, tickets: [...] }`. Cada ticket trae estos campos (todos
`string`; cuando no hay dato viene `""`, nunca `null`):

| Campo | Ejemplo | Notas |
|---|---|---|
| `id` | `"5260683000378076032"` | ID del registro (para comentarios/reabrir) |
| `codigo` | `"PRB-0049"` | Título de la card |
| `tipo` | `"Comisión no entregada…"` | Descripción del problema |
| `fase` | `"Abierto"` | `Abierto` · `En curso` · `Cerrado` · `Reabierto` |
| `prioridad` | `"Media"` | `Alta` · `Media` · `Baja` · `""` |
| `relacionadoCon` | `"Trato"` | puede venir `""` |
| `areaAfectada` | `"Administración"` | puede venir `""` |
| `fechaCreacion` | `"2026-07-17T14:42:54-03:00"` | ISO datetime, camelCase exacto |
| `detalles` | `"El cliente reclama…"` | |
| `resolucion` | `"Otro"` | puede venir `""` o `"-None-"` |
| `detallesResolucion` | `"Se corrigió…"` | |
| `asignadoNombre` | `"Juan Pérez"` | `""` si sin asignar |
| `asignadoEmail` | `"juan@garantiaya.com.ar"` | `""` si sin asignar |

## Comentarios (por card, carga on-demand)

- Listar → `POST /webhook/listar-comentarios` con `{ ticketId }`
- Agregar → `POST /webhook/agregar-comentario` con `{ ticketId, comercialMail, texto }`

Comentario → `{ id, autor (mail), texto, fecha (ISO) }`. Sin comentarios: `[]`.

## Reglas que sostienen la integración

- El `Email` con que el portal filtra es la **clave** del asesor. Se guarda y se busca
  **en minúscula y trimeado** en todos los caminos de alta, o el ticket queda invisible.
- No inventar campos ni endpoints: usar exactamente los nombres de arriba.
- El listado (`listar_mis_tickets`) filtra por `Email:equals`; no cambiar ese filtro
  (`Owner`/`Created_By` no sirven porque el dueño se reasigna en triage).
