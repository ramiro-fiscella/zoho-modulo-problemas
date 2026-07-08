/* ─────────────────────────────────────────────────────────────────────────
   Widget: Reportar Problema — Módulo Ingreso de Problemas  v5
   ─────────────────────────────────────────────────────────────────────────
   Cambios respecto a v4:
   - Prioridad "Automática": el <select> arranca en value vacío. Cuando el
     usuario no elige prioridad, el payload la omite y la función
     problemas_post_create la resuelve según el mapeo del tipo de problema.
     Si el usuario elige una explícita, esa gana.
   - Fix Contactos: moduloBusqueda "Contacts" (nombre API real del módulo
     estándar) y campoBusqueda "Full_Name" (antes "Contactos"/"Name", que no
     existen → la búsqueda no devolvía resultados).
   - El HTML ahora envuelve la búsqueda de legajo en #bloque-busqueda-legajo,
     que es lo que setBloquesBusquedaVisible() oculta/muestra. Antes ese id no
     existía y el bloque nunca se ocultaba en modo "Sin módulo / General".

   Cambios de v4 (previos):
   - Opción "Sin módulo / General" (clave __NINGUNO__): oculta la búsqueda de
     legajo y omite Relacionado_con e ID_ticket_relacionado del payload.
   ───────────────────────────────────────────────────────────────────────── */

// ── Clave interna para el modo "sin módulo" ───────────────────────────────
const CLAVE_NINGUNO = "__NINGUNO__";

// ── Configuración de módulos ──────────────────────────────────────────────
//
//   relacionadoCon  → valor del picklist Relacionado_con en el módulo Problemas
//   labelModulo     → texto visible en el <select> de módulo
//   moduloBusqueda  → entidad de Zoho CRM sobre la que se busca el legajo
//   campoBusqueda   → campo API sobre el que se hace la búsqueda de texto
//   campoFase       → campo de fase a mostrar en el banner (null = no mostrar)
//
//   Para la entrada especial __NINGUNO__, moduloBusqueda / campoBusqueda /
//   campoFase no se usan; el bloque de búsqueda queda oculto.
//
const MODULO_CONFIG = {
    [CLAVE_NINGUNO]: {
        relacionadoCon: null,           // se omite del payload
        labelModulo: "Sin módulo / General",
        moduloBusqueda: null,
        campoBusqueda: null,
        campoFase: null,
    },
    Deals: {
        relacionadoCon: "Trato",
        labelModulo: "Trato / Garantía",
        moduloBusqueda: "Deals",
        campoBusqueda: "Deal_Name",
        campoFase: "Stage",
    },
    Renovaciones: {
        relacionadoCon: "Renovación",
        labelModulo: "Renovación",
        moduloBusqueda: "Renovaciones",
        campoBusqueda: "Name",
        campoFase: null,
    },
    Comisiones: {
        relacionadoCon: "Comisión",
        labelModulo: "Comisión",
        moduloBusqueda: "Comisiones",
        campoBusqueda: "Name",
        campoFase: null,
    },
    Riesgo: {
        relacionadoCon: "Riesgo",
        labelModulo: "Riesgo",
        moduloBusqueda: "Riesgo",
        campoBusqueda: "Name",
        campoFase: null,
    },
    Incumplimientos: {
        relacionadoCon: "Incumplimiento",
        labelModulo: "Incumplimiento",
        moduloBusqueda: "Incumplimientos",
        campoBusqueda: "Name",
        campoFase: null,
    },
    Contactos: {
        relacionadoCon: "Contacto",
        labelModulo: "Contacto",
        moduloBusqueda: "Contacts",
        campoBusqueda: "Full_Name",
        campoFase: null,
    },
    Inmobiliarias: {
        relacionadoCon: "Inmobiliaria",
        labelModulo: "Inmobiliaria",
        moduloBusqueda: "Inmobiliarias",
        campoBusqueda: "Name",
        campoFase: null,
    },
};

// ── Configuración de búsqueda ─────────────────────────────────────────────
const DEBOUNCE_MS = 300;
const MIN_CHARS = 2;
const MAX_RESULTADOS = 20;

// ── Configuración de adjunto ──────────────────────────────────────────────
const ARCHIVO_MAX_MB = 10;
const ARCHIVO_MAX_BYTES = ARCHIVO_MAX_MB * 1024 * 1024;

