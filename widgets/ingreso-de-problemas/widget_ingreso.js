const CLAVE_NINGUNO = "__NINGUNO__";

// Config de módulos origen. La clave es el API name del módulo en Zoho;
// relacionadoCon es el valor que se escribe en Problemas.Relacionado_con
// (sin tilde, alineado con app.js y problemas_post_create.deluge).
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
        relacionadoCon: "Renovacion",
        labelModulo: "Renovación",
        moduloBusqueda: "Renovaciones",
        campoBusqueda: "Name",
        campoFase: null,
    },
    Comisiones: {
        relacionadoCon: "Comision",
        labelModulo: "Comisión",
        moduloBusqueda: "Comisiones",
        campoBusqueda: "Name",
        campoFase: null,
    },
    Riesgos: {
        relacionadoCon: "Riesgo",
        labelModulo: "Riesgo",
        moduloBusqueda: "Riesgos",
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
    Contacts: {
        relacionadoCon: "Contacto",
        labelModulo: "Contacto",
        moduloBusqueda: "Contacts",
        campoBusqueda: "Full_Name",
        campoFase: null,
    },
    Accounts: {
        relacionadoCon: "Inmobiliaria",
        labelModulo: "Inmobiliaria",
        moduloBusqueda: "Accounts",
        campoBusqueda: "Account_Name",
        campoFase: null,
    },
    Cajas: {
        relacionadoCon: "Caja",
        labelModulo: "Caja",
        moduloBusqueda: "Cajas",
        campoBusqueda: "Name",
        campoFase: "Estado",   // real; dejar null si no se quiere en el banner
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
    if (!bloque) return;
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
    cerrarDropdownProblema();
    probMostrarTodos = false;
    setMensaje("", "");

    // Sin módulo seleccionado
    if (!moduloZoho) {
        ocultarContexto();
        setBloquesBusquedaVisible(false);
        return;
    }

    // Modo "Sin módulo / General"
    if (moduloZoho === CLAVE_NINGUNO) {
        setBloquesBusquedaVisible(false);
        setContextoNinguno();
        return;
    }

    // Módulo con búsqueda de legajo
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
        // Vacío = "Automática": problemas_post_create asigna la prioridad según
        // el mapeo del tipo. Si el usuario elige una explícita, esa gana.
        prioridad: document.getElementById("prioridad").value
    };
}

