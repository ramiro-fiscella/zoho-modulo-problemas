/* ─────────────────────────────────────────────────────────────────────────
   Widget: Reportar Problema — Botón por módulo (Zoho CRM)  v3
   ─────────────────────────────────────────────────────────────────────────
   Cambios respecto a v2:
   - FIX CRÍTICO: `data.User.id` / `data.User.email` en el callback PageLoad
     no estaban protegidos. Si `data.User` llega undefined en el contexto de
     ejecución, esa línea tiraba una excepción que cortaba TODO el resto del
     callback — el banner de contexto nunca se cargaba y los botones
     Cancelar/Reportar quedaban sin sus event listeners (parecía que el JS
     no se estaba cargando, pero sí se cargaba: fallaba a mitad de camino).
     Ahora ese bloque de diagnóstico está en try/catch y no bloquea nada.

   Cambios de v2 (previos):
   - Picklist "Tipo de problema" (widget.html) ampliado a los 14 grupos /
     60 opciones alineados con el mapeo de clasificación de la función
     problemas_post_create. Antes tenía una lista corta de 15 opciones que
     no coincidía con ninguna clave del mapeo → nunca se clasificaba.
   - Prioridad "Automática": el <select> arranca en value vacío (antes
     "Media" preseleccionada). Si el usuario no elige, la función resuelve
     la prioridad por el mapeo del tipo de problema; si elige, esa gana.
   - MODULO_CONFIG sincronizado con modulosConfig de la función Deluge y
     con MODULO_CONFIG de widget_ingreso.js: se activaron Renovaciones,
     Comisiones, Riesgo, Incumplimientos, Inmobiliarias (antes comentados)
     y se agregó Contacts (antes ausente).
   ─────────────────────────────────────────────────────────────────────────
   Escalable multi-módulo: usa PageLoad.Entity para resolver automáticamente
   el valor de Relacionado_con y mostrar contexto del registro origen.
   ───────────────────────────────────────────────────────────────────────── */

// ── Configuración de módulos ────────────────────────────────────────────────
//
// Sincronizado con modulosConfig de la función Deluge problemas_post_create
// y con MODULO_CONFIG de widget_ingreso.js (módulo Ingreso de Problemas).
//
//   zohoModule   → nombre de la entidad en Zoho CRM (PageLoad.Entity)
//   relacionadoCon → valor del picklist Relacionado_con en Problemas
//   campoNombre  → campo que contiene el nombre/legajo del registro origen
//   campoFase    → campo de fase/stage en el módulo origen ("" = no mostrar)
//   labelModulo  → texto visible en el banner de contexto
//
// ⚠️ campoNombre/campoFase de Renovaciones, Comisiones, Riesgo, Incumplimientos
// e Inmobiliarias son PLACEHOLDER (mismo estado que en widget_ingreso.js y en
// la función Deluge — ver REFACTOR_ingreso_problemas.md, Etapa 2). Si el campo
// no existe, no rompe: el banner muestra "—" en vez del nombre real.
//
const MODULO_CONFIG = {
    Deals: {
        relacionadoCon: "Trato",
        campoNombre: "Deal_Name",
        campoFase: "Stage",
        labelModulo: "Trato / Garantía"
    },
    Renovaciones: {
        relacionadoCon: "Renovación",
        campoNombre: "Name",       // VERIFICAR
        campoFase: "",             // VERIFICAR
        labelModulo: "Renovación"
    },
    Comisiones: {
        relacionadoCon: "Comisión",
        campoNombre: "Name",       // VERIFICAR
        campoFase: "",             // VERIFICAR
        labelModulo: "Comisión"
    },
    Riesgo: {
        relacionadoCon: "Riesgo",
        campoNombre: "Name",       // VERIFICAR
        campoFase: "",             // VERIFICAR
        labelModulo: "Riesgo"
    },
    Incumplimientos: {
        relacionadoCon: "Incumplimiento",
        campoNombre: "Name",       // VERIFICAR
        campoFase: "",             // VERIFICAR
        labelModulo: "Incumplimiento"
    },
    Inmobiliarias: {
        relacionadoCon: "Inmobiliaria",
        campoNombre: "Name",       // VERIFICAR
        campoFase: "",             // VERIFICAR
        labelModulo: "Inmobiliaria"
    },
    Contacts: {
        relacionadoCon: "Contacto",
        campoNombre: "Full_Name",  // confirmado: módulo estándar Contacts
        campoFase: "",
        labelModulo: "Contacto"
    },
};

