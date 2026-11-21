
// ==========================================
// PADEL MANAGER - TEAM GUILLEM
// ==========================================

const DB_NAME = "PadelManagerDB";
const DB_VERSION = 3;

// ==========================================
// BASE DE DATOS
// ==========================================

function abrirBaseDatos() {
    return new Promise((resolve, reject) => {
        const solicitud = indexedDB.open(DB_NAME, DB_VERSION);

 solicitud.onupgradeneeded = (event) => {
    const db = event.target.result;

    if (!db.objectStoreNames.contains("partidos")) {
        db.createObjectStore("partidos", {
            keyPath: "id",
            autoIncrement: true
        });
    }

    if (!db.objectStoreNames.contains("jugadores")) {
        db.createObjectStore("jugadores", {
            keyPath: "id",
            autoIncrement: true
        });
    }

    if (!db.objectStoreNames.contains("equipamiento")) {
        db.createObjectStore("equipamiento", {
            keyPath: "id"
        });
    }
};


        solicitud.onsuccess = () => resolve(solicitud.result);
        solicitud.onerror = () => reject(solicitud.error);
    });
}

async function obtenerPartidos() {
    const db = await abrirBaseDatos();

    return new Promise((resolve, reject) => {
        const transaccion = db.transaction("partidos", "readonly");
        const almacen = transaccion.objectStore("partidos");
        const solicitud = almacen.getAll();

        solicitud.onsuccess = () => resolve(solicitud.result);
        solicitud.onerror = () => reject(solicitud.error);
    });
}

async function guardarPartido(partido) {
    const db = await abrirBaseDatos();

    return new Promise((resolve, reject) => {
        const transaccion = db.transaction("partidos", "readwrite");
        const almacen = transaccion.objectStore("partidos");

        almacen.add(partido);

        transaccion.oncomplete = () => resolve();
        transaccion.onerror = () => reject(transaccion.error);
        transaccion.onabort = () => reject(transaccion.error);
    });
}

// ==========================================
// VALIDACIÓN DEL MARCADOR
// ==========================================

function validarSet(local, rival, tbLocal, tbRival, numero) {
    const ganaLocal = local > rival;
    const ganador = ganaLocal ? "TEAM GUILLEM" : "RIVALES";

    const esSetNormal =
        (Math.max(local, rival) === 6 && Math.min(local, rival) <= 4) ||
        (Math.max(local, rival) === 7 && Math.min(local, rival) === 5);

    const esSetConTieBreak =
        Math.max(local, rival) === 7 &&
        Math.min(local, rival) === 6;

    if (!esSetNormal && !esSetConTieBreak) {
        throw new Error(
            `El resultado del set ${numero} no es válido.`
        );
    }

    const tieneTB = tbLocal !== null || tbRival !== null;

    if (esSetConTieBreak) {
        if (tbLocal === null || tbRival === null) {
            throw new Error(
                `El set ${numero} terminó 7-6. Debes introducir los puntos del tie-break.`
            );
        }

        const tbGanador = tbLocal > tbRival ? "TEAM GUILLEM" : "RIVALES";

        if (
            Math.min(tbLocal, tbRival) < 0 ||
            Math.max(tbLocal, tbRival) < 7 ||
            Math.abs(tbLocal - tbRival) < 2 ||
            tbGanador !== ganador
        ) {
            throw new Error(
                `Los puntos del tie-break del set ${numero} no son válidos.`
            );
        }
    } else if (tieneTB) {
        throw new Error(
            `El set ${numero} no terminó 7-6. No necesita tie-break.`
        );
    }

    return {
        local,
        rival,
        tbLocal,
        tbRival,
        ganador
    };
}

function recogerResultado() {
    const tarjetas = document.querySelectorAll(".set-card");
    const sets = [];

    tarjetas.forEach((tarjeta, indice) => {
        const localInput = tarjeta.querySelector(".juegos-local");
        const rivalInput = tarjeta.querySelector(".juegos-rival");
        const tbLocalInput = tarjeta.querySelector(".tb-local");
        const tbRivalInput = tarjeta.querySelector(".tb-rival");

        const localTexto = localInput.value.trim();
        const rivalTexto = rivalInput.value.trim();
        const tbLocalTexto = tbLocalInput.value.trim();
        const tbRivalTexto = tbRivalInput.value.trim();

        const numero = indice + 1;

        if (localTexto === "" && rivalTexto === "") {
            return;
        }

        if (localTexto === "" || rivalTexto === "") {
            throw new Error(`Completa los dos marcadores del set ${numero}.`);
        }

        const local = Number(localTexto);
        const rival = Number(rivalTexto);

        if (
            !Number.isInteger(local) ||
            !Number.isInteger(rival) ||
            local < 0 || local > 7 ||
            rival < 0 || rival > 7
        ) {
            throw new Error(`Revisa los juegos del set ${numero}.`);
        }

        const tbLocal = tbLocalTexto === "" ? null : Number(tbLocalTexto);
        const tbRival = tbRivalTexto === "" ? null : Number(tbRivalTexto);

        if (
            (tbLocal !== null && (!Number.isInteger(tbLocal) || tbLocal < 0 || tbLocal > 30)) ||
            (tbRival !== null && (!Number.isInteger(tbRival) || tbRival < 0 || tbRival > 30))
        ) {
            throw new Error(`Revisa los puntos del tie-break del set ${numero}.`);
        }

        sets.push(validarSet(local, rival, tbLocal, tbRival, numero));
    });

    if (sets.length < 2 || sets.length > 3) {
        throw new Error("Debes introducir dos sets como mínimo.");
    }

    const setsLocal = sets.filter(set => set.ganador === "TEAM GUILLEM").length;
    const setsRival = sets.filter(set => set.ganador === "RIVALES").length;

    if (sets.length === 2 && setsLocal === 1 && setsRival === 1) {
    throw new Error("El partido está empatado a un set. Completa el tercer set.");
}

if (sets.length === 3 && sets[0].ganador === sets[1].ganador) {
    throw new Error("El tercer set no es necesario: una pareja ya ganó los dos primeros.");
}

    return {
        sets,
        resultado: setsLocal > setsRival ? "victoria" : "derrota",
        setsLocal,
        setsRival
    };
}

