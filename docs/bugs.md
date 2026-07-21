# Módulo Problemas — Bugs reales confirmados

Validado contra metadata de campos y contra tickets reales (PRB-0038, PRB-0039, 0161, 0157, entre otros) vía Zoho CRM MCP. Solo se listan acá los puntos confirmados como bug real; los descartados durante la revisión (ver nota al final) no están incluidos.

---

## 1\. `problemas_reapertura` — condición de carrera con el workflow "Reapertura de ticket"

El workflow ejecuta, en este orden:

1. Acción de campo: `Fase` → `Reabierto`  
2. Función: `problemas_reapertura`

La función arranca leyendo el registro de nuevo (`zoho.crm.getRecordById`) y valida `if(faseActual == "Cerrado" && motivo != "")` antes de hacer nada. Como la Fase ya fue pisada por la acción de campo anterior, esa condición **nunca se cumple**, y todo el bloque interno de la función queda sin ejecutarse:

- No se actualiza `Fecha_de_asignacion`.  
- No se crea la nota "Reapertura de ticket" en Problemas.  
- No se crea la nota "Reapertura de incidencia asociada" en el registro origen.

Visualmente el ticket igual pasa a "Reabierto" (porque lo hace la acción de campo, no la función), así que el bug no se nota a simple vista.

**Fix acordado:** eliminar la acción de campo "Reapertura ticket" del workflow y dejar que la función haga el `updateMap.put("Fase","Reabierto")` (ya lo tiene en el código).

---

## 2\. `Relacionado_con` — el widget "Reportar Problema" escribe con tilde, otros caminos de creación sin tilde, y las 3 funciones de backend no están alineadas entre sí

Esto no es solo un problema de las funciones — el origen está en el propio widget. `app.js` (botón "Reportar Problema" por módulo) arma el payload de creación así:

const payload \= {

    Relacionado\_con: moduloConfig.relacionadoCon,

    ...

}

Y `MODULO_CONFIG` define, para Renovaciones y Comisiones, los valores **con tilde**: `"Renovación"`, `"Comisión"`. O sea que un ticket creado desde el botón en un registro de Renovaciones o Comisiones se crea con esa grafía acentuada.

Pero el ticket real "0161" (sin `ID_ticket_relacionado`, probablemente cargado manualmente desde el CRM) quedó con `Relacionado_con: "Comision"` **sin tilde**.

Conviven entonces dos grafías distintas para la misma relación, según el punto de entrada:

- Widget "Reportar Problema" (`app.js`) → con tilde (`"Renovación"`, `"Comisión"`)  
- Carga manual / otro flujo → sin tilde (`"Renovacion"`, `"Comision"`)

Y cada función de backend solo reconoce una:

- `post_create` → sin tilde → matchea la carga manual, no matchea al widget  
- `notificar_asignacion` y `reapertura` → con tilde → matchea al widget, no matchea la carga manual

Ninguna de las tres cubre los dos casos a la vez. Para "Trato"/"Contacto"/"Riesgo"/"Incumplimiento"/"Inmobiliaria" el widget y las 3 funciones sí coinciden (sin problema ahí).

**Fix sugerido:** unificar en una sola grafía canónica (recomendado: sin tilde, igual al display\_value del campo) en tres lugares: `MODULO_CONFIG` de `app.js`, `notificar_asignacion` y `reapertura`. Pendiente confirmar si `widget_ingreso.js` (módulo "Ingreso de Problemas", todavía no lo vi) agrega una tercera grafía más.

---

## 3\. `problemas_reapertura` — faltan los casos "Contacto" e "Inmobiliaria"

El if-chain de resolución de módulo origen (Deals, Renovaciones, Referidos, Comisiones, Riesgo, Operaciones, Incumplimientos) no incluye `"Contacto"` ni `"Inmobiliaria"` — ambos sí son módulos de origen válidos y soportados por el widget (`MODULO_CONFIG` los incluye). Si se reabre un ticket relacionado a un Contacto o una Inmobiliaria, no se genera la nota en el registro origen — faltan esos dos `else if`.

