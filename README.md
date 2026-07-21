# Módulo Problemas — Zoho CRM

Sistema interno de tickets de GarantíaYa. Los comerciales reportan errores técnicos,
fallos de automatización o problemas de proceso; Sistemas/Administración los gestiona
en un módulo dedicado del CRM. Los comerciales también los ven y comentan desde un
**Portal** propio.

## Mapa

```
widgets/          Widgets del CRM (front dentro de Zoho)
  reportar-problema/    botón "Reportar Problema" (por módulo y dentro de Problemas)
  ingreso-de-problemas/ widget standalone (legacy, absorbido por el botón)
functions/        Funciones Deluge (una por archivo · ver functions/README.md)
workflows/        Reglas de workflow de Zoho (+ capturas)
n8n/              Webhooks que conectan el Portal con Zoho
portal-asesores/  Portal Replit: contrato de datos e integración (código en Replit)
docs/             Análisis, roadmap, bugs y videos demo
```

## Flujo en una línea

**Alta** (botón CRM · portal · manual) → workflow `PostCreate_Problemas` →
`problemas_post_create` clasifica, titula, cuentea, linkea al origen y setea el `Email`.
**Portal** lista/crea/comenta/reabre vía **n8n** → funciones Deluge.

## Estado

- ✅ En producción: alta por botón, post-create, portal (listar/crear/comentar).
- 🐞 Bugs abiertos y fixes acordados: `docs/bugs.md`. Pendientes: `docs/ROADMAP.md`.

## Cómo se despliega

Cada carpeta de `widgets/` se sube como su widget en Zoho; cada `.deluge` de `functions/`
es una función; las reglas de `workflows/` se configuran en Setup → Automation.