// ==========================================
// FORMULARIO: GUARDAR PARTIDO
// ==========================================

async function gestionarFormulario(event) {
    event.preventDefault();

    const formulario = document.getElementById("form-partido");

    try {
        const marcador = recogerResultado();

        // Recuperar los jugadores seleccionados
        const companeroId = Number(
            document.getElementById("compañero-partido").value
        );

        const rival1Id = Number(
            document.getElementById("rival1-partido").value
        );

        const rival2Id = Number(
            document.getElementById("rival2-partido").value
        );

        const jugadores = await obtenerJugadores();

        const companero = jugadores.find(j => j.id === companeroId);
        const rival1 = jugadores.find(j => j.id === rival1Id);
        const rival2 = jugadores.find(j => j.id === rival2Id);

        // Comprobar que se han seleccionado los tres jugadores
        if (!companero || !rival1 || !rival2) {
            throw new Error(
                "Selecciona tu compañero y los dos rivales."
            );
        }

        // Evitar seleccionar dos veces al mismo rival
        if (rival1.id === rival2.id) {
            throw new Error(
                "Selecciona dos rivales diferentes."
            );
        }

        const partido = {
            fecha: document.getElementById("fecha").value,
            club: document.getElementById("club").value.trim(),
            tipo: document.getElementById("tipo").value,
            duracion: Number(document.getElementById("duracion").value),
            puntosFuertes: document.getElementById("puntos-fuertes").value.trim(),
aspectosMejorar: document.getElementById("aspectos-mejorar").value.trim(),
observaciones: document.getElementById("observaciones-partido").value.trim(),

            // Análisis personal
sensaciones: document.getElementById("sensaciones-partido").value,
valoracion: Number(document.getElementById("valoracion-partido").value),
    // Información del torneo
    nombreTorneo: document.getElementById("nombre-torneo").value.trim(),
    faseTorneo: document.getElementById("fase-torneo").value,
    jornadaTorneo: document.getElementById("jornada-torneo").value.trim(),
            // Jugadores del partido
            companero: {
                id: companero.id,
                nombre: companero.nombre
            },

            rivales: [
                {
                    id: rival1.id,
                    nombre: rival1.nombre
                },
                {
                    id: rival2.id,
                    nombre: rival2.nombre
                }
            ],

            sets: marcador.sets,
            resultado: marcador.resultado,
            setsLocal: marcador.setsLocal,
            setsRival: marcador.setsRival,
            creado: new Date().toISOString()
        };

        if (
            !partido.fecha ||
            !partido.club ||
            !partido.tipo ||
            !partido.duracion
        ) {
            throw new Error("Completa todos los datos del partido.");
        }
if (partido.tipo === "Torneo") {
    if (!partido.nombreTorneo || !partido.faseTorneo) {
        throw new Error(
            "Indica el nombre del torneo y la fase de competición."
        );
    }
}
        await guardarPartido(partido);

        alert(
            partido.resultado === "victoria"
                ? "¡Victoria de TEAM GUILLEM! Partido guardado. 🎾"
                : "Partido guardado. ¡A por el siguiente! 💪"
        );

        formulario.reset();
        await actualizarAplicacion();

    } catch (error) {
        alert(error.message || "No se ha podido guardar el partido.");
        console.error(error);
    }
}
function configurarValoracionPartido() {
    const valoracion = document.getElementById("valoracion-partido");
    const indicador = document.getElementById("valoracion-actual");

    valoracion.addEventListener("input", () => {
        indicador.textContent = `${valoracion.value}/10`;
    });
}
// ==========================================
// MOSTRAR HISTORIAL
// ==========================================

function crearElemento(etiqueta, texto, clase) {
    const elemento = document.createElement(etiqueta);
    elemento.textContent = texto;

    if (clase) {
        elemento.className = clase;
    }

    return elemento;
}

