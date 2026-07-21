# Widgets del CRM

| Carpeta | Widget en Zoho | Qué es |
|---|---|---|
| `reportar-problema/` | Botón "Reportar Problema" | Aparece en cada módulo operativo (resuelve el origen por contexto) y dentro de Problemas (elegís módulo + buscás legajo). **Es el vigente.** |
| `ingreso-de-problemas/` | Widget "Ingreso de Problemas" | Standalone antiguo. Su función quedó absorbida por el botón; se conserva como referencia. |

`MODULO_CONFIG` (en `app.js` y `widget_ingreso.js`) debe quedar sincronizado con
`modulosConfig` de `problemas_post_create`. Los `campoNombre`/`campoFase` marcados
`VERIFICAR` son placeholders: si el API name no existe, el banner muestra "—" pero no
rompe el alta. Ver `../docs/bugs.md` (puntos 2, 3 y 10).
