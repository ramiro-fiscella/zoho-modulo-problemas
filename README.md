# Módulo Problemas — Zoho CRM

Sistema interno de gestión de tickets para GarantíaYa. Los usuarios reportan errores
técnicos, fallos de automatización o problemas de proceso, y el equipo de
Sistemas/Administración los gestiona en un módulo dedicado dentro del CRM.

Este repo tiene el **código y los workflows** del módulo. La **documentación funcional**
(campos, flujos, SLA, decisiones de negocio) vive en Notion, en la página
**"Módulo Problemas (Ex-Incidencias)"** y en el documento de proyecto.

## Reportar Problema desde el módulo "Problemas"

https://github.com/user-attachments/assets/aee9947a-19e3-4b2c-bc77-451bc247fde3

## Reportar Problema desde un Trato

https://github.com/user-attachments/assets/26c2a7cf-1573-47d5-bbf8-f1eb7397e2fb

---

## Cómo se accede

Hay un único botón, se llama **Reportar Problema**, y aparece en dos lugares:

- **Dentro de cada módulo operativo** (Tratos, Renovaciones, Referidos, Comisiones,
  Riesgo, Operaciones, Incumplimientos, Inmobiliarias, Contactos). Se abre sobre el
  registro que estás viendo — no pide elegir módulo ni buscar legajo.
- **Dentro del propio módulo Problemas.** El usuario elige el módulo y busca el
  legajo a mano. Sirve cuando queremos reportar algo sobre un legajo que no tenemos
  abierto, o cuando el usuario no tiene acceso al módulo operativo (por ejemplo un
  comercial reportando sobre Riesgo).

Es el mismo botón conceptualmente y hace lo mismo — solo cambia si el registro
origen viene resuelto por contexto o si hay que buscarlo. Todo en un mismo lugar
para el usuario, sin módulos aparte ni saltar entre pantallas.

> **Nota:** en versiones anteriores del sistema existía un módulo separado llamado
> **"Ingreso de Problemas"**. Ya no existe — su funcionalidad quedó absorbida como
> segundo botón dentro del módulo Problemas. Si ves referencias a ese módulo en el
> documento de proyecto o en Notion, están desactualizadas.

---

## Qué hay en el repo

```
zoho-modulo-problemas/
└── Problemas/
    ├── README.md                            ← este archivo
    ├── ANALISIS.md                          ← estado, pendientes, ideas
    ├── 01-boton-reportar-problema/          ← widget del botón en módulos origen
    ├── 02-ingreso-de-problemas/             ← widget del botón dentro del módulo Problemas
    │                                          (nombre de carpeta legado — ver nota abajo)
    ├── 03-funcion-deluge/                   ← función post-create
    └── 04-workflows/                        ← capturas de los workflows de Zoho
```

> El nombre de carpeta `02-ingreso-de-problemas/` es legado del módulo que ya no
> existe. La carpeta sigue conteniendo el código correcto (el segundo widget), solo
> quedó con el nombre viejo. Cuando toque, se renombra en un commit propio a algo
> como `02-boton-reportar-problema-standalone/` — no urgente, no bloquea nada.

---

## Cómo se implementa

### 1. Widget de Reportar Problema — módulos origen

Carpeta: `01-boton-reportar-problema/`

**Subir a Zoho:**
Setup → Developer Hub → Widgets → nuevo widget → Index File: `widget.html`.

**Configurar el botón en cada módulo operativo:**
Setup → Customization → Modules and Fields → módulo → Links and Buttons → nuevo
botón "Reportar Problema" que abre este widget en una popup.

Módulos donde va: Tratos, Renovaciones, Referidos, Comisiones, Riesgo, Operaciones,
Incumplimientos, Inmobiliarias, Contactos.

### 2. Widget de Reportar Problema — módulo Problemas

Carpeta: `02-ingreso-de-problemas/`

Es un widget separado del anterior aunque hace algo parecido: el usuario elige el
módulo, busca el legajo, y crea el ticket. Se sube **como widget aparte** en Zoho.

**Subir a Zoho:** mismo procedimiento que el widget anterior, pero como widget
distinto.

**Configurar el botón:**
Setup → Customization → Modules and Fields → **Problemas** → Links and Buttons →
nuevo botón "Reportar Problema" que abre este widget.

### 3. Función Deluge — `problemas_post_create`

Carpeta: `03-funcion-deluge/`

Corre automáticamente cuando se crea un ticket en el módulo Problemas. Hace:

- Clasifica el ticket (Área afectada, Área responsable, Prioridad) según el tipo
  de problema. Son ~60 tipos agrupados en 14 categorías.
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

### 5. Configuración del módulo

El módulo **Problemas** y el grupo de campos **"Incidencias"** en cada módulo
operativo se configuran a mano en Zoho. Los campos exactos están en el documento
de proyecto, sección "Módulo de Problemas — Campos".

---

## Estado actual

- ✅ Widget del botón en módulos origen funcionando.
- ✅ Widget del botón dentro del módulo Problemas funcionando.
- ✅ Función post-create con clasificación automática de 60+ tipos.
- ✅ Unificación de acceso: un solo nombre de botón ("Reportar Problema"), sin
  módulo separado.
- ✅ Fix del bug `data.User.id` que rompía el banner y los botones.
- 🐛 Bug abierto: el lookup al registro origen a veces no se completa. Por eso los
  logs `[DIAG 1]` a `[DIAG 6]` siguen en el Deluge. No se sacan hasta confirmar que
  el bug está resuelto en producción.
- ⏳ Botón Resolución + workflow de reapertura: todavía no están.
- ⏳ Notificaciones Cliq: código listo pero comentado.

Para el detalle completo del estado y qué falta, ver **[`ANALISIS.md`](./ANALISIS.md)**.

---

## Placeholders sin confirmar

En los widgets y en el Deluge hay campos marcados con **VERIFICAR** que están como
placeholder (`"Name"` / `""`) porque no confirmamos los API names reales de:

- Renovaciones
- Comisiones
- Riesgo
- Incumplimientos
- Inmobiliarias

Mientras no se confirmen, el título y el banner de contexto salen incompletos para
tickets creados desde esos módulos. **No rompe el flujo** (hay fallback), pero se ve
feo. Cuando confirmes un API name, avisá y se actualiza esa línea puntual en los
tres archivos.

**Referido y Cobranza:** tienen lookup en el módulo Problemas pero ningún widget los
ofrece como opción de origen. Hay que definir a qué módulo Zoho real corresponden
antes de activarlos.

---

## Convenciones del repo

- **Nada de sufijos de versión en el nombre de carpeta** (`v3`, `v5`). El historial
  lo da git. Si querés marcar un hito, se usa un tag (`v1.0-boton`).
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
  Si sí, también se refleja en el documento de proyecto y en Notion.
- [ ] ¿Quedó algún placeholder o TODO nuevo? Anotarlo en `ANALISIS.md` o en la
  tabla de Decisiones Pendientes del documento de proyecto.

---

## Documentación relacionada

- **Documento de proyecto** — "Proyecto para Sistema de Gestión de Tickets en Zoho CRM".
  ⚠️ La sección §8 "Módulo de Ingreso de Problemas" está desactualizada — ese módulo
  ya no existe, se reemplazó por el segundo botón en el módulo Problemas.
- **Notion — "Módulo Problemas (Ex-Incidencias)"**. Documentación funcional al día. https://app.notion.com/p/M-dulo-Problemas-Ex-Incidencias-375de18b712c80e98db7ecc841989069
- **[`ANALISIS.md`](./ANALISIS.md)** — estado, pendientes y mejoras a futuro.