function mostrarHistorial(partidos) {
    const contenedor = document.getElementById("lista-partidos");
    contenedor.innerHTML = "";

    contenedor.appendChild(
        crearElemento("h3", "Historial de partidos")
    );

    if (partidos.length === 0) {
        contenedor.appendChild(
            crearElemento("p", "Todavía no has registrado ningún partido.")
        );
        return;
    }

    partidos.sort((a, b) => b.fecha.localeCompare(a.fecha));

    partidos.forEach(partido => {
        const tarjeta = document.createElement("article");
        tarjeta.className = "historial-card";

        const fecha = new Date(partido.fecha + "T00:00:00");
        const fechaTexto = fecha.toLocaleDateString("es-ES");

        // Nombre del club y fecha
        tarjeta.appendChild(
            crearElemento("h4", partido.club)
        );

        tarjeta.appendChild(
            crearElemento(
                "p",
                `${fechaTexto} · ${partido.tipo} · ${partido.duracion / 60} h`
            )
        );

        // Información del torneo
        if (partido.tipo === "Torneo" && partido.nombreTorneo) {
            tarjeta.appendChild(
                crearElemento("p", `🏆 ${partido.nombreTorneo}`)
            );

            if (partido.faseTorneo) {
                tarjeta.appendChild(
                    crearElemento("p", `Fase: ${partido.faseTorneo}`)
                );
            }

            if (partido.jornadaTorneo) {
                tarjeta.appendChild(
                    crearElemento("p", `Grupo / Jornada: ${partido.jornadaTorneo}`)
                );
            }
        }

        // Alineaciones
        if (partido.companero && partido.rivales) {
            const alineacion = document.createElement("div");
            alineacion.className = "alineacion-historial";

            const equipoLocal = document.createElement("div");
            equipoLocal.className = "equipo-historial";

            equipoLocal.appendChild(
                crearElemento("strong", "💚 TEAM GUILLEM")
            );

            equipoLocal.appendChild(
                crearElemento("p", "Guillem")
            );

            equipoLocal.appendChild(
                crearElemento("p", partido.companero.nombre)
            );

            const equipoRival = document.createElement("div");
            equipoRival.className = "equipo-historial";

            equipoRival.appendChild(
                crearElemento("strong", "⚔️ RIVALES")
            );

            partido.rivales.forEach(rival => {
                equipoRival.appendChild(
                    crearElemento("p", rival.nombre)
                );
            });

            alineacion.appendChild(equipoLocal);
            alineacion.appendChild(equipoRival);

            tarjeta.appendChild(alineacion);
        }

        // Marcador
        const marcador = partido.sets
            .map(set => {
                let texto = `${set.local}-${set.rival}`;

                if (set.tbLocal !== null && set.tbRival !== null) {
                    texto += ` (${set.tbLocal}-${set.tbRival})`;
                }

                return texto;
            })
            .join(" / ");

        tarjeta.appendChild(
            crearElemento(
                "p",
                `TEAM GUILLEM  ${marcador}  RIVALES`,
                "marcador-historial"
            )
        );

        // Resultado
        const victoria = partido.resultado === "victoria";

        tarjeta.appendChild(
            crearElemento(
                "strong",
                victoria ? "¡VICTORIA! 🎾" : "DERROTA",
                victoria ? "resultado-victoria" : "resultado-derrota"
            )
        );

        // Análisis personal
        if (
            partido.sensaciones ||
            partido.valoracion ||
            partido.puntosFuertes ||
            partido.aspectosMejorar ||
            partido.observaciones
        ) {
            const analisis = document.createElement("div");
            analisis.className = "analisis-historial";

            analisis.appendChild(
                crearElemento("h5", "🧠 Análisis personal")
            );

            if (partido.sensaciones) {
                analisis.appendChild(
                    crearElemento("p", `Sensaciones: ${partido.sensaciones}`)
                );
            }

            if (partido.valoracion) {
                const filaValoracion = document.createElement("div");
                filaValoracion.className = "fila-valoracion-historial";

                filaValoracion.appendChild(
                    crearElemento("strong", `${partido.valoracion}/10`)
                );

                const barra = document.createElement("div");
                barra.className = "barra-valoracion-historial";

                const progreso = document.createElement("div");
                progreso.className = "progreso-valoracion-historial";

        const valor = Number(partido.valoracion);

progreso.style.width = `${valor * 10}%`;

if (valor <= 4) {
    progreso.style.background = "#FF3B30";
} else if (valor <= 6) {
    progreso.style.background = "#FFCC00";
} else if (valor <= 9) {
    progreso.style.background = "#00FF88";
} else {
    progreso.style.background = "#2196F3";
}

                barra.appendChild(progreso);
                filaValoracion.appendChild(barra);
                analisis.appendChild(filaValoracion);
            }

            if (partido.puntosFuertes) {
                analisis.appendChild(
                    crearElemento("p", `💪 Puntos fuertes: ${partido.puntosFuertes}`)
                );
            }

            if (partido.aspectosMejorar) {
                analisis.appendChild(
                    crearElemento("p", `🎯 A mejorar: ${partido.aspectosMejorar}`)
                );
            }

            if (partido.observaciones) {
                analisis.appendChild(
                    crearElemento("p", `📝 Observaciones: ${partido.observaciones}`)
                );
            }

            tarjeta.appendChild(analisis);
        }

        contenedor.appendChild(tarjeta);
    });
}

