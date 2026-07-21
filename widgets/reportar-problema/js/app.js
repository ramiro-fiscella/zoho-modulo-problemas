const MODULO_CONFIG = {
    Deals: {
        relacionadoCon: "Trato",
        campoNombre: "Deal_Name",
        campoFase: "Stage",
        labelModulo: "Trato / Garantía"
    },
    Renovaciones: {
        relacionadoCon: "Renovacion",   // antes "Renovación" (con acento) → no matcheaba
        campoNombre: "Name",
        campoFase: "",
        labelModulo: "Renovación"
    },
    Comisiones: {
        relacionadoCon: "Comision",     // antes "Comisión" (con acento) → no matcheaba
        campoNombre: "Name",
        campoFase: "",
        labelModulo: "Comisión"
    },
    Riesgos: {
        relacionadoCon: "Riesgo",
        campoNombre: "Name",
        campoFase: "",
        labelModulo: "Riesgo"
    },
    Incumplimientos: {
        relacionadoCon: "Incumplimiento",
        campoNombre: "Name",
        campoFase: "",
        labelModulo: "Incumplimiento"
    },
    Accounts: {                         // API name real del módulo Inmobiliarias
        relacionadoCon: "Inmobiliaria", // antes "Inmobiliarias" (plural) → no matcheaba
        campoNombre: "Account_Name",
        campoFase: "",
        labelModulo: "Inmobiliaria"
    },
    Contacts: {
        relacionadoCon: "Contacto",     // antes "Contactos" (plural) → no matcheaba
        campoNombre: "Full_Name",
        campoFase: "",
        labelModulo: "Contacto"
    },
    Cajas: {                            // API name real del módulo (CustomModule51)
        relacionadoCon: "Caja",         // opción confirmada del picklist Relacionado_con
        campoNombre: "Name",            // display field real del módulo Cajas
        campoFase: "Estado",            // campo real; dejar "" si no se quiere en el banner
        labelModulo: "Caja"
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
