# n8n — puente Portal Asesores ↔ Zoho

El Portal Asesores (Replit) no le pega directo a Zoho: pasa por **n8n**, que expone
webhooks HTTP y adentro llama a la función Deluge correspondiente por REST, parsea la
salida y responde JSON.

**Instancia:** `https://app.garantiaya.com.ar`
**Patrón de cada flujo:** `Webhook (POST)` → `HTTP a función Zoho` → `Code (parsea details.output)` → `Respond to Webhook`

## Webhooks

| Webhook (producción) | Función Zoho | Body | Respuesta |
|---|---|---|---|
| `POST /webhook/listar-mis-tickets` | `listar_mis_tickets` | `{ comercialMail }` | `{ ok, tickets:[...] }` |
| `POST /webhook/agregar-comentario` | `problemas_agregar_comentario` | `{ ticketId, comercialMail, texto }` | `{ ok, id }` |
| `POST /webhook/listar-comentarios` | `problemas_listar_comentarios` | `{ ticketId }` | `{ ok, comentarios:[...] }` |
| `POST /webhook/…` *(alta de ticket)* | `problemas_create_standalone` | payload del widget | `{ ok, id }` |
| `POST /webhook/…` *(buscar legajo)* | `buscar_legajo_portal` | `{ modulo, texto }` | `{ ok, resultados:[...] }` |
| `POST /webhook/…` *(reabrir)* | `reabrir_ticket_portal` | `{ ticketId, comercialMail, motivo }` | `{ ok }` |

Los tres primeros paths están **confirmados** en producción. Los tres de abajo existen
como función pero su path exacto de webhook está **a confirmar** — actualizar acá cuando
se verifique.

## Notas operativas

- Test vs producción: hasta activar el workflow los webhooks quedan en `/webhook-test/…`;
  al activarlo pasan a `/webhook/…` (las que usa el portal).
- Editar un workflow **activo** lo baja y sube un instante y tira todos sus webhooks.
  Por eso comentarios va en un workflow aparte de `listar-mis-tickets` (producción diaria).
- Cada función Zoho independiente tiene **su propia** `zapikey`; no se reutiliza entre nodos.

## Archivos

Exportar cada workflow desde n8n (**⋯ → Download**) y dejar el `.json` acá para tener el
cableado versionado. Pendiente subir: `problemas-comentarios.json`, `listar-mis-tickets.json`
y el de alta/legajo/reabrir.