async function mostrarHistorialEquipamiento() {
    const datos = await obtenerEquipamiento();

    const contenedorPalas = document.getElementById("historial-palas");
    const contenedorZapatillas = document.getElementById("historial-zapatillas");

    if (!datos) return;

    // Mostrar palas anteriores
    contenedorPalas.innerHTML = "";

    if (!datos.historialPalas || datos.historialPalas.length === 0) {
        contenedorPalas.innerHTML =
            '<p class="historial-vacio">Todavía no hay palas anteriores.</p>';
    } else {
        datos.historialPalas.forEach(pala => {
            const tarjeta = document.createElement("div");
            tarjeta.className = "tarjeta-material-historial";

            tarjeta.innerHTML = `
                <h4>🎾 ${pala.nombre}</h4>
                <p>📅 Compra: ${pala.fechaCompra || "No indicada"}</p>
                <p>🏁 Finalización: ${pala.fechaFin || "No indicada"}</p>
                <strong>🏆 ${pala.partidos} partidos jugados</strong>
            `;

            contenedorPalas.appendChild(tarjeta);
        });
    }

    // Mostrar zapatillas anteriores
    contenedorZapatillas.innerHTML = "";

    if (!datos.historialZapatillas || datos.historialZapatillas.length === 0) {
        contenedorZapatillas.innerHTML =
            '<p class="historial-vacio">Todavía no hay zapatillas anteriores.</p>';
    } else {
        datos.historialZapatillas.forEach(zapatillas => {
            const tarjeta = document.createElement("div");
            tarjeta.className = "tarjeta-material-historial";

            tarjeta.innerHTML = `
                <h4>👟 ${zapatillas.nombre}</h4>
                <p>📅 Compra: ${zapatillas.fechaCompra || "No indicada"}</p>
                <p>🏁 Finalización: ${zapatillas.fechaFin || "No indicada"}</p>
                <strong>🏆 ${zapatillas.partidos} partidos jugados</strong>
            `;

            contenedorZapatillas.appendChild(tarjeta);
        });
    }
}

// ==========================================
// ACTUALIZAR ESTADÍSTICAS E HISTORIAL
// ==========================================
async function actualizarAplicacion() {
    const partidos = await obtenerPartidos();
    await mostrarHistorialEquipamiento();

    await actualizarContadoresMaterial(partidos);

    const total = partidos.length;
    const victorias = partidos.filter(
        partido => partido.resultado === "victoria"
    ).length;

    const derrotas = partidos.filter(
        partido => partido.resultado === "derrota"
    ).length;

    document.getElementById("total-partidos").textContent = total;
    document.getElementById("victorias").textContent = victorias;
    document.getElementById("derrotas").textContent = derrotas;

    mostrarHistorial(partidos);
    actualizarEstadisticasTemporada(partidos);
}

function actualizarEstadisticasTemporada(partidos) {
    const total = partidos.length;

    const victorias = partidos.filter(
        partido => partido.resultado === "victoria"
    ).length;

    const porcentaje = total > 0
        ? Math.round((victorias / total) * 100)
        : 0;

    document.getElementById("porcentaje-victorias").textContent =
        `${porcentaje}%`;

    // BALANCE DE SETS
    let setsFavor = 0;
    let setsContra = 0;

    partidos.forEach(partido => {
        if (!partido.sets) return;

        partido.sets.forEach(set => {
            if (set.local > set.rival) {
                setsFavor++;
            } else if (set.rival > set.local) {
                setsContra++;
            }
        });
    });

    document.getElementById("sets-favor").textContent = setsFavor;
    document.getElementById("sets-contra").textContent = setsContra;

    // RACHA DE RESULTADOS
    actualizarRacha(partidos);
}

function actualizarRacha(partidos) {
    const contenedor = document.getElementById("racha-actual");

    if (partidos.length === 0) {
        contenedor.textContent = "Todavía no hay partidos registrados 🎾";
        return;
    }

    // Ordenar del más reciente al más antiguo
    const ordenados = [...partidos].sort((a, b) => {
        const fechaA = new Date(a.fecha + "T00:00:00").getTime();
        const fechaB = new Date(b.fecha + "T00:00:00").getTime();

        if (fechaA !== fechaB) return fechaB - fechaA;

        return (b.creado || "").localeCompare(a.creado || "");
    });

    // Últimos cinco partidos
    const ultimos = ordenados.slice(0, 5);

    // Racha consecutiva actual
    const resultadoActual = ordenados[0].resultado;
    let racha = 0;

    for (const partido of ordenados) {
        if (partido.resultado !== resultadoActual) break;
        racha++;
    }

    const textoRacha = resultadoActual === "victoria"
        ? `${racha} ${racha === 1 ? "victoria consecutiva" : "victorias consecutivas"}`
        : `${racha} ${racha === 1 ? "derrota consecutiva" : "derrotas consecutivas"}`;

    contenedor.innerHTML = "";

    const titulo = document.createElement("strong");
    titulo.textContent = resultadoActual === "victoria"
        ? `🔥 ${textoRacha}`
        : `💪 ${textoRacha}`;

    const lista = document.createElement("div");
    lista.className = "ultimos-resultados";

    ultimos.forEach(partido => {
        const resultado = document.createElement("span");
        resultado.className = partido.resultado === "victoria"
            ? "resultado-mini victoria-mini"
            : "resultado-mini derrota-mini";

        resultado.textContent = partido.resultado === "victoria" ? "V" : "D";
        resultado.title = partido.resultado === "victoria" ? "Victoria" : "Derrota";

        lista.appendChild(resultado);
    });

    contenedor.appendChild(titulo);
    contenedor.appendChild(lista);
}


// ==========================================
// ESTADÍSTICAS INDIVIDUALES DE JUGADORES
// ==========================================

async function calcularEstadisticasJugador(jugador) {
    const partidos = await obtenerPartidos();

    const partidosJugador = partidos.filter(partido => {
        if (jugador.tipo === "principal") {
            return true;
        }

        if (jugador.tipo === "compañero") {
            return partido.companero?.id === jugador.id;
        }

        if (jugador.tipo === "rival") {
            return partido.rivales?.some(
                rival => rival.id === jugador.id
            );
        }

        return false;
    });

    const total = partidosJugador.length;

    const victorias = partidosJugador.filter(partido => {
        if (
            jugador.tipo === "principal" ||
            jugador.tipo === "compañero"
        ) {
            return partido.resultado === "victoria";
        }

        return partido.resultado === "derrota";
    }).length;

    const derrotas = total - victorias;

    const porcentaje = total > 0
        ? Math.round((victorias / total) * 100)
        : 0;

    return {
        total,
        victorias,
        derrotas,
        porcentaje,
        partidos: partidosJugador
    };
}