// ── Estado global ─────────────────────────────────────────────────────────
let moduloZoho = null;  // Clave activa de MODULO_CONFIG (o __NINGUNO__)
let moduloConfig = null;  // Objeto de config del módulo activo
let recordId = null;  // ID del registro confirmado desde el dropdown
let legajoManual = null;  // Texto libre escrito por el usuario (sin selección)
let archivoSeleccionado = null;  // File object para adjuntar
let debounceTimer = null;
let indiceFocusado = -1;
let dropdownAbierto = false;
let busquedaActiva = null;

// ── Helpers generales ─────────────────────────────────────────────────────

function escapeHtml(str) {
    return String(str ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;");
}

function escapeRegex(str) {
    return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function setMensaje(texto, tipo) {
    const el = document.getElementById("mensaje");
    el.textContent = texto;
    el.className = "mensaje-estado " + (tipo || "");
}

function setBtnLoading(cargando) {
    const btn = document.getElementById("btn-reportar");
    btn.disabled = cargando;
    btn.querySelector(".btn-icon").textContent = cargando ? "○" : "●";
}

// ── Banner de contexto ────────────────────────────────────────────────────

function setContextoCargando() {
    const el = document.getElementById("contexto-origen");
    el.innerHTML = `
        <div class="contexto-skeleton">
            <span class="skeleton-line skeleton-modulo"></span>
            <span class="skeleton-line skeleton-nombre"></span>
        </div>`;
    el.classList.remove("oculto");
}

function setContextoDatos({ nombre, fase }) {
    const el = document.getElementById("contexto-origen");
    const mostrarFase = moduloConfig.campoFase && fase;
    el.innerHTML = `
        <span class="contexto-modulo">${escapeHtml(moduloConfig.labelModulo)}</span>
        <span class="contexto-nombre">${escapeHtml(nombre || "—")}</span>
        ${mostrarFase ? `<span class="contexto-fase">${escapeHtml(fase)}</span>` : ""}`;
    el.classList.remove("oculto");
}

function setContextoManual(texto) {
    const el = document.getElementById("contexto-origen");
    el.innerHTML = `
        <span class="contexto-modulo">${escapeHtml(moduloConfig.labelModulo)}</span>
        <span class="contexto-nombre contexto-manual">${escapeHtml(texto)}</span>
        <span class="contexto-tag-manual">ingreso manual</span>`;
    el.classList.remove("oculto");
}

/**
 * Banner especial para el modo "Sin módulo / General".
 * Informa al usuario que la incidencia se creará sin registro vinculado.
 */
function setContextoNinguno() {
    const el = document.getElementById("contexto-origen");
    el.innerHTML = `
        <span class="contexto-modulo">General</span>
        <span class="contexto-nombre" style="color: var(--color-text-muted); font-style: italic;">
            Sin registro vinculado
        </span>`;
    el.classList.remove("oculto");
}

function ocultarContexto() {
    document.getElementById("contexto-origen").classList.add("oculto");
}

// ── Bloque de búsqueda de legajo ──────────────────────────────────────────

/**
 * Muestra u oculta el bloque completo de búsqueda de legajo.
 * En modo __NINGUNO__ no tiene sentido buscar un registro en CRM.
 * @param {boolean} visible
 */
function setBloquesBusquedaVisible(visible) {
    const bloque = document.getElementById("bloque-busqueda-legajo");
    if (!bloque) return;  // por si el HTML no lo tiene todavía
    bloque.style.display = visible ? "" : "none";
}

// ── Selector de módulo ────────────────────────────────────────────────────

function inicializarSelectorModulo() {
    const select = document.getElementById("modulo-selector");
    select.innerHTML = `<option value="">— Elegí un módulo —</option>`;

    Object.entries(MODULO_CONFIG).forEach(([key, cfg]) => {
        const opt = document.createElement("option");
        opt.value = key;
        opt.textContent = cfg.labelModulo;
        // Separador visual: la opción "Sin módulo" va primero (ya lo está por orden)
        // Podés agregar un optgroup si el HTML lo soporta.
        select.appendChild(opt);
    });

    select.addEventListener("change", onCambioModulo);
}

function onCambioModulo() {
    const select = document.getElementById("modulo-selector");
    moduloZoho = select.value || null;
    moduloConfig = moduloZoho ? MODULO_CONFIG[moduloZoho] : null;

    // Reset de selección
    recordId = null;
    legajoManual = null;
    indiceFocusado = -1;
    clearTimeout(debounceTimer);
    busquedaActiva = null;

    // Reset UI
    cerrarDropdown();
    setMensaje("", "");

    // ── Caso: sin módulo seleccionado ─────────────────────────────────────
    if (!moduloZoho) {
        ocultarContexto();
        setBloquesBusquedaVisible(false);
        return;
    }

    // ── Caso: modo "Sin módulo / General" ─────────────────────────────────
    if (moduloZoho === CLAVE_NINGUNO) {
        setBloquesBusquedaVisible(false);
        setContextoNinguno();
        return;
    }

    // ── Caso: módulo con búsqueda de legajo ───────────────────────────────
    setBloquesBusquedaVisible(true);
    ocultarContexto();
    setEstadoBusqueda("idle");

    const input = document.getElementById("registro-search");
    setInputBusqueda("", false);
    input.disabled = false;
    input.placeholder = "Escribí para buscar (opcional)...";
    input.focus();
}

// ── Búsqueda live por API ─────────────────────────────────────────────────

function buscarEnAPI(query) {
    const token = Symbol();
    busquedaActiva = token;

    setEstadoBusqueda("cargando");

    ZOHO.CRM.API.searchRecord({
        Entity: moduloConfig.moduloBusqueda,
        Type: "word",
        Query: query
    })
        .then(resp => {
            if (busquedaActiva !== token) return;

            const registros = resp?.data || [];

            if (!registros.length) {
                setEstadoBusqueda("idle");
                mostrarDropdown([], query);
                return;
            }

            const items = registros
                .slice(0, MAX_RESULTADOS)
                .map(r => ({
                    id: r.id,
                    nombre: r[moduloConfig.campoBusqueda] || r.id,
                    fase: moduloConfig.campoFase ? (r[moduloConfig.campoFase] || "") : ""
                }));

            setEstadoBusqueda("idle");
            mostrarDropdown(items, query);
        })
        .catch(err => {
            if (busquedaActiva !== token) return;
            console.warn("[widget-ingreso] Error en búsqueda:", err);
            setEstadoBusqueda("error");
            cerrarDropdown();
        });
}

// ── Highlight de coincidencias ────────────────────────────────────────────

function highlightCoincidencias(nombre, query) {
    if (!query.trim()) return escapeHtml(nombre);

    const tokens = query.trim().split(/\s+/).filter(Boolean);
    const re = new RegExp(
        `(${tokens.map(t => escapeRegex(escapeHtml(t))).join("|")})`,
        "gi"
    );
    return escapeHtml(nombre).replace(re, "<mark>$1</mark>");
}

// ── Dropdown ──────────────────────────────────────────────────────────────

function mostrarDropdown(items, query) {
    const lista = document.getElementById("resultados-lista");
    lista.innerHTML = "";
    indiceFocusado = -1;

    if (!items.length) {
        lista.innerHTML = `
            <li class="resultado-vacio">
                Sin resultados para <strong>${escapeHtml(query)}</strong>
                <span class="resultado-vacio-hint">El texto quedará guardado como referencia manual</span>
            </li>`;
    } else {
        items.forEach(item => {
            const li = document.createElement("li");
            li.className = "resultado-item";
            li.innerHTML = `
                <span class="resultado-nombre">${highlightCoincidencias(item.nombre, query)}</span>
                ${item.fase ? `<span class="resultado-fase">${escapeHtml(item.fase)}</span>` : ""}`;
            li.addEventListener("mousedown", e => {
                e.preventDefault();
                onSeleccionarRegistro(item);
            });
            lista.appendChild(li);
        });
    }

    lista.classList.remove("oculto");
    dropdownAbierto = true;
}

function cerrarDropdown() {
    const lista = document.getElementById("resultados-lista");
    if (!lista) return;
    lista.classList.add("oculto");
    lista.innerHTML = "";
    dropdownAbierto = false;
    indiceFocusado = -1;
}

// ── Navegación por teclado ────────────────────────────────────────────────

function moverFocoDropdown(direccion) {
    const items = document.querySelectorAll("#resultados-lista .resultado-item");
    if (!items.length) return;

    if (indiceFocusado >= 0) items[indiceFocusado].classList.remove("focusado");

    indiceFocusado = direccion === "down"
        ? Math.min(indiceFocusado + 1, items.length - 1)
        : Math.max(indiceFocusado - 1, 0);

    items[indiceFocusado].classList.add("focusado");
    items[indiceFocusado].scrollIntoView({ block: "nearest" });
}

function confirmarFocoDropdown() {
    const items = document.querySelectorAll("#resultados-lista .resultado-item");
    if (indiceFocusado >= 0 && items[indiceFocusado]) {
        items[indiceFocusado].dispatchEvent(new MouseEvent("mousedown", { bubbles: true }));
    }
}

// ── Selección de registro ─────────────────────────────────────────────────

function onSeleccionarRegistro(item) {
    recordId = item.id;
    legajoManual = null;
    setInputBusqueda(item.nombre, true);
    cerrarDropdown();
    setContextoDatos({ nombre: item.nombre, fase: item.fase });
    setMensaje("", "");
}

// ── Helpers del input ─────────────────────────────────────────────────────

function setInputBusqueda(valor, confirmado) {
    const input = document.getElementById("registro-search");
    input.value = valor;
    input.classList.toggle("registro-confirmado", confirmado);
}

function setEstadoBusqueda(estado) {
    const el = document.getElementById("busqueda-estado");
    if (!el) return;
    const textos = {
        idle: "",
        cargando: "Buscando...",
        error: "⚠️ No se pudo conectar con el módulo"
    };
    el.textContent = textos[estado] ?? "";
    el.className = `busqueda-estado busqueda-${estado}`;
}

// ── Adjunto de archivo ────────────────────────────────────────────────────

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

function adjuntarArchivo(nuevoId) {
    if (!archivoSeleccionado) return Promise.resolve();

    setMensaje("Adjuntando archivo...", "cargando");

    return ZOHO.CRM.API.attachFile({
        Entity: "Problemas",
        RecordID: nuevoId,
        File: { Name: archivoSeleccionado.name, Content: archivoSeleccionado }
    })
        .then(resp => { console.log("[widget-ingreso] attachFile:", JSON.stringify(resp)); })
        .catch(err => {
            console.warn("[widget-ingreso] Error adjunto:", err);
            setMensaje("⚠️ Incidencia creada pero el archivo no se pudo adjuntar.", "error");
        });
}

// ── Formulario ────────────────────────────────────────────────────────────

function getFormData() {
    return {
        problema: document.getElementById("problema").value.trim(),
        detalles: document.getElementById("detalles").value.trim(),
        // Vacío = "Automática": la función problemas_post_create asigna la
        // prioridad según el mapeo del tipo de problema. Si el usuario elige
        // una explícita (Alta/Media/Baja), esa gana sobre el mapeo.
        prioridad: document.getElementById("prioridad").value
    };
}

function validar({ problema, detalles }) {
    // Siempre se requiere haber elegido alguna opción en el selector de módulo
    if (!moduloZoho || !moduloConfig) {
        setMensaje("⚠️ Elegí un módulo de destino (o 'Sin módulo / General').", "error");
        return false;
    }
    if (!problema && !detalles) {
        setMensaje("⚠️ Completá al menos el tipo de problema o los detalles.", "error");
        return false;
    }
    return true;
}

/**
 * Construye el payload.
 * En modo __NINGUNO__: omite Relacionado_con e ID_ticket_relacionado.
 * En el resto:        incluye Relacionado_con y, si existe, el ID de legajo.
 */
function buildPayload({ problema, detalles, prioridad }) {
    const payload = {
        Fase: "Abierto"
    };

    // Prioridad solo se envía si el usuario eligió una explícita.
    // Si viene vacía ("Automática"), se omite → la función la resuelve por mapeo.
    if (prioridad) payload["Prioridad"] = prioridad;

    // Solo agregar Relacionado_con cuando hay módulo real seleccionado
    if (moduloZoho !== CLAVE_NINGUNO && moduloConfig.relacionadoCon) {
        payload["Relacionado_con"] = moduloConfig.relacionadoCon;

        // Legajo: registro seleccionado > texto manual > omitir
        const idLegajo = recordId
            ? recordId.toString()
            : (legajoManual || null);

        if (idLegajo) payload["ID_ticket_relacionado"] = idLegajo;
    }

    if (problema) payload["Problema"] = problema;
    if (detalles) payload["Detalles_problema"] = detalles;

    return payload;
}

// ── Handler: botón Reportar ───────────────────────────────────────────────

function onClickReportar() {
    const formData = getFormData();
    if (!validar(formData)) return;

    setBtnLoading(true);
    setMensaje("Creando incidencia...", "cargando");

    ZOHO.CRM.API.insertRecord({ Entity: "Problemas", APIData: buildPayload(formData) })
        .then(async resp => {
            console.log("[widget-ingreso] insertRecord:", JSON.stringify(resp));
            const ok = resp?.data?.[0]?.code === "SUCCESS";
            const nuevoId = resp?.data?.[0]?.details?.id;

            if (ok) {
                if (nuevoId) await adjuntarArchivo(nuevoId);
                setMensaje("✅ Incidencia creada correctamente.", "exito");
                setTimeout(() => ZOHO.CRM.UI.Popup.closeReload(), 1200);
            } else {
                setBtnLoading(false);
                setMensaje("❌ Error: " + (resp?.data?.[0]?.message ?? "Respuesta inesperada"), "error");
                console.error("[widget-ingreso] insertRecord error:", JSON.stringify(resp));
            }
        })
        .catch(err => {
            setBtnLoading(false);
            setMensaje("❌ Error al crear la incidencia. Revisá la consola.", "error");
            console.error("[widget-ingreso] catch:", err);
        });
}

// ── Inicialización ────────────────────────────────────────────────────────

ZOHO.embeddedApp.on("PageLoad", () => {
    console.log("[widget-ingreso] PageLoad — v5");

    inicializarSelectorModulo();

    // El bloque de búsqueda empieza oculto hasta que se elija un módulo real
    setBloquesBusquedaVisible(false);

    const input = document.getElementById("registro-search");
    input.disabled = true;
    input.placeholder = "Primero elegí un módulo";

    // ── Input de búsqueda ─────────────────────────────────────────────────
    input.addEventListener("input", () => {
        const q = input.value.trim();

        recordId = null;
        legajoManual = null;
        input.classList.remove("registro-confirmado");
        ocultarContexto();
        setMensaje("", "");
        clearTimeout(debounceTimer);

        if (!q || q.length < MIN_CHARS) {
            cerrarDropdown();
            setEstadoBusqueda("idle");
            return;
        }

        debounceTimer = setTimeout(() => buscarEnAPI(q), DEBOUNCE_MS);
    });

    // ── Blur: texto libre sin selección ──────────────────────────────────
    input.addEventListener("blur", () => {
        setTimeout(() => {
            cerrarDropdown();

            const textoActual = input.value.trim();

            if (recordId) return;

            if (textoActual) {
                legajoManual = textoActual;
                setContextoManual(textoActual);
                input.classList.add("registro-confirmado");
            } else {
                legajoManual = null;
                ocultarContexto();
                input.classList.remove("registro-confirmado");
            }
        }, 150);
    });

    // ── Teclado en dropdown ───────────────────────────────────────────────
    input.addEventListener("keydown", e => {
        if (!dropdownAbierto) return;
        if (e.key === "ArrowDown") { e.preventDefault(); moverFocoDropdown("down"); }
        if (e.key === "ArrowUp") { e.preventDefault(); moverFocoDropdown("up"); }
        if (e.key === "Enter") { e.preventDefault(); confirmarFocoDropdown(); }
        if (e.key === "Escape") { cerrarDropdown(); }
    });

    document.addEventListener("click", e => {
        if (!e.target.closest("#registro-search-wrapper")) cerrarDropdown();
    });

    // ── Botones principales ───────────────────────────────────────────────
    document.getElementById("btn-cancelar").addEventListener("click", () => {
        ZOHO.CRM.UI.Popup.close();
    });
    document.getElementById("btn-reportar").addEventListener("click", onClickReportar);

    // ── File picker ───────────────────────────────────────────────────────
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
        setMensaje("", "");
    });

    clearBtn.addEventListener("click", () => {
        inputArchivo.value = "";
        archivoSeleccionado = null;
        actualizarUIArchivo(null);
    });
});

ZOHO.embeddedApp.init();
