# Módulo Problemas — análisis y hoja de ruta

> Foto del repo al día de hoy, contrastado contra el documento de proyecto.
> No es documentación funcional (eso vive en Notion). Es una puesta al día para
> saber por dónde vamos y qué falta.

---

## Lo que ya está andando

- **Botón "Reportar Problema" en cada módulo operativo** (`01-boton-reportar-problema/`).
- **Botón "Reportar Problema" dentro del módulo Problemas** (`02-ingreso-de-problemas/`,
  nombre de carpeta legado — el módulo separado ya no existe).
- **Función `problemas_post_create`** con clasificación automática de 60+ tipos en
  14 grupos.
- **Clasificación aprobada** — el mapeo Tipo → Área afectada / Área responsable /
  Prioridad ya está cerrado a nivel decisión. Si cambia, se toca directo en el Deluge.
- **Unificación de acceso.** El módulo "Ingreso de Problemas" se eliminó, el botón
  vive ahora dentro del propio módulo Problemas con el mismo nombre que en los
  módulos origen. Menos confusión, todo en un mismo lugar.
- **Fix del bug `data.User.id`** que rompía el banner y los botones del widget de
  módulos origen.

---

## Lo que queda por hacer

### Bloqueante para cerrar la Etapa 1

- **Bug del lookup al registro origen.** A veces no se completa. Por eso están los
  logs `[DIAG 1]`–`[DIAG 6]` en el Deluge. Hasta que no se confirme resuelto en
  producción, no se sacan.
- **Borrado de los campos del grupo "Incidencias"** en el registro origen después
  de crear el ticket (`Problema`, `Detalles_problema`, `Problema_validado`). El
  Deluge actualiza el contador pero no limpia estos tres campos. Puede estar en un
  workflow que no está en el repo — hay que verificar.
- **Botón 🟢 Resolución** y su lógica de cierre. Todavía no existe archivo para esto.
- **Workflow de reapertura** + notificaciones. Tampoco.
- **Notificaciones Cliq** — el código está comentado en el Deluge, listo para activar.

### Placeholders sin resolver

- `campoLegajo` / `campoFase` de **Renovaciones, Comisiones, Riesgo, Incumplimientos
  e Inmobiliarias**. Hoy están como `"Name"` / `""` en los tres archivos (dos widgets
  + Deluge). Mientras no se confirmen los API names reales, el banner y el título
  de esos módulos salen incompletos. No rompe el flujo — usa fallback — pero se ve
  feo.
- **"Referido" y "Cobranza"** tienen lookup en Problemas pero ningún widget los
  ofrece como opción. Hay que decidir si se activan o se sacan del schema.

### Decisiones de negocio pendientes (no dependen del código)

- SLA por prioridad.
- Perfiles con acceso al botón "Reportar Problema" dentro del módulo Problemas
  (antes era el acceso al módulo Ingreso de Problemas — misma discusión, distinto
  formato).

### Documentación desactualizada

- La sección **§8 del documento de proyecto** ("Módulo de Ingreso de Problemas")
  quedó desactualizada al eliminar ese módulo. Hay que reescribirla — o directamente
  quitarla — reflejando que ahora es un segundo botón dentro del módulo Problemas.

---

## Lo que se puede mejorar sin cambiar el alcance

### Higiene del repo

- `Problemas.zip` y `desktop.ini` no deberían estar versionados. Con un `.gitignore`
  con `*.zip` y `desktop.ini` alcanza.
- **Renombrar `02-ingreso-de-problemas/`** a algo que refleje lo que hace hoy
  (`02-boton-reportar-problema-standalone/` o similar). No es urgente pero el nombre
  actual es engañoso porque apunta a un módulo que ya no existe. Cuando se haga, va
  en un commit propio: `refactor: renombra carpeta 02, el módulo Ingreso ya no existe`.
- La carpeta `04-workflows/` no estaba mencionada en el README anterior. Ahora sí.

### Duplicación de configuración

La config de módulos vive en tres lugares: `app.js`, `widget_ingreso.js` y el Deluge.
Están "sincronizados por comentario". Es frágil: si tocás uno y te olvidás de los
otros dos, se rompe en silencio.

No hay forma limpia de deduplicar en Zoho (no hay un lugar único de configuración
compartido entre widgets y funciones), pero al menos se puede dejar el checklist en
el README: **si tocás MODULO_CONFIG, tocá los tres archivos.**

### Código muerto o inconsistente

- La clave `"Garantía"` en el Deluge (línea 23) está por compatibilidad con datos
  viejos, pero ningún widget la produce. Si no hay tickets legacy con ese valor,
  se puede sacar.
- En `widget_ingreso.js` la clave del select es `"Contactos"` (con S) y en `app.js`
  es `"Contacts"`. Ambos resuelven a `"Contacts"` como módulo real, así que no rompe.
  Unificar como `Contacts` evita confusión futura.

### Tabla de clasificación

Los 14 maps + fusión con `for each` ocupan ~120 líneas del Deluge. Funciona, pero
cualquier cambio de picklist implica editar código.

Alternativa a futuro: migrar el mapeo a un **módulo auxiliar "Tipos de Problema"**
o a un **Custom Setting** de Zoho, con campos Área afectada / Área responsable /
Prioridad. Así un líder puede ajustar sin abrir Deluge. Vale la pena solo si el
mapeo va a moverse seguido.

---

## Ideas a futuro (Etapas 2 a 5 del documento de proyecto)

Ordenadas por retorno vs. esfuerzo:

1. **Gestión desde la tarea** (Etapa 3). Que el gestor pueda resolver sin abrir el
   ticket, completando la tarea de Zoho. Es el cambio que más mueve la adopción en
   operaciones y administración.
2. **Tablero de métricas.** Nada mide todavía qué tipos son más recurrentes, tiempo
   real de resolución, quién resuelve más, cuántos se reabren. Con una vista + un
   par de fórmulas ya hay tablero básico. Es lo primero que va a pedir un líder a
   los dos meses de uso.
3. **Documentación inteligente en el cierre** (Etapa 5). Arrancar por la Opción A
   (tabla en Notion mapeando Tipo → link de doc). Es barata y sirve de piso para
   pasar a n8n o Claude API después.
4. **UX del reporte** (Etapa 4). Pop-up desde el registro origen en vez de scroll
   hasta el grupo de campos. Se justifica solo si se mide que la fricción está
   frenando reportes.

---

## Secuencia recomendada

1. Cerrar el bug del lookup y sacar los `[DIAG]`.
2. Confirmar los API names de los cinco módulos placeholder (una tarde de laboratorio).
3. Sumar botón Resolución + workflow de reapertura para completar la Etapa 1.
4. Prender Cliq.
5. Actualizar la §8 del documento de proyecto para reflejar que "Ingreso de
   Problemas" ya no es un módulo.
6. Renombrar la carpeta `02-ingreso-de-problemas/`.
7. Tablero de métricas.
8. Recién ahí, cualquier mejora de UX o de las Etapas 3+.