// ── Configuración de adjunto ───────────────────────────────────────────────
const ARCHIVO_MAX_MB = 10;
const ARCHIVO_MAX_BYTES = ARCHIVO_MAX_MB * 1024 * 1024;

// ── Estado global ──────────────────────────────────────────────────────────
let recordId = null;   // ID del registro origen
let moduloZoho = null;   // PageLoad.Entity (e.g. "Deals")
let moduloConfig = null;   // Entrada de MODULO_CONFIG para el módulo activo
let archivoSeleccionado = null;  // File object seleccionado por el usuario

// ── Helpers UI ─────────────────────────────────────────────────────────────

/**
 * Muestra un mensaje de estado en el widget.
 * @param {string} texto   - Texto a mostrar.
 * @param {""|"exito"|"error"|"cargando"} tipo - Clase CSS adicional.
 */
function setMensaje(texto, tipo) {
    const el = document.getElementById("mensaje");
    el.textContent = texto;
    el.className = "mensaje-estado " + (tipo || "");
}

/**
 * Habilita o deshabilita el botón de reporte y cambia su ícono.
 * @param {boolean} cargando
 */
function setBtnLoading(cargando) {
    const btn = document.getElementById("btn-reportar");
    btn.disabled = cargando;
    btn.querySelector(".btn-icon").textContent = cargando ? "○" : "●";
}

// ── Banner de contexto del registro origen ─────────────────────────────────

/**
 * Muestra el estado de carga en el banner de contexto.
 */
function setContextoCargando() {
    const el = document.getElementById("contexto-origen");
    el.innerHTML = `
        <div class="contexto-skeleton">
            <span class="skeleton-line skeleton-modulo"></span>
            <span class="skeleton-line skeleton-nombre"></span>
        </div>`;
    el.classList.remove("oculto");
}

/**
 * Rellena el banner con los datos del registro origen.
 * @param {{ nombre: string, fase: string }} datos
 */
function setContextoDatos({ nombre, fase }) {
    const config = moduloConfig;
    const el = document.getElementById("contexto-origen");
    el.innerHTML = `
        <span class="contexto-modulo">${escapeHtml(config.labelModulo)}</span>
        <span class="contexto-nombre">${escapeHtml(nombre || "—")}</span>
        ${fase ? `<span class="contexto-fase">${escapeHtml(fase)}</span>` : ""}`;
}

/**
 * Muestra error en el banner si no se puede leer el origen.
 */
function setContextoError() {
    const el = document.getElementById("contexto-origen");
    el.innerHTML = `<span class="contexto-error">⚠️ No se pudo cargar el contexto del registro.</span>`;
}

/**
 * Escapa caracteres HTML para evitar XSS en innerHTML.
 * @param {string} str
 * @returns {string}
 */
function escapeHtml(str) {
    return String(str)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;");
}

// ── Leer datos del registro origen vía SDK ─────────────────────────────────

/**
 * Lee el registro origen y actualiza el banner de contexto.
 * Usa el campo de nombre y fase configurados para el módulo activo.
 */
function cargarContextoOrigen() {
    if (!recordId || !moduloZoho || !moduloConfig) return;

    setContextoCargando();

    ZOHO.CRM.API.getRecord({
        Entity: moduloZoho,
        RecordID: recordId
    })
        .then(resp => {
            const record = resp?.data?.[0];
            if (!record) {
                setContextoError();
                return;
            }
            const nombre = record[moduloConfig.campoNombre] || "";
            const fase = record[moduloConfig.campoFase] || "";
            setContextoDatos({ nombre, fase });
        })
        .catch(err => {
            console.warn("[widget] No se pudo leer el registro origen:", err);
            setContextoError();
        });
}

