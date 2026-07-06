# Módulo Problemas — Archivos

Esto reemplaza todo lo que había antes en esta carpeta. Son los únicos archivos vigentes.
Todo lo demás (versiones viejas, pruebas, duplicados) se puede borrar.

---

## 01-boton-reportar-problema/  (v3)

El botón que va **dentro de cada módulo operativo** (Tratos, Renovaciones, etc.).
Se abre automático sobre el registro — no pide elegir módulo ni buscar legajo.

Subir a Zoho en **Setup > Developer Hub > Widgets**, con `widget.html` como Index File.

Incluye el fix del bug `data.User.id` que rompía el banner y los botones.

## 02-ingreso-de-problemas/  (v5)

El widget standalone para el módulo **"Ingreso de Problemas"**.
El usuario elige el módulo y busca el legajo a mano. Para reportar algo que no tenés
abierto, o sin registro asociado.

Subir como widget separado del anterior — son dos widgets distintos en Zoho.

## 03-funcion-deluge/

`problemas_post_create.deluge` — la función que corre al crear un ticket. Clasifica
(área afectada, área responsable, prioridad) según el tipo de problema, arma el título
y linkea al registro origen.

Pegar en **Setup > Developer Space > Functions > problemas_post_create**.

Tiene logs `[DIAG 1]` a `[DIAG 6]` metidos a propósito — están ahí porque estamos
rastreando un bug (el lookup al registro origen a veces no se completa). Una vez
resuelto, se pueden sacar.

---

## Pendiente (no bloquea usar esto)

- Resolver el bug del lookup (ver logs DIAG en la función)
- Confirmar los campos de nombre/legajo reales de Renovaciones, Comisiones, Riesgo,
  Incumplimientos, Inmobiliarias (hoy están puestos como placeholder)
- Activar notificaciones por Cliq (está en el código, comentado)
- Definir SLA por prioridad

Documentación completa y al día: Notion, página **Módulo Problemas (Ex-Incidencias)**.