function mostrarEstadisticasJugador(jugador) {
    const fichaAnterior = document.getElementById("ficha-estadisticas-jugador");

    if (fichaAnterior) {
        fichaAnterior.remove();
    }

    calcularEstadisticasJugador(jugador).then(datos => {
        const ficha = document.createElement("section");
        ficha.id = "ficha-estadisticas-jugador";
        ficha.className = "ficha-estadisticas-jugador";

        // Cabecera
        const cabecera = document.createElement("div");
        cabecera.className = "cabecera-ficha-jugador";

        const titulo = crearElemento("h2", jugador.nombre);
        const subtitulo = crearElemento(
            "p",
            jugador.tipo === "compañero"
                ? "💚 Compañero de TEAM GUILLEM"
                : "⚔️ Rival de TEAM GUILLEM"
        );

        cabecera.appendChild(titulo);
        cabecera.appendChild(subtitulo);
        ficha.appendChild(cabecera);

        // Resumen de estadísticas
        const resumen = document.createElement("div");
        resumen.className = "resumen-estadisticas-jugador";

        const crearEstadistica = (numero, texto) => {
            const bloque = document.createElement("article");
            bloque.appendChild(crearElemento("strong", String(numero)));
            bloque.appendChild(crearElemento("span", texto));
            resumen.appendChild(bloque);
        };

        crearEstadistica(datos.total, "Partidos");
        crearEstadistica(datos.victorias, "Victorias");
        crearEstadistica(datos.derrotas, "Derrotas");
        crearEstadistica(`${datos.porcentaje}%`, "Porcentaje");

        ficha.appendChild(resumen);

        // Historial individual
        ficha.appendChild(
            crearElemento("h3", "Historial de enfrentamientos")
        );

        if (datos.partidos.length === 0) {
            ficha.appendChild(
                crearElemento("p", "Todavía no hay partidos registrados.")
            );
        } else {
            datos.partidos
                .sort((a, b) => b.fecha.localeCompare(a.fecha))
                .forEach(partido => {
                    const tarjeta = document.createElement("article");
                    tarjeta.className = "partido-individual";

                    const fecha = new Date(
                        partido.fecha + "T00:00:00"
                    ).toLocaleDateString("es-ES");

                    tarjeta.appendChild(
                        crearElemento("strong", partido.club)
                    );

                    tarjeta.appendChild(
                        crearElemento("p", fecha)
                    );

                    tarjeta.appendChild(
                        crearElemento(
                            "p",
                            partido.sets.map(
                                set => `${set.local}-${set.rival}`
                            ).join(" / ")
                        )
                    );

                    const resultadoIndividual =
    jugador.tipo === "principal" ||
    jugador.tipo === "compañero"
        ? partido.resultado === "victoria"
        : partido.resultado === "derrota";
                    tarjeta.appendChild(
                        crearElemento(
                            "span",
                            resultadoIndividual ? "VICTORIA" : "DERROTA",
                            resultadoIndividual
                                ? "resultado-victoria"
                                : "resultado-derrota"
                        )
                    );

                    ficha.appendChild(tarjeta);
                });
        }

        // Botón cerrar
        const cerrar = document.createElement("button");
        cerrar.textContent = "Cerrar ficha";
        cerrar.className = "cerrar-ficha-jugador";
        cerrar.addEventListener("click", () => ficha.remove());

        ficha.appendChild(cerrar);

        // Mostrar la ficha en la sección de jugadores
        const seccion = document.getElementById("jugadores");
        seccion.appendChild(ficha);

        ficha.scrollIntoView({
            behavior: "smooth",
            block: "start"
        });
    }).catch(error => {
        console.error("Error al calcular estadísticas:", error);
        alert("No se han podido cargar las estadísticas del jugador.");
    });
}

// ==========================================
// NAVEGACIÓN
// ==========================================

function configurarMenu() {
    const botones = document.querySelectorAll(".menu-btn");

    botones.forEach(boton => {
        boton.addEventListener("click", () => {
            const seleccionada = boton.dataset.seccion;

            document.querySelectorAll("#app > section").forEach(seccion => {
                seccion.style.display = "none";
            });

            const seccion = document.getElementById(seleccionada);

            if (seccion) {
                seccion.style.display = "block";
            }

            botones.forEach(b => b.classList.remove("active"));
            boton.classList.add("active");
        });
    });
}
function configurarTipoPartido() {
    const botones = document.querySelectorAll(".tipo-partido-btn");
    const campoTipo = document.getElementById("tipo");
    const datosTorneo = document.getElementById("datos-torneo");

    botones.forEach(boton => {
        boton.addEventListener("click", () => {

            // Guardar el tipo seleccionado
            campoTipo.value = boton.dataset.tipo;

            // Actualizar selección visual
            botones.forEach(b => b.classList.remove("seleccionado"));
            boton.classList.add("seleccionado");

            // Mostrar u ocultar datos del torneo
            if (campoTipo.value === "Torneo") {
                datosTorneo.style.display = "block";
            } else {
                datosTorneo.style.display = "none";
            }
        });
    });
}
function mostrarInicio() {
    document.querySelectorAll("#app > section").forEach(seccion => {
        seccion.style.display = "none";
    });

    document.getElementById("inicio").style.display = "block";
}
// ==========================================
// GESTIÓN DE JUGADORES
// ==========================================