// ── Adjunto de archivo ────────────────────────────────────────────────────

/**
 * Actualiza la UI del campo de archivo con el archivo seleccionado o limpio.
 * @param {File|null} file
 */
function actualizarUIArchivo(file) {
    const preview = document.getElementById("archivo-preview");
    const clearBtn = document.getElementById("archivo-clear");

    if (!file) {
        preview.textContent = "";
        preview.className = "archivo-preview";
        clearBtn.style.display = "none";
        return;
    }

    const mb = (file.size / 1024 / 1024).toFixed(2);
    preview.textContent = `📎 ${file.name} (${mb} MB)`;
    preview.className = "archivo-preview archivo-ok";
    clearBtn.style.display = "inline-flex";
}

/**
 * Adjunta el archivo seleccionado al registro de Problemas recién creado.
 * Resuelve siempre (nunca rechaza) para no bloquear el cierre del widget.
 * @param {string} nuevoId - ID del registro Problemas creado.
 * @returns {Promise<void>}
 */
function adjuntarArchivo(nuevoId) {
    if (!archivoSeleccionado) return Promise.resolve();

    setMensaje("Adjuntando archivo...", "cargando");

    return ZOHO.CRM.API.attachFile({
        Entity: "Problemas",
        RecordID: nuevoId,
        File: {
            Name: archivoSeleccionado.name,
            Content: archivoSeleccionado
        }
    })
        .then(resp => {
            console.log("[widget] attachFile resp:", JSON.stringify(resp));
        })
        .catch(err => {
            // El registro ya existe; solo avisamos sin bloquear el cierre
            console.warn("[widget] Error al adjuntar archivo:", err);
            setMensaje("⚠️ Incidencia creada pero el archivo no se pudo adjuntar.", "error");
        });
}

// ── Leer valores del formulario ────────────────────────────────────────────

function getFormData() {
    const problema = document.getElementById("problema").value.trim();
    const detalles = document.getElementById("detalles").value.trim();
    // Vacío = "Automática": la función problemas_post_create asigna la
    // prioridad según el mapeo del tipo de problema. Si el usuario elige
    // una explícita (Alta/Media/Baja), esa gana sobre el mapeo.
    const prioridad = document.getElementById("prioridad").value;
    return { problema, detalles, prioridad };
}

// ── Validaciones ──────────────────────────────────────────────────────────

function validar({ problema, detalles }) {
    if (!recordId) {
        setMensaje("⚠️ No se pudo identificar el registro.", "error");
        return false;
    }
    if (!moduloConfig) {
        setMensaje("⚠️ Módulo de origen no soportado: " + (moduloZoho || "desconocido"), "error");
        return false;
    }
    if (problema === "" && detalles === "") {
        setMensaje("⚠️ Completá al menos el tipo de problema o los detalles.", "error");
        return false;
    }
    return true;
}

// ── Construir payload ─────────────────────────────────────────────────────

/**
 * Construye el payload para insertar en el módulo Problemas.
 * Relacionado_con se resuelve dinámicamente desde MODULO_CONFIG.
 */
function buildPayload({ problema, detalles, prioridad }) {
    const payload = {
        Relacionado_con: moduloConfig.relacionadoCon,
        ID_ticket_relacionado: recordId.toString(),
        Fase: "Abierto"
    };

    // Prioridad solo se envía si el usuario eligió una explícita.
    // Si viene vacía ("Automática"), se omite → la función la resuelve por mapeo.
    if (prioridad) payload["Prioridad"] = prioridad;

    if (problema !== "") payload["Problema"] = problema;
    if (detalles !== "") payload["Detalles_problema"] = detalles;

    return payload;
}

// ── Handler: botón Reportar ───────────────────────────────────────────────

