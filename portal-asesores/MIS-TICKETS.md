# Mis Tickets — Portal Asesores (GarantíaYa)

## ¿Qué es?

Sección del Portal de Asesores donde cada comercial puede ver los tickets de soporte que reportó, consultar su estado, dejar comentarios y solicitar la reapertura de los tickets cerrados.

---

## Acceso

Disponible para todos los perfiles (asesor, lider, admin e invitado). Se accede desde el menú lateral con el ícono 🎫 o desde la barra de navegación en modo invitado.

**Ruta:** `/mis-tickets`

---

## Funcionalidades

### 1. Listado de tickets

Al entrar a la sección se carga automáticamente la lista de tickets del comercial logueado (identificado por su mail). Los tickets se ordenan por ID descendente (más nuevo primero).

**Filtro por fase:** selector en la parte superior. Opciones:
- Todos (sin filtro)
- Abierto
- En curso
- Cerrado
- Reabierto

Al cambiar el filtro se recarga el listado con la fase seleccionada. También hay un botón **Actualizar** para refrescar manualmente.

---

### 2. Card de cada ticket

Cada ticket se muestra como una card con la siguiente información:

| Sección | Contenido |
|---|---|
| **Título** | `Ticket {codigo}` (ej. `Ticket PRB-0049`). Si no hay código, muestra solo `Ticket`. |
| **Badge de fase** | Indica la fase actual con color: verde (Abierto), azul (En curso), gris (Cerrado), rojo (Reabierto). |
| **Prioridad** | Alta / Media / Baja en color (rojo / naranja / amarillo). Solo si tiene valor. |
| **Subtítulo** | Tipo de problema. Si viene vacío, muestra *"Sin tipo especificado"* en gris. |
| **Detalle** | Descripción del problema, si la hay. |
| **Metadata** | Relacionado con · Área (solo si tienen valor). |
| **Fechas** | Creada · Asignada · Cerrada en formato `dd/mm/aaaa HH:mm`. Si una fecha no aplica, muestra `—`. |
| **Resolución** | Bloque verde visible **solo en tickets Cerrado**. Muestra el detalle de la resolución. Si no hay detalle, muestra *"Sin detalle de resolución"*. |

---

### 3. Reabrir ticket

Solo disponible en tickets con fase **Cerrado**. Aparece un botón **Reabrir** en la cabecera de la card.

**Flujo:**
1. El comercial hace click en **Reabrir**.
2. Se abre un modal con el código del ticket y un textarea para el **motivo** (obligatorio).
3. Si el textarea está vacío, no se puede confirmar (validación en el front).
4. Al confirmar, se llama al webhook `reabrir-ticket`.
5. Si la reapertura es exitosa, se cierra el modal y se recarga el listado (el ticket ahora aparece en fase *Reabierto*).
6. Si hay un error, se muestra el mensaje del backend en el modal sin cerrarlo.

---

### 4. Comentarios

Cada card tiene una sección de comentarios que **se carga por demanda** (no al abrir el listado). Esto evita llamadas innecesarias al backend.

**Flujo para ver comentarios:**
1. El comercial hace click en **Ver comentarios**.
2. Se llama al webhook `listar-comentarios` con el ID del ticket.
3. Se despliega la lista de comentarios existentes con: autor (parte antes del `@`), fecha (`dd/mm/aaaa HH:mm`) y texto.
4. Si no hay comentarios, muestra *"Todavía no hay comentarios"*.
5. El panel se puede contraer con **Ocultar comentarios**.

**Flujo para agregar un comentario:**
1. En el pie del panel hay un textarea y el botón **Comentar**.
2. El botón está deshabilitado si el textarea está vacío.
3. Al enviar: el botón muestra *"Enviando..."* y se deshabilita.
4. Si el envío es exitoso: se limpia el textarea y se refresca la lista de comentarios de esa card.
5. Si hay error: se muestra en rojo **sin borrar** lo que el comercial escribió.

---

## Webhooks utilizados

| Webhook | Método | URL | Cuándo se llama |
|---|---|---|---|
| `listar-mis-tickets` | POST | `https://app.garantiaya.com.ar/webhook/listar-mis-tickets` | Al entrar a la sección, al cambiar el filtro, al actualizar, y después de reabrir un ticket. |
| `reabrir-ticket` | POST | `https://app.garantiaya.com.ar/webhook/reabrir-ticket` | Al confirmar la reapertura desde el modal. |
| `listar-comentarios` | POST | `https://app.garantiaya.com.ar/webhook/listar-comentarios` | Al hacer click en "Ver comentarios" de una card, y al enviar un comentario nuevo. |
| `agregar-comentario` | POST | `https://app.garantiaya.com.ar/webhook/agregar-comentario` | Al confirmar el envío de un comentario. |

---

## Contrato de datos

### `listar-mis-tickets`

**Body enviado:**
```json
{ "mail": "asesor@garantiaya.com.ar", "fase": "Abierto" }
```
`fase` puede ser `""` para traer todos.

**Respuesta esperada:**
```json
{
  "ok": true,
  "tickets": [
    {
      "id": "5891000000123456",
      "codigo": "PRB-0049",
      "tipo": "Comisión no entregada a tiempo",
      "fase": "Abierto",
      "prioridad": "Media",
      "relacionadoCon": "Trato",
      "areaAfectada": "Administración",
      "fechaCreacion": "2026-07-17T14:42:54-03:00",
      "fechaAsignacion": "2026-07-17T16:00:00-03:00",
      "fechaCierre": "",
      "detalles": "El cliente reclama...",
      "resolucion": "Otro",
      "detallesResolucion": "",
      "asignadoNombre": "Juan Pérez",
      "asignadoEmail": "juan@garantiaya.com.ar"
    }
  ]
}
```

Todos los campos son `string`. Cuando no hay dato, el valor es `""`.

### `reabrir-ticket`

**Body enviado:**
```json
{ "ticketId": "5891000000123456", "mail": "asesor@garantiaya.com.ar", "motivo": "El problema volvió a ocurrir." }
```

**Respuesta éxito:** `{ "ok": true, "mensaje": "Ticket reabierto correctamente." }`

**Respuesta error:** `{ "ok": false, "error": "Solo se puede reabrir un ticket que este en fase 'Cerrado'." }`

### `listar-comentarios`

**Body enviado:** `{ "ticketId": "5891000000123456" }`

**Respuesta:**
```json
{
  "ok": true,
  "comentarios": [
    { "id": "...", "autor": "asesor@garantiaya.com.ar", "texto": "...", "fecha": "2026-07-17T21:14:42+02:00" }
  ]
}
```

### `agregar-comentario`

**Body enviado:**
```json
{ "ticketId": "5891000000123456", "comercialMail": "asesor@garantiaya.com.ar", "texto": "Texto del comentario." }
```

**Respuesta éxito:** `{ "ok": true, "id": "..." }`

**Respuesta error:** `{ "ok": false, "error": "..." }`

---

## Modo Invitado

La sección funciona igual para el perfil Invitado. El mail del comercial se toma del parámetro `mail` de la URL de acceso (en lugar de la sesión de Supabase), por lo que el invitado ve sus propios tickets sin necesidad de tener una cuenta en el portal.