async function obtenerJugadores() {
    const db = await abrirBaseDatos();

    return new Promise((resolve, reject) => {
        const transaccion = db.transaction("jugadores", "readonly");
        const almacen = transaccion.objectStore("jugadores");
        const solicitud = almacen.getAll();

        solicitud.onsuccess = () => resolve(solicitud.result);
        solicitud.onerror = () => reject(solicitud.error);
    });
}
async function obtenerEquipamiento() {
    const db = await abrirBaseDatos();

    return new Promise((resolve, reject) => {
        const transaccion = db.transaction("equipamiento", "readonly");
        const almacen = transaccion.objectStore("equipamiento");
        const solicitud = almacen.get("material");

        solicitud.onsuccess = () => resolve(solicitud.result);
        solicitud.onerror = () => reject(solicitud.error);
    });
}
async function guardarEquipamiento(datos) {
    const db = await abrirBaseDatos();

    return new Promise((resolve, reject) => {
        const transaccion = db.transaction("equipamiento", "readwrite");
        const almacen = transaccion.objectStore("equipamiento");

        almacen.put(datos);

        transaccion.oncomplete = () => resolve();
        transaccion.onerror = () => reject(transaccion.error);
    });
}
function actualizarEstadoOvergrip() {
    const fechaValor = document.getElementById("fecha-overgrip").value;
    const contenedor = document.getElementById("estado-overgrip");
    const texto = document.getElementById("texto-overgrip");

    contenedor.className = "estado-overgrip";

    if (!fechaValor) {
        texto.textContent = "Introduce la fecha del cambio";
        return;
    }

    const [anio, mes, dia] = fechaValor.split("-").map(Number);

    const fechaCambio = new Date(anio, mes - 1, dia);
    const hoy = new Date();

    hoy.setHours(0, 0, 0, 0);
    fechaCambio.setHours(0, 0, 0, 0);

    const dias = Math.floor(
        (hoy - fechaCambio) / (1000 * 60 * 60 * 24)
    );

    if (dias < 0) {
        texto.textContent = "La fecha introducida es futura";
        contenedor.classList.add("overgrip-neutral");
    } else if (dias < 30) {
        texto.textContent = `🟢 ${dias} días · Overgrip relativamente reciente`;
        contenedor.classList.add("overgrip-verde");
    } else if (dias < 45) {
        texto.textContent = `🟡 ${dias} días · Conviene revisar su estado`;
        contenedor.classList.add("overgrip-amarillo");
    } else {
        texto.textContent = `🔴 ${dias} días · Quizá sea hora de cambiarlo`;
        contenedor.classList.add("overgrip-rojo");
    }
}
async function guardarDatosPala() {
    const actual = await obtenerEquipamiento() || {
    id: "material",
    pala: {},
    zapatillas: {},
    historialPalas: [],
    historialZapatillas: []
};

// Asegurar que existen los historiales
actual.historialPalas = actual.historialPalas || [];
actual.historialZapatillas = actual.historialZapatillas || [];
// Comprobar si estamos cambiando de pala
const nombreAnterior = actual.pala?.nombre || "";
const nombreNuevo = document.getElementById("nombre-pala").value.trim();

if (nombreAnterior && nombreNuevo &&
    nombreAnterior !== nombreNuevo) {

    const partidos = await obtenerPartidos();

    const fechaCompra = actual.pala.fechaCompra || "";

    const partidosJugados = fechaCompra
        ? partidos.filter(partido => partido.fecha >= fechaCompra).length
        : 0;

    actual.historialPalas.push({
        nombre: actual.pala.nombre,
        fechaCompra: actual.pala.fechaCompra || "",
        fechaFin: new Date().toISOString().split("T")[0],
        partidos: partidosJugados
    });
}

    actual.pala = {
        nombre: document.getElementById("nombre-pala").value,
        fechaCompra: document.getElementById("fecha-compra-pala").value,
        previsionCambio: document.getElementById("prevision-cambio-pala").value,
        fechaOvergrip: document.getElementById("fecha-overgrip").value,
        foto: document.getElementById("foto-pala").src.startsWith("data:")
            ? document.getElementById("foto-pala").src
            : actual.pala?.foto || ""
    };

    await guardarEquipamiento(actual);
const partidos = await obtenerPartidos();
await actualizarContadoresMaterial(partidos);
    alert("¡Pala guardada correctamente! 🎾");
}


async function guardarDatosZapatillas() {
    const actual = await obtenerEquipamiento() || {
    id: "material",
    pala: {},
    zapatillas: {},
    historialPalas: [],
    historialZapatillas: []
};

actual.historialPalas = actual.historialPalas || [];
actual.historialZapatillas = actual.historialZapatillas || [];
// Comprobar si estamos cambiando de zapatillas
const nombreAnterior = actual.zapatillas?.nombre || "";
const nombreNuevo = document.getElementById("nombre-zapatillas").value.trim();

if (nombreAnterior && nombreNuevo &&
    nombreAnterior !== nombreNuevo) {

    const partidos = await obtenerPartidos();

    const fechaCompra = actual.zapatillas.fechaCompra || "";

    const partidosJugados = fechaCompra
        ? partidos.filter(partido => partido.fecha >= fechaCompra).length
        : 0;

    actual.historialZapatillas.push({
        nombre: actual.zapatillas.nombre,
        fechaCompra: actual.zapatillas.fechaCompra || "",
        fechaFin: new Date().toISOString().split("T")[0],
        partidos: partidosJugados
    });
}

    actual.zapatillas = {
        nombre: document.getElementById("nombre-zapatillas").value,
        fechaCompra: document.getElementById("fecha-compra-zapatillas").value,
        foto: document.getElementById("foto-zapatillas").src.startsWith("data:")
            ? document.getElementById("foto-zapatillas").src
            : actual.zapatillas?.foto || ""
    };

    await guardarEquipamiento(actual);

    alert("¡Zapatillas guardadas correctamente! 👟");
}

