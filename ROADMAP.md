# Roadmap — Módulo Problemas

> El mapa de rutas del proyecto. Para el detalle técnico está `README.md`, para el
> análisis fino `ANALISIS.md`. Esto es la lista de "qué falta y en qué orden".

---

## Etapa 1 — Que el módulo funcione de punta a punta

- [x] Módulo Problemas creado, con todos los campos
- [x] Fases: Abierto / En curso / Cerrado / Reabierto
- [x] Picklist de 63 tipos de problema, aprobado
- [x] Buscador con autocompletado para Tipo de problema
- [x] Botón "Reportar Problema" en Tratos (automático)
- [x] Botón "Reportar Problema" dentro del módulo Problemas (manual)
- [x] Módulo "Ingreso de Problemas" eliminado — todo unificado en un solo botón
- [x] Función `problemas_post_create` clasificando (área afectada, área
      responsable, prioridad)
- [ ] 🐛 Bug del lookup al registro origen (a veces no completa) — en diagnóstico
- [x] Vistas: todos los problemas, por área, estilo Desk, mis problemas
- [x] Botón "Resolución" + fecha de cierre
- [x] Workflow de reapertura
- [ ] Workflow de asignación
  - [x] Fecha de asignación
  - [x] Cambia fase a "En curso"
  - [ ] Crea la tarea para el gestor
  - [ ] Setea el SLA en el ticket *(depende de que se defina el SLA, ver abajo)*
- [ ] Notificaciones Cliq (código listo, falta activar)
- [ ] Ocultar botón estándar "Crear" en Problemas *(depende de permisos por
      perfil, ver abajo)*
- [ ] Permisos por perfil
- [ ] SLA por prioridad, definido con el equipo
- [ ] Confirmar API names reales de Renovaciones, Comisiones, Riesgo,
      Incumplimientos, Inmobiliarias
- [ ] Decidir qué hacer con "Referido" y "Cobranza" (tienen lookup pero ningún
      widget los ofrece)

## Etapa 2 — Prolijidad

- [ ] `.gitignore` para sacar `Problemas.zip` y `desktop.ini` del repo
- [ ] Renombrar `02-ingreso-de-problemas/` (el módulo que le da nombre ya no existe)
- [ ] Actualizar §8 del documento de proyecto (menciona un módulo que ya no está)
- [ ] Sacar logs `[DIAG]` del Deluge una vez confirmado el fix del lookup
- [ ] Sacar la clave `"Garantía"` legacy si no hay tickets viejos con ese valor

## Etapa 3 — Métricas

- [ ] Tablero: tipos más recurrentes, tiempo de resolución, tickets por área,
      reaperturas
- [ ] Reporte automático (Cliq o mail)
- [ ] Alertas de SLA vencido

## Etapa 4 — UX del reporte

- [ ] Pop-up desde el registro origen (en vez de scroll al grupo de campos)
- [ ] Ver historial de problemas del mismo legajo antes de crear uno nuevo

## Etapa 5 — Documentación inteligente al cerrar

- [ ] Opción A: tabla en Notion, Tipo → link de doc
- [ ] Opción B: workflow en n8n que busca el mejor match
- [ ] Opción C: sugerencia generada con Claude API

---

## El orden en el que yo lo atacaría

1. Bug del lookup (todo lo demás depende un poco de confiar en los datos)
2. Los 5 API names placeholder — es una tarde, no una épica
3. SLA con el equipo → después sí cerrás asignación completa
4. Cliq
5. Permisos por perfil → ahí cae solo lo de ocultar el botón estándar
6. Prolijidad del repo (Etapa 2), antes de que se acumule más deuda
7. Métricas
8. UX / doc inteligente, recién cuando las métricas digan que hace falta

---

## Notas sueltas que no estaban en tu lista

- **"Cerrado" ¿con o sin nota de resolución obligatoria?** Hoy el botón lo permite
  vacío. Definir si se exige.
- **Tickets fantasma:** uno que queda 30 días en "En curso" sin que nadie lo toque,
  ¿se cierra solo? ¿escala a alguien?
- **Tope de reaperturas.** Hoy no hay límite. ¿Debería haberlo?
- **Auditar reclasificaciones manuales.** Si un ticket sale mal clasificado y
  alguien lo corrige a mano, sirve para saber si el mapeo automático necesita ajuste.

No bloquean nada de la Etapa 1, pero mejor tenerlas anotadas antes de que se
conviertan en sorpresa en Etapa 3.
