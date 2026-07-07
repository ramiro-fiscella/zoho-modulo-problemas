# Módulo Problemas — Zoho CRM

Sistema interno de gestión de tickets para GarantíaYa. Los usuarios reportan errores
técnicos, fallos de automatización o problemas de proceso desde los mismos módulos
en los que trabajan a diario, y el equipo de Sistemas/Administración los gestiona en
un módulo dedicado dentro del CRM.

Este repo tiene el **código y los workflows** del módulo. La **documentación funcional**
(campos, flujos, SLA, decisiones de negocio) vive en Notion, en la página
**"Módulo Problemas (Ex-Incidencias)"** y en el documento de proyecto.

---

## Qué hay acá

```
zoho-modulo-problemas/
└── Problemas/
    ├── README.md                            ← este archivo
    ├── ANALISIS.md                          ← estado del proyecto, pendientes, ideas
    ├── 01-boton-reportar-problema/          ← widget del botón dentro de cada módulo operativo
    ├── 02-ingreso-de-problemas/             ← widget standalone del módulo Ingreso de Problemas
    ├── 03-funcion-deluge/                   ← función post-create que corre al crear un ticket
    └── 04-workflows/                        ← capturas de los workflows configurados en Zoho
```

Cada carpeta numerada es un artefacto que se sube a Zoho por separado. Dos widgets,
una función, y los workflows que los pegan entre sí.

---

## Cómo se implementa

### 1. Widget del botón — dentro de cada módulo operativo

Carpeta: `01-boton-reportar-problema/`

Es el widget que se abre cuando el usuario aprieta 🔴 **Problema** desde un registro
de Tratos, Renovaciones, etc. Se abre directo sobre el registro — no pide elegir
módulo ni buscar legajo.

**Subir a Zoho:**
Setup → Developer Hub → Widgets → nuevo widget → Index File: `widget.html`.

**Configurar botón en cada módulo:**
Setup → Customization → Modules and Fields → módulo → Links and Buttons → nuevo
botón que abre este widget en una popup.

### 2. Widget de Ingreso de Problemas — módulo standalone

Carpeta: `02-ingreso-de-problemas/`

Widget para el módulo **Ingreso de Problemas**. Sirve cuando el usuario no puede o
no quiere abrir el ticket desde el módulo operativo (típicamente comerciales que no
tienen acceso a ciertos módulos, o alguien que quiere reportar sobre un legajo que
no gestiona).

El usuario elige el módulo, busca el legajo, y el widget hace lo mismo que el del
botón — pero desde otro punto de entrada.

**Subir a Zoho:** mismo procedimiento que el widget anterior, pero **como widget
separado**. Son dos widgets distintos.

### 3. Función Deluge — `problemas_post_create`

Carpeta: `03-funcion-deluge/`

Corre automáticamente cuando se crea un ticket en el módulo Problemas. Hace:

- Clasifica el ticket (Área afectada, Área responsable, Prioridad) según el tipo
  de problema. El mapeo son ~60 tipos agrupados en 14 categorías.
- Lee el registro origen y arma el título (`Problema N — [Código Legajo]`).
- Actualiza el contador de incidencias en el registro origen.
- Deja el lookup al registro origen en el ticket.
- Deja una nota en el registro origen avisando que se abrió una incidencia.

**Subir a Zoho:**
Setup → Developer Space → Functions → nueva función → nombre `problemas_post_create`,
argumento `problemaId` (String) → pegar el contenido de `problemas_post_create.deluge`.

### 4. Workflows

Carpeta: `04-workflows/`

Capturas de los workflows configurados en Zoho. Son la parte que dispara la función
Deluge y el resto de automatizaciones. No son código versionable (Zoho no exporta
workflows como archivo) — están acá como referencia visual.

**Los dos workflows principales:**

- **Problemas Post-Create.** Se dispara al crear un ticket en el módulo Problemas
  y llama a `problemas_post_create`.
- **Asignación problema.** Se dispara cuando el revisor completa el campo Propietario /
  Asignado. Completa la fecha de asignación, cambia la fase a "En curso" y crea la
  tarea para el gestor.

### 5. Configuración de módulo

El módulo **Problemas** y el grupo de campos **"Incidencias"** en cada módulo operativo
(Tratos, Renovaciones, Referidos, Comisiones, Riesgo, Operaciones, Incumplimientos) se
configuran a mano en Zoho. Los campos exactos están en el documento de proyecto en
Notion, sección "Módulo de Problemas — Campos".