async function cargarEquipamientoEnPantalla() {
    const datos = await obtenerEquipamiento();

    if (!datos) return;

    // Cargar pala
    if (datos.pala) {
        document.getElementById("nombre-pala").value =
            datos.pala.nombre || "";

        document.getElementById("fecha-compra-pala").value =
            datos.pala.fechaCompra || "";

        document.getElementById("prevision-cambio-pala").value =
            datos.pala.previsionCambio || "";

        document.getElementById("fecha-overgrip").value =
            datos.pala.fechaOvergrip || "";

        if (datos.pala.foto) {
            document.getElementById("foto-pala").src =
                datos.pala.foto;
        }
    }

    // Cargar zapatillas
    if (datos.zapatillas) {
        document.getElementById("nombre-zapatillas").value =
            datos.zapatillas.nombre || "";

        document.getElementById("fecha-compra-zapatillas").value =
            datos.zapatillas.fechaCompra || "";

        if (datos.zapatillas.foto) {
            document.getElementById("foto-zapatillas").src =
                datos.zapatillas.foto;
        }
    }
}
async function actualizarContadoresMaterial(partidos) {
    const datos = await obtenerEquipamiento();

    const fechaCompra = datos?.pala?.fechaCompra || "";
    const fechaOvergrip = datos?.pala?.fechaOvergrip || "";

    // Contar partidos desde la compra de la pala
    const totalPala = fechaCompra
        ? partidos.filter(partido => partido.fecha >= fechaCompra).length
        : 0;

    // Contar partidos desde el último cambio de overgrip
    const totalOvergrip = fechaOvergrip
        ? partidos.filter(partido => partido.fecha >= fechaOvergrip).length
        : 0;

    document.getElementById("partidos-pala").textContent = totalPala;
    document.getElementById("partidos-overgrip").textContent = totalOvergrip;
}
function configurarFotosEquipamiento() {
    const archivoPala = document.getElementById("archivo-pala");
    const archivoZapatillas = document.getElementById("archivo-zapatillas");

    archivoPala.addEventListener("change", () => {
        mostrarVistaPrevia(archivoPala, "foto-pala");
    });

    archivoZapatillas.addEventListener("change", () => {
        mostrarVistaPrevia(archivoZapatillas, "foto-zapatillas");
    });
}

function mostrarVistaPrevia(input, imagenId) {
    const archivo = input.files[0];

    if (!archivo) return;

    const lector = new FileReader();

    lector.onload = () => {
        document.getElementById(imagenId).src = lector.result;
    };

    lector.readAsDataURL(archivo);
}
async function guardarJugador(jugador) {
    const db = await abrirBaseDatos();

    return new Promise((resolve, reject) => {
        const transaccion = db.transaction("jugadores", "readwrite");
        const almacen = transaccion.objectStore("jugadores");

        almacen.add(jugador);

        transaccion.oncomplete = () => resolve();
        transaccion.onerror = () => reject(transaccion.error);
    });
}

async function gestionarFormularioJugador(event) {
    event.preventDefault();

    const nombre = document.getElementById("nombre-jugador").value.trim();
    const tipo = document.getElementById("tipo-jugador").value;

    try {
        if (!nombre || !tipo) {
            throw new Error("Completa todos los campos.");
        }

        const jugadores = await obtenerJugadores();

        const yaExiste = jugadores.some(
            jugador => jugador.nombre.toLowerCase() === nombre.toLowerCase()
        );

        if (nombre.toLowerCase() === "guillem" || yaExiste) {
            throw new Error("Este jugador ya está registrado.");
        }

        await guardarJugador({
            nombre,
            tipo,
            creado: new Date().toISOString()
        });

        document.getElementById("form-jugador").reset();

await actualizarListaJugadores();
await cargarSelectoresJugadores();

alert(`${nombre} se ha añadido correctamente. 🎾`);
    } catch (error) {
        alert(error.message || "No se ha podido añadir el jugador.");
    }
}


// ==========================================
// ACTUALIZAR LISTA DE JUGADORES
// ==========================================

async function actualizarListaJugadores() {
    const jugadores = await obtenerJugadores();

    const companeros = document.getElementById("lista-companeros");
    const rivales = document.getElementById("lista-rivales");

    companeros.innerHTML = "";
    rivales.innerHTML = "";

    // Guillem como jugador principal
    const jugadorPrincipal = {
        nombre: "Guillem",
        tipo: "principal"
    };

    const fichaGuillem = document.createElement("article");
    fichaGuillem.className =
        "jugador-card jugador-principal jugador-interactivo";

    fichaGuillem.appendChild(
        crearElemento("strong", "💚 Guillem")
    );

    fichaGuillem.appendChild(
        crearElemento("span", "Jugador principal")
    );

    fichaGuillem.appendChild(
        crearElemento("span", "Ver mis estadísticas →", "ver-estadisticas")
    );

    fichaGuillem.setAttribute("role", "button");
    fichaGuillem.setAttribute("tabindex", "0");

    fichaGuillem.addEventListener("click", () => {
        mostrarEstadisticasJugador(jugadorPrincipal);
    });

    fichaGuillem.addEventListener("keydown", event => {
        if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            mostrarEstadisticasJugador(jugadorPrincipal);
        }
    });

    companeros.appendChild(fichaGuillem);

    const listaCompaneros = jugadores.filter(
        jugador => jugador.tipo === "compañero"
    );

    const listaRivales = jugadores.filter(
        jugador => jugador.tipo === "rival"
    );

    mostrarJugadores(listaCompaneros, companeros);
    mostrarJugadores(listaRivales, rivales);
}

