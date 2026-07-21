# Workflows (reglas de Zoho CRM)

Reglas del módulo Problemas. Las capturas son la referencia visual; la config real
vive en Zoho (Setup → Automation → Workflow Rules).

| Regla | Se ejecuta al | Acción principal |
|---|---|---|
| `PostCreate_Problemas` | **Crear** un Problema | Corre la función `problemas_post_create` |
| `Asignación de problema` | **Modificar** (cambio de asignado) | Corre `notificar_asignacion` (aviso Cliq) |
| `Reapertura de ticket` *(no capturada)* | **Modificar** | Corre `problemas_reapertura` |

## Bug abierto en `Reapertura de ticket`

Hoy la regla tiene **dos** pasos en este orden: (1) acción de campo `Fase → Reabierto`
y (2) la función `problemas_reapertura`. La función arranca revalidando
`Fase == "Cerrado"`, pero como el paso 1 ya la pisó a `Reabierto`, esa condición nunca
se cumple y el cuerpo de la función no corre (no crea notas ni actualiza fechas). El
ticket igual se ve "Reabierto" porque lo hace la acción de campo, así que el bug pasa
desapercibido.

**Fix acordado:** eliminar la acción de campo del workflow y dejar que la función haga
el `updateMap.put("Fase","Reabierto")` que ya tiene en el código. Detalle en
`docs/bugs.md` (punto 1).