---

## 4\. `Reportado_por` — tipo de campo incompatible con lo que se le escribe

El campo confirmado en Zoho es `text` (string simple). El código arma un Map de lookup y se lo asigna:

reportadoPorMap \= Map();

reportadoPorMap.put("id",ownerOrigen.get("id"));

updProblema.put("Reportado\_por",reportadoPorMap);

**Pendiente de definición:** confirmar si esto se corrige apuntando a `Quien_reporta` (campo de búsqueda) una vez que exista con ese api name, o ajustando el valor para que sea compatible con `Reportado_por` como texto.

---

## 5\. Cliq en `post_create` — canal de pruebas en vez del canal real

zoho.cliq.postToChannel("problemaspruebas",mensajeCliq\_obj,"cliq\_sara");

Hay que reemplazar `"problemaspruebas"` por el canal de soporte real que ya usa Sistemas.

---

## 6\. Cliq en `post_create` — el update principal no loguea ni alerta si falla

zoho.crm.updateRecord("Problemas",problemaId.toLong(),updProblema);

La respuesta no se captura. Si algún día un valor falla la validación de Zoho, no queda rastro en los logs. Habría que capturar la respuesta y, si hay error, mandar una alerta adicional a Cliq (fuera del `try/catch` que hoy solo cubre la notificación del paso 6, no el update del paso 4).

---

## 7\. `clasif` en `post_create` no cubre todos los valores vigentes de "Problema"

Valores existentes en el picklist sin mapeo en la tabla `clasif` (quedan sin `Area_afectada`/`Area_responsable`/`Prioridad` automáticos, igual que "Otro"):

- `Contrato no generado`  
- `Correo electrónico no enviado`  
- `Error en Cotizador` (posible duplicado de `Error en el Cotizador`, que sí está mapeado — revisar si conviene unificar el picklist)  
- `No se crea domiciliación`  
- `No se crea estimación`  
- `No se crea factura de anticipo`  
- `Pago no acreditado`

---

## 8\. Campos duplicados / higiene

`Resolucion` (picklist) y `Resoluci_n` (texto) conviven en el módulo sin que ninguna de las 3 funciones los use. Confirmar cuál es el vigente y depreciar/eliminar el otro.

---

## 9\. `Estado_de_resolucion` sin dueño claro (a confirmar, no es bug de código)

Ninguna de las 3 funciones ni de los 3 workflows revisados toca este campo. A confirmar con el equipo si es de carga exclusivamente manual.

---

## 10\. Widget "Reportar Problema" — banner de contexto con campos placeholder sin verificar (cosmético, no afecta los datos del ticket)

En `app.js`, `MODULO_CONFIG` marca explícitamente como `// VERIFICAR` el `campoNombre`/`campoFase` de Renovaciones, Comisiones, Riesgo, Incumplimientos e Inmobiliarias (solo Deals y Contacts están confirmados). Si esos api names no existen o están mal, el banner de contexto del widget va a mostrar "—" en vez del nombre/fase real del registro origen. No afecta la creación del ticket en sí (eso se resuelve del lado del backend con su propio mapeo), solo la experiencia visual del agente al reportar. Bajar de prioridad frente a los puntos 1-4, pero queda pendiente confirmar esos api names.

---

### Nota — puntos descartados durante la revisión

Se había señalado inicialmente un posible mismatch entre `actual_value`/`display_value` en `Area_responsable` y en el resto de las claves de `Relacionado_con` en `post_create`. Se validó contra tickets reales (PRB-0038, PRB-0039, 0161, 0157\) y **no es un problema real**: el sistema lee y escribe usando el display\_value vigente, no el actual\_value histórico que devuelve el endpoint de metadata de campos. Se descarta.  
