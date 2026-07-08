# 05 — Función standalone (portal de Comerciales)

Función Deluge que crea un ticket en el módulo **Problemas** desde un origen
**externo al CRM** (el portal propio del área Comercial, que trabaja en la calle).

Reemplaza lo que hace el widget con `insertRecord`: arma el mismo payload y crea
el ticket. La clasificación, el título y el contador los sigue haciendo
`problemas_post_create`, que se dispara solo por el workflow.

## Qué recibe

Los mismos campos que manda el widget:

- `relacionadoCon` — valor del picklist Relacionado_con (`"Trato"`, `"Renovación"`…). Vacío = sin origen.
- `idOrigen` — ID del registro origen (string). Solo si hay `relacionadoCon`.
- `problema` — tipo de problema (texto exacto de la opción del picklist).
- `detalles` — texto libre.
- `prioridad` — `"Alta"`/`"Media"`/`"Baja"`. Vacío = automática (la resuelve el post-create).
- `reportadoPorId` — (opcional) ID de usuario CRM del comercial que reporta.

Devuelve un JSON: `{"ok":true,"id":"..."}` o `{"ok":false,"error":"..."}`.

## Cómo se dispara el workflow

El ticket se crea con `zoho.crm.createRecord("Problemas", dataMap, {"workflow"})`.
Ese `{"workflow"}` es lo que hace que corra **Problemas Post-Create**. Sin él, el
workflow no se ejecuta y el ticket queda sin clasificar.

## Subir a Zoho

Setup → Functions → nueva función standalone → nombre `problemas_create_standalone`
→ pegar el `.deluge`. Para que el portal la llame: pestaña **REST API** → generar la URL.

⚠️ La URL lleva API key. El portal debe llamarla **desde su backend**, no desde el
navegador (si la key queda en el JS del portal, cualquiera puede crear tickets).

## Pendientes

- **Adjuntos:** el widget adjunta archivo tras crear; esta versión todavía no. Falta
  definir cómo manda archivos el portal.
- **`Reportado_por`:** si el ticket tiene origen, el post-create pisa este campo con
  el dueño del legajo (no con el comercial). Decidir si se cambia. Ver comentario en el `.deluge`.