function onClickReportar() {
    const formData = getFormData();

    if (!validar(formData)) return;

    setBtnLoading(true);
    setMensaje("Creando incidencia...", "cargando");

    ZOHO.CRM.API.insertRecord({
        Entity: "Problemas",
        APIData: buildPayload(formData)
    })
        .then(async resp => {
            console.log("[widget] insertRecord resp:", JSON.stringify(resp));

            const ok = resp?.data?.[0]?.code === "SUCCESS";
            const nuevoId = resp?.data?.[0]?.details?.id;

            if (ok && nuevoId) {
                // Si hay archivo adjunto, subirlo antes de cerrar
                await adjuntarArchivo(nuevoId);
                setMensaje("✅ Incidencia creada correctamente.", "exito");
                setTimeout(() => ZOHO.CRM.UI.Popup.closeReload(), 1200);
            } else if (ok) {
                // Creado OK pero sin ID (raro) — cerrar igual
                setMensaje("✅ Incidencia creada correctamente.", "exito");
                setTimeout(() => ZOHO.CRM.UI.Popup.closeReload(), 1200);
            } else {
                setBtnLoading(false);
                const detalle = resp?.data?.[0]?.message ?? "Respuesta inesperada";
                setMensaje("❌ Error: " + detalle, "error");
                console.error("[widget] Error en insertRecord:", JSON.stringify(resp));
            }
        })
        .catch(err => {
            setBtnLoading(false);
            setMensaje("❌ Error al crear la incidencia. Revisá la consola.", "error");
            console.error("[widget] catch insertRecord:", err);
        });
}

// ── Inicialización del widget ─────────────────────────────────────────────

ZOHO.embeddedApp.on("PageLoad", data => {
    recordId = data.EntityId;
    moduloZoho = data.Entity;                    // e.g. "Deals"
    moduloConfig = MODULO_CONFIG[moduloZoho] || null;

    // Diagnóstico opcional: data.User puede no venir poblado según el contexto
    // en que se dispara PageLoad. Blindado en try/catch a propósito — un error
    // acá NO debe impedir que se cargue el banner ni que se registren los
    // listeners de los botones (eso fue justamente lo que rompió el widget:
    // antes esta línea sin protección cortaba el resto del callback).
    try {
        const userId = data.User && data.User.id;
        const userEmail = data.User && data.User.email;
        console.log("[widget] PageLoad →", { recordId, moduloZoho, moduloConfig, userId, userEmail });
    } catch (err) {
        console.warn("[widget] No se pudo leer data.User (no crítico, continúa igual):", err);
    }

    // Cargar contexto del registro origen en el banner
    cargarContextoOrigen();

    // Si el módulo no está soportado, advertir (sin bloquear; validar() lo maneja)
    if (!moduloConfig) {
        console.warn("[widget] Módulo no configurado en MODULO_CONFIG:", moduloZoho);
    }

    // Registrar listeners de UI sólo una vez que el SDK está listo
    document.getElementById("btn-cancelar").addEventListener("click", () => {
        ZOHO.CRM.UI.Popup.close();
    });

    document.getElementById("btn-reportar").addEventListener("click", onClickReportar);

    // ── File picker ──────────────────────────────────────────────────────────
    const inputArchivo = document.getElementById("archivo-input");
    const btnArchivo = document.getElementById("btn-archivo");
    const clearBtn = document.getElementById("archivo-clear");

    btnArchivo.addEventListener("click", () => inputArchivo.click());

    inputArchivo.addEventListener("change", () => {
        const file = inputArchivo.files[0] || null;
        if (!file) return;

        if (file.size > ARCHIVO_MAX_BYTES) {
            setMensaje(`⚠️ El archivo supera el límite de ${ARCHIVO_MAX_MB} MB.`, "error");
            inputArchivo.value = "";
            archivoSeleccionado = null;
            actualizarUIArchivo(null);
            return;
        }

        archivoSeleccionado = file;
        actualizarUIArchivo(file);
        setMensaje("", "");   // limpiar error previo si había
    });

    clearBtn.addEventListener("click", () => {
        inputArchivo.value = "";
        archivoSeleccionado = null;
        actualizarUIArchivo(null);
    });
});

// init() debe llamarse UNA SOLA VEZ, después de registrar todos los handlers
ZOHO.embeddedApp.init();