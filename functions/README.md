# Funciones Deluge

Cada archivo `.deluge` = una función en Zoho (Setup → Functions).

| Archivo | Función en Zoho | Categoría | Auth | Dispara / usa | Código |
|---|---|---|---|---|---|
| `problemas_post_create.deluge` | Problemas post create | Asociado / Automatización | — | WF `PostCreate_Problemas` (al crear) | ✅ real |
| `problemas_create_standalone.deluge` | Problemas - Create Standalone | Independiente | Clave de API | Alta desde el Portal (vía n8n) | ✅ real |
| `notificar_asignacion.deluge` | Problemas - Notificar Asignación | Asociado / Automatización | — | WF `Asignación de problema` (al modificar) | ⬜ pegar |
| `problemas_reapertura.deluge` | Problemas - reapertura | Asociado / Automatización | — | WF `Reapertura de ticket` (al modificar) | ⬜ pegar |
| `reabrir_ticket_portal.deluge` | Problemas - Reabrir ticket portal | Independiente | Clave de API | Portal → n8n | ⬜ pegar |
| `buscar_legajo_portal.deluge` | Problema - Buscar legajo portal | Independiente | Clave de API | Portal → n8n | ⬜ pegar |
| `resolver_problema.deluge` | Resolver Problema | Asociado / Botón | — | Botón en detalle | ⬜ pegar |
| `listar_mis_tickets.deluge` | Problemas - Listar tickets portal | Independiente | OAuth2 + API | Webhook n8n `/listar-mis-tickets` | ⬜ pegar |
| `agregar_comentario.deluge` | Problemas - Agregar Comentario desde Portal | Independiente | Clave de API | Webhook n8n `/agregar-comentario` | ⬜ pegar |
| `listar_comentarios.deluge` | Problemas - Listar Comentarios en Portal | Independiente | Clave de API | Webhook n8n `/listar-comentarios` | ⬜ pegar |

**✅ real** = el código está en el archivo. **⬜ pegar** = es un stub con la ficha de la
función; falta pegar el cuerpo real copiado desde Zoho.

El corazón del módulo es `problemas_post_create`: los tres caminos de alta (botón,
standalone del portal, carga manual) disparan el workflow de creación, y ahí se
resuelve clasificación, título, contador, lookup al origen y el `Email` del reportante.