---

## Estado actual

- ✅ Widget del botón funcionando.
- ✅ Widget de Ingreso de Problemas funcionando.
- ✅ Función post-create con clasificación automática de 60+ tipos.
- ✅ Fix del bug `data.User.id` que rompía el banner y los botones.
- 🐛 Bug abierto: el lookup al registro origen a veces no se completa. Por eso los
  logs `[DIAG 1]` a `[DIAG 6]` siguen en el Deluge. No se sacan hasta confirmar que
  el bug está resuelto en producción.
- ⏳ Botón Resolución + workflow de reapertura: todavía no están.
- ⏳ Notificaciones Cliq: código listo pero comentado.

Para el detalle completo del estado y qué falta, ver **[`ANALISIS.md`](./ANALISIS.md)**.

---

## Placeholders sin confirmar

En los widgets y en el Deluge hay campos de configuración marcados con **VERIFICAR**
que están puestos como placeholder (`"Name"` / `""`) porque no confirmamos los API
names reales de esos módulos en Zoho:

- Renovaciones
- Comisiones
- Riesgo
- Incumplimientos
- Inmobiliarias

Mientras no se confirmen, el título y el banner de contexto van a salir incompletos
para tickets creados desde esos módulos. **No rompe el flujo** (hay fallback), pero
se ve feo. Cuando confirmes un API name, avisá y se actualiza esa línea puntual en
los tres archivos.

**Referido y Cobranza:** tienen lookup en el módulo Problemas pero ningún widget los
ofrece como opción de origen. Hay que definir a qué módulo Zoho real corresponden
antes de activarlos.

---

## Convenciones del repo

- **Nada de sufijos de versión en el nombre de carpeta** (`v3`, `v5`). El historial
  lo da git. Si querés marcar un hito, se usa un tag (`v1.0-boton`), no se renombra.
- **Un commit, un cambio entendible.** Mensajes cortos y en modo:
  `fix: corrige bug data.User.id en botón`,
  `feat: agrega módulo Cobranza a modulosConfig`,
  `docs: actualiza README con campos confirmados de Riesgo`.
- **Los logs `[DIAG n]`** salen en un commit propio (`chore: remueve logs DIAG, bug
  resuelto`), no mezclados con otro cambio.
- **Placeholders `VERIFICAR`** no se tocan sin confirmar el API name real en Zoho.
- **Si tocás la config de módulos, tocá los tres archivos:** `app.js`,
  `widget_ingreso.js` y `problemas_post_create.deluge`. Están "sincronizados por
  comentario" y no hay forma de deduplicar en Zoho. Es frágil, hay que saberlo.

---

## Cómo trabajamos los cambios con Claude

Claude puede leer el repo público en cualquier momento — no hace falta pegarle el
código de nuevo, alcanza con decirle "mirá el widget X".

Lo que **no puede hacer hoy** es commitear directo. Así que el flujo por cambio es:

1. Le pedís el cambio.
2. Te devuelve el archivo editado completo (o un diff si es chico).
3. Vos hacés el commit y push.

---

## Checklist antes de dar un cambio por terminado

- [ ] ¿El código está en el archivo correcto (widget vs. función Deluge)?
- [ ] Si cambió qué subir o dónde, ¿lo actualicé en este README?
- [ ] ¿El cambio toca una decisión de negocio (SLA, picklist, asignación)?
  Si sí, también se refleja en el documento de proyecto en Notion.
- [ ] ¿Quedó algún placeholder o TODO nuevo? Anotarlo en `ANALISIS.md` o en la
  tabla de Decisiones Pendientes del documento de proyecto.

---

## Documentación relacionada

- **Documento de proyecto** — "Proyecto para Sistema de Gestión de Tickets en Zoho CRM".
  Visión general, campos completos, flujo operativo, SLA, decisiones pendientes.
- **Notion — "Módulo Problemas (Ex-Incidencias)"**. Documentación funcional al día. https://app.notion.com/p/M-dulo-Problemas-Ex-Incidencias-375de18b712c80e98db7ecc841989069
- **[`ANALISIS.md`](./ANALISIS.md)** — puesta al día del estado, pendientes y mejoras a futuro.