// ==========================================
// CARGAR JUGADORES EN EL FORMULARIO DE PARTIDOS
// ==========================================

async function cargarSelectoresJugadores() {
    const jugadores = await obtenerJugadores();

    const companero = document.getElementById("compañero-partido");
    const rival1 = document.getElementById("rival1-partido");
    const rival2 = document.getElementById("rival2-partido");

    companero.innerHTML = '<option value="">Selecciona tu compañero</option>';
    rival1.innerHTML = '<option value="">Selecciona el primer rival</option>';
    rival2.innerHTML = '<option value="">Selecciona el segundo rival</option>';

    const companeros = jugadores.filter(j => j.tipo === "compañero");
    const rivales = jugadores.filter(j => j.tipo === "rival");

    companeros.forEach(jugador => {
        const opcion = document.createElement("option");
        opcion.value = jugador.id;
        opcion.textContent = jugador.nombre;
        companero.appendChild(opcion);
    });

    rivales.forEach(jugador => {
        const opcion1 = document.createElement("option");
        opcion1.value = jugador.id;
        opcion1.textContent = jugador.nombre;
        rival1.appendChild(opcion1);

        const opcion2 = document.createElement("option");
        opcion2.value = jugador.id;
        opcion2.textContent = jugador.nombre;
        rival2.appendChild(opcion2);
    });
}


function mostrarJugadores(jugadores, contenedor) {
    if (jugadores.length === 0) {
        contenedor.appendChild(
            crearElemento("p", "Todavía no hay jugadores registrados.")
        );
        return;
    }

    jugadores.forEach(jugador => {
        const ficha = document.createElement("article");
        ficha.className = "jugador-card jugador-interactivo";

        ficha.appendChild(
            crearElemento("strong", jugador.nombre)
        );

        ficha.appendChild(
            crearElemento(
                "span",
                jugador.tipo === "compañero" ? "Compañero" : "Rival"
            )
        );

        const indicacion = crearElemento("span", "Ver estadísticas →");
        indicacion.className = "ver-estadisticas";

        ficha.appendChild(indicacion);

        ficha.setAttribute("role", "button");
        ficha.setAttribute("tabindex", "0");

        ficha.addEventListener("click", () => {
            mostrarEstadisticasJugador(jugador);
        });

        ficha.addEventListener("keydown", event => {
            if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                mostrarEstadisticasJugador(jugador);
            }
        });

        contenedor.appendChild(ficha);
    });
}

function configurarFormularioJugadores() {
    const formulario = document.getElementById("form-jugador");

    formulario.addEventListener("submit", gestionarFormularioJugador);
}

// ==========================================
// INICIO DE LA APLICACIÓN
// ==========================================

document.addEventListener("DOMContentLoaded", async () => {
    console.log("🎾 Padel Manager iniciado");
document.getElementById("fecha-compra-pala")
    .addEventListener("change", calcularPrevisionCambioPala);
    configurarMenu();
configurarTipoPartido();
configurarValoracionPartido();
mostrarInicio();

document.getElementById("fecha-overgrip")
    .addEventListener("change", actualizarEstadoOvergrip);
cargarEquipamientoEnPantalla();
actualizarEstadoOvergrip();
document.getElementById("guardar-pala")
    .addEventListener("click", guardarDatosPala);

document.getElementById("guardar-zapatillas")
    .addEventListener("click", guardarDatosZapatillas);
configurarFotosEquipamiento();
    configurarFormularioJugadores();

    await actualizarListaJugadores();

    await cargarSelectoresJugadores();

    document
        .getElementById("form-partido")
        .addEventListener("submit", gestionarFormulario);

    try {
        await actualizarAplicacion();
    } catch (error) {
        console.error("Error al iniciar la aplicación:", error);
        alert("No se han podido cargar los partidos guardados.");
    }
});

function calcularPrevisionCambioPala() {
    const fechaCompra = document.getElementById("fecha-compra-pala").value;
    const prevision = document.getElementById("prevision-cambio-pala");

    if (!fechaCompra) {
        prevision.value = "";
        return;
    }

    const [anio, mes, dia] = fechaCompra.split("-").map(Number);

    const fecha = new Date(anio, mes - 1, dia);
    const diaOriginal = fecha.getDate();

    fecha.setMonth(fecha.getMonth() + 10);

    // Evitar saltos de mes en fechas como el día 31
    if (fecha.getDate() < diaOriginal) {
        fecha.setDate(0);
    }

    const anioFinal = fecha.getFullYear();
    const mesFinal = String(fecha.getMonth() + 1).padStart(2, "0");
    const diaFinal = String(fecha.getDate()).padStart(2, "0");

    prevision.value = `${anioFinal}-${mesFinal}-${diaFinal}`;
}