function validar({ problema, detalles }) {
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
 * En el resto: incluye Relacionado_con y, si existe, el ID de legajo.
 */
function buildPayload({ problema, detalles, prioridad }) {
    const payload = {
        Fase: "Abierto"
    };

    // Prioridad solo se envía si el usuario eligió una explícita.
    // Si viene vacía ("Automática"), se omite → la función la resuelve por mapeo.
    if (prioridad) payload["Prioridad"] = prioridad;

    // Relacionado_con solo cuando hay módulo real seleccionado
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

// ═══════════════════════════════════════════════════════════════════════════
// Tipo de problema — combobox con fuzzy search + filtro blando por módulo
// Catálogo (antes estaba como <optgroup> en el HTML), mapeo módulo→grupos y
// toda la lógica del dropdown. IDÉNTICO en app.js y widget_ingreso.js.
// ═══════════════════════════════════════════════════════════════════════════

const PROBLEMAS_CATALOGO = [
    {
        grupo: "Conversación con Cliente", opciones: [
            "No sabe el código de garantía",
            "No se envía email con pre-aprobación",
            "Cliente sin respuesta",
            "Preaprobación caducada",
        ]
    },
    {
        grupo: "Entrega de Comisiones", opciones: [
            "Comisión no entregada (vencida y pendiente)",
            "Comisión no entregada a tiempo (fuera de término)",
            "No se genera el ticket de comisiones",
            "No se descuenta la comisión en Books",
        ]
    },
    {
        grupo: "Evaluación de Riesgos", opciones: [
            "Resolución urgente de riesgos",
            "Pedido de excepción comercial de riesgos",
            "Hay que recotizar",
            "No me deja enviar a evaluación / reevaluación",
            "Error en el Cotizador",
        ]
    },
    {
        grupo: "Firmas de Locación", opciones: [
            "Firman hoy y el cliente no pagó",
            "Aún no se emitió el certificado",
            "No se genera el evento de Zoho Sign",
            "No trae pagarés / recibo",
        ]
    },
    {
        grupo: "Incumplimientos", opciones: [
            "Incumplimiento no se pasa a realizado",
            "Incumplimiento sin pagar",
            "Incumplimiento pagado fuera de término",
            "Monto de incumplimiento cubierto incorrecto",
        ]
    },
    {
        grupo: "Inmobiliarias", opciones: [
            "Correo electrónico erróneo en inmobiliaria",
            "Porcentaje de comisión incorrecto",
            "Inmobiliaria no pertenece al comercial",
            "No le llegó el correo del formulario",
            "Email con certificado digital no se envía",
            "No sale correo a inmobiliaria",
        ]
    },
    {
        grupo: "Pagos", opciones: [
            "Fecha de pago incorrecta",
            "Valor no coincide con lo esperado",
            "Cliente pagó pero no figura como pago/venta",
            "Diferencia parcial de pago (Mercado Pago)",
            "No aparece el formulario de pagos",
            "No puedo modificar o eliminar un pago",
            "Factura queda en $0",
            "No se genera la factura de anticipo",
            "No se genera la domiciliación / débito automático",
        ]
    },
    {
        grupo: "Reembolsos & Devoluciones", opciones: [
            "Solicitud de devolución / reembolso",
        ]
    },
    {
        grupo: "Sistemas", opciones: [
            "Caída de proveedores",
            "Ejecuciones recursivas",
            "Errores en configuración",
            "No pasa de fase",
            "Fase errónea",
        ]
    },
    {
        grupo: "Renovaciones", opciones: [
            "No se genera el aviso de renovación próxima",
            "Renovación no pasa a estado 'Enviada'",
            "El cliente rechazó la renovación y no se actualizó",
            "No se genera el contrato de renovación",
        ]
    },
    {
        grupo: "Documentación y Contratos", opciones: [
            "Contrato generado con datos incorrectos",
            "Adjunto no cargó / quedó vacío",
            "Falta firma de alguna de las partes",
            "Documento generado duplicado",
        ]
    },
    {
        grupo: "Usuarios y Accesos", opciones: [
            "Usuario no ve el módulo que debería",
            "Campo o botón no aparece para el usuario",
            "Usuario no puede editar un registro",
            "Usuario nuevo sin acceso configurado",
        ]
    },
    {
        grupo: "Notificaciones", opciones: [
            "No llega email al cliente en ninguna etapa",
            "Email llega con datos en blanco o mal formateados",
            "Notificación Cliq no se envía",
            "El cliente recibe el mismo correo dos veces",
        ]
    },
    {
        grupo: "Bigin / Referidos", opciones: [
            "Referido no se sincroniza con CRM",
            "Comisión de referido no se genera",
            "Referido asignado al comercial incorrecto",
            "Error en integración con Bigin",
        ]
    },
];

const PROBLEMA_OTRO = "Otro";

// Filtro blando: relacionadoCon -> grupos que se muestran primero.
// PROVISIONAL — validar el mapeo con negocio (mismo criterio que el portal).
const GRUPOS_POR_MODULO = {
    Trato: ["Conversación con Cliente", "Firmas de Locación", "Pagos", "Documentación y Contratos"],
    Renovacion: ["Renovaciones", "Pagos", "Documentación y Contratos"],
    Comision: ["Entrega de Comisiones", "Pagos"],
    Riesgo: ["Evaluación de Riesgos"],
    Incumplimiento: ["Incumplimientos", "Pagos"],
    Inmobiliaria: ["Inmobiliarias", "Notificaciones"],
    Contacto: ["Conversación con Cliente", "Usuarios y Accesos"],
    Caja: ["Pagos", "Reembolsos & Devoluciones"],
};
// Grupos transversales: se muestran siempre, aunque el módulo no los liste.
const GRUPOS_SIEMPRE = ["Sistemas", "Notificaciones", "Usuarios y Accesos"];

// Estado del combobox de problema
let probDropdownAbierto = false;
let probIndiceFocus = -1;
let probMostrarTodos = false;

// Normalización insensible a acentos/mayúsculas + match por tokens (fuzzy simple)
function normalizarTexto(s) {
    return String(s ?? "")
        .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
        .toLowerCase().trim();
}
function matchFuzzy(texto, query) {
    const t = normalizarTexto(texto);
    const tokens = normalizarTexto(query).split(/\s+/).filter(Boolean);
    return tokens.every(tok => t.includes(tok));
}

// relacionadoCon del módulo activo (o null si no hay / no soportado)
function relacionadoConActual() {
    return (moduloConfig && moduloConfig.relacionadoCon) ? moduloConfig.relacionadoCon : null;
}

// Grupos ordenados: relevantes al módulo primero, después el resto
function ordenarGrupos(relacionadoCon) {
    const relevantes = (GRUPOS_POR_MODULO[relacionadoCon] || []).slice();
    GRUPOS_SIEMPRE.forEach(g => { if (!relevantes.includes(g)) relevantes.push(g); });
    const resto = PROBLEMAS_CATALOGO.map(x => x.grupo).filter(g => !relevantes.includes(g));
    return { relevantes, resto };
}
function opcionesDeGrupo(nombreGrupo) {
    const g = PROBLEMAS_CATALOGO.find(x => x.grupo === nombreGrupo);
    return g ? g.opciones : [];
}

// Resaltado de coincidencias (cosmético; usa los tokens tal cual los tipeó el usuario)
function resaltarProb(texto, query) {
    const safe = escapeHtml(texto);
    const q = (query || "").trim();
    if (!q) return safe;
    const tokens = q.split(/\s+/).filter(Boolean)
        .map(t => escapeHtml(t).replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
    if (!tokens.length) return safe;
    return safe.replace(new RegExp("(" + tokens.join("|") + ")", "gi"), "<mark>$1</mark>");
}

// Render del dropdown según query + módulo activo
function renderDropdownProblema(query) {
    const lista = document.getElementById("problema-lista");
    if (!lista) return;
    lista.innerHTML = "";
    probIndiceFocus = -1;

    const q = (query || "").trim();
    const rc = relacionadoConActual();
    const hayFiltroModulo = !!rc && !!GRUPOS_POR_MODULO[rc];

    let gruposAMostrar;
    let mostrarVerTodos = false;

    // Filtro por módulo (duro): con un módulo mapeado se muestran SOLO los grupos
    // relacionados a ese módulo (+ transversales). Los NO relacionados no se listan.
    // Aplica tanto a la vista inicial como a la búsqueda: el fuzzy también queda
    // acotado al módulo, así no aparecen problemas de otros módulos al tipear.
    // "Ver todos" es la única vía para ver el catálogo completo (escape opcional).
    const acotarPorModulo = hayFiltroModulo && !probMostrarTodos;
    if (acotarPorModulo) {
        gruposAMostrar = ordenarGrupos(rc).relevantes;
        mostrarVerTodos = true;
    } else {
        gruposAMostrar = PROBLEMAS_CATALOGO.map(x => x.grupo);
    }

    let totalItems = 0;
    gruposAMostrar.forEach(nombreGrupo => {
        let opciones = opcionesDeGrupo(nombreGrupo);
        if (q) opciones = opciones.filter(op => matchFuzzy(op, q));
        if (!opciones.length) return;

        const header = document.createElement("li");
        header.className = "pb-grupo";
        header.textContent = nombreGrupo;
        lista.appendChild(header);

        opciones.forEach(op => {
            const li = document.createElement("li");
            li.className = "pb-item";
            li.dataset.valor = op;
            li.innerHTML = resaltarProb(op, q);
            li.addEventListener("mousedown", e => { e.preventDefault(); seleccionarProblema(op); });
            lista.appendChild(li);
            totalItems++;
        });
    });

    // "Otro" siempre disponible
    if (!q || matchFuzzy(PROBLEMA_OTRO, q)) {
        const liOtro = document.createElement("li");
        liOtro.className = "pb-item pb-item-otro";
        liOtro.dataset.valor = PROBLEMA_OTRO;
        liOtro.innerHTML = resaltarProb(PROBLEMA_OTRO, q);
        liOtro.addEventListener("mousedown", e => { e.preventDefault(); seleccionarProblema(PROBLEMA_OTRO); });
        lista.appendChild(liOtro);
        totalItems++;
    }

    if (mostrarVerTodos) {
        const liVer = document.createElement("li");
        liVer.className = "pb-vertodos";
        liVer.textContent = "+ Ver todos los tipos";
        liVer.addEventListener("mousedown", e => {
            e.preventDefault();
            probMostrarTodos = true;
            renderDropdownProblema(document.getElementById("problema").value.trim());
        });
        lista.appendChild(liVer);
    }

    if (!totalItems && q) {
        const vac = document.createElement("li");
        vac.className = "pb-vacio";
        vac.innerHTML = acotarPorModulo
            ? `Sin coincidencias en este módulo para <strong>${escapeHtml(q)}</strong>. Usá "Ver todos los tipos" para buscar en el resto.`
            : `Sin coincidencias para <strong>${escapeHtml(q)}</strong>. Se guardará el texto tal cual.`;
        lista.appendChild(vac);
    }

    lista.classList.remove("oculto");
    probDropdownAbierto = true;
}

function cerrarDropdownProblema() {
    const lista = document.getElementById("problema-lista");
    if (!lista) return;
    lista.classList.add("oculto");
    lista.innerHTML = "";
    probDropdownAbierto = false;
    probIndiceFocus = -1;
}

function seleccionarProblema(valor) {
    const input = document.getElementById("problema");
    if (input) input.value = valor;
    cerrarDropdownProblema();
    setMensaje("", "");
}

function moverFocoProblema(direccion) {
    const items = document.querySelectorAll("#problema-lista .pb-item");
    if (!items.length) return;
    if (probIndiceFocus >= 0 && items[probIndiceFocus]) items[probIndiceFocus].classList.remove("focusado");
    probIndiceFocus = direccion === "down"
        ? Math.min(probIndiceFocus + 1, items.length - 1)
        : Math.max(probIndiceFocus - 1, 0);
    items[probIndiceFocus].classList.add("focusado");
    items[probIndiceFocus].scrollIntoView({ block: "nearest" });
}
function confirmarFocoProblema() {
    const items = document.querySelectorAll("#problema-lista .pb-item");
    if (probIndiceFocus >= 0 && items[probIndiceFocus]) {
        items[probIndiceFocus].dispatchEvent(new MouseEvent("mousedown", { bubbles: true }));
    }
}

// ── Inicialización ────────────────────────────────────────────────────────

ZOHO.embeddedApp.on("PageLoad", () => {
    console.log("[widget-ingreso] PageLoad");

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

    // ── Combobox de Tipo de problema (fuzzy + filtro blando por módulo) ────
    const inputProblema = document.getElementById("problema");
    if (inputProblema) {
        inputProblema.addEventListener("focus", () => {
            renderDropdownProblema(inputProblema.value.trim());
        });
        inputProblema.addEventListener("input", () => {
            probMostrarTodos = false;
            renderDropdownProblema(inputProblema.value.trim());
        });
        inputProblema.addEventListener("keydown", e => {
            if (!probDropdownAbierto) return;
            if (e.key === "ArrowDown") { e.preventDefault(); moverFocoProblema("down"); }
            if (e.key === "ArrowUp") { e.preventDefault(); moverFocoProblema("up"); }
            if (e.key === "Enter") { e.preventDefault(); confirmarFocoProblema(); }
            if (e.key === "Escape") { cerrarDropdownProblema(); }
        });
        document.addEventListener("click", e => {
            if (!e.target.closest("#problema-wrapper")) cerrarDropdownProblema();
        });
    }


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