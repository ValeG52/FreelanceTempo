// sistema/prioridad.ts
// Reglas para prender/apagar el switch de prioridad alta de una empresa.
// Igual que cronograma: no sabe nada de React ni de AsyncStorage.
// Recibe datos y devuelve datos NUEVOS (no modifica los originales).

import { Empresa, Paquete, BloqueHorario, JornadaLaboral } from "../type/index";
import {
  ajustarCronogramaAJornada,
  calcularHorasConsumidas,
  esDiaHabil,
  fechaLocalISO,
  generarDiaUrgente,
  momentoDe,
  recalcularEmpresa,
} from "./cronograma";
import { aplicarRenovaciones } from "./renovacion";

// Prende el switch. Guardo la fecha y HORA exacta de activación (ISO completo,
// no solo "YYYY-MM-DD") porque es lo que define el orden FIFO entre varias
// empresas en alta: si dos se activan el mismo día, gana la que se activó antes.
export function activarPrioridadAlta(empresa: Empresa, ahora: Date): Empresa {
  // si ya estaba en alta, no toco nada: no quiero que pierda su lugar en la fila FIFO
  if (empresa.prioridad === "alta") return empresa;

  // "{ ...empresa, x }" crea una copia del objeto pisando solo el campo x
  // (parecido a un "with" de records en C#)
  return {
    ...empresa,
    prioridad: "alta",
    fechaActivacionPrioridad: ahora.toISOString(),
    empresasDesplazadas: [],
  };
}

// Apaga el switch: vuelve a "media" y se borran los campos que solo tienen
// sentido mientras está en alta.
export function desactivarPrioridadAltaEmpresa(empresa: Empresa): Empresa {
  if (empresa.prioridad === "media") return empresa;

  // saco esos campos del objeto con desestructuración: las variables con "_"
  // se quedan con los campos descartados y "resto" con todo lo demás
  const {
    fechaActivacionPrioridad: _fecha,
    empresasDesplazadas: _desplazadas,
    ultimoDiaUrgente: _ultimoDia,
    ...resto
  } = empresa;
  return { ...resto, prioridad: "media" };
}

// Devuelve las empresas en alta ordenadas FIFO (la que activó primero va primero).
// La va a necesitar el chequeo diario que llame a generarDiaUrgente.
export function empresasEnAltaPorOrdenFIFO(empresas: Empresa[]): Empresa[] {
  return empresas
    .filter((e) => e.prioridad === "alta" && e.fechaActivacionPrioridad)
    .sort((a, b) =>
      // las fechas ISO se pueden comparar como texto y el orden queda bien
      (a.fechaActivacionPrioridad ?? "").localeCompare(b.fechaActivacionPrioridad ?? "")
    );
}

// ---------------------------------------------------------
// Lo que hace el switch completo (empresa + cronograma).
// Devuelven las listas completas ya actualizadas, listas para guardar.
// ---------------------------------------------------------

function reemplazarEmpresa(empresas: Empresa[], actualizada: Empresa): Empresa[] {
  return empresas.map((e) => (e.id === actualizada.id ? actualizada : e));
}

function buscarPaquete(paquetes: Paquete[], empresa: Empresa): Paquete {
  const paquete = paquetes.find((p) => p.id === empresa.paqueteId);
  if (!paquete) throw new Error(`No se encontró el paquete de ${empresa.nombre}`);
  return paquete;
}

export interface ResultadoActivacionAlta {
  empresas: Empresa[];
  bloques: BloqueHorario[];
  bloquesPerdidos: BloqueHorario[]; // bloques de otras empresas que no se pudieron reubicar
}

export function aplicarActivacionAlta(
  empresa: Empresa,
  empresas: Empresa[],
  paquetes: Paquete[],
  jornada: JornadaLaboral,
  bloques: BloqueHorario[],
  ahora: Date
): ResultadoActivacionAlta {
  if (empresa.prioridad === "alta") return { empresas, bloques, bloquesPerdidos: [] };

  const paquete = buscarPaquete(paquetes, empresa);
  const fechaHoy = fechaLocalISO(ahora);
  const activada = activarPrioridadAlta(empresa, ahora);

  // Sus bloques normales de mañana en adelante se descartan: mientras esté en
  // alta trabaja con el bloque x4 diario, y al apagar se recalcula lo que le quede.
  // Los de hoy se quedan (pueden ya estar hechos y cuentan como horas consumidas).
  const sinSusFuturos = bloques.filter((b) => !(b.empresaId === empresa.id && b.fecha > fechaHoy));

  // Si hoy no se trabaja (sábado, domingo o día libre), hoy no hay x4:
  // el primero lo genera el chequeo diario el próximo día hábil.
  if (!esDiaHabil(jornada, fechaHoy)) {
    const final: Empresa = { ...activada, empresasDesplazadas: [], ultimoDiaUrgente: fechaHoy };
    return { empresas: reemplazarEmpresa(empresas, final), bloques: sinSusFuturos, bloquesPerdidos: [] };
  }

  const resultado = generarDiaUrgente(
    activada,
    paquete,
    fechaHoy,
    jornada,
    sinSusFuturos,
    reemplazarEmpresa(empresas, activada),
    paquetes,
    momentoDe(ahora) // el x4 de hoy arranca desde la hora actual
  );

  // ultimoDiaUrgente = hoy: el x4 de hoy ya está, así el chequeo diario no lo repite
  const final: Empresa = {
    ...activada,
    empresasDesplazadas: resultado.empresasAfectadas,
    ultimoDiaUrgente: fechaHoy,
  };
  return {
    empresas: reemplazarEmpresa(empresas, final),
    bloques: resultado.bloques,
    bloquesPerdidos: resultado.bloquesPerdidos,
  };
}

export interface ResultadoDesactivacionAlta {
  empresas: Empresa[];
  bloques: BloqueHorario[];
  empresasSinCupo: Empresa[]; // las que no se pudieron recalcular (quedaron como estaban)
}

export function aplicarDesactivacionAlta(
  empresa: Empresa,
  empresas: Empresa[],
  paquetes: Paquete[],
  jornada: JornadaLaboral,
  bloques: BloqueHorario[],
  ahora: Date
): ResultadoDesactivacionAlta {
  return desactivarAltaEnFecha(empresa, empresas, paquetes, jornada, bloques, fechaLocalISO(ahora));
}

/**
 * Lo que hace apagar el switch, con la fecha de hoy ya como texto
 * ("YYYY-MM-DD"). La usan el switch manual (aplicarDesactivacionAlta) y el
 * apagado automático del chequeo diario cuando se agota el paquete.
 */
function desactivarAltaEnFecha(
  empresa: Empresa,
  empresas: Empresa[],
  paquetes: Paquete[],
  jornada: JornadaLaboral,
  bloques: BloqueHorario[],
  fechaHoy: string
): ResultadoDesactivacionAlta {
  if (empresa.prioridad === "media") return { empresas, bloques, empresasSinCupo: [] };

  const apagada = desactivarPrioridadAltaEmpresa(empresa);
  let listaEmpresas = reemplazarEmpresa(empresas, apagada);
  let listaBloques = bloques;
  const empresasSinCupo: Empresa[] = [];

  // Primero la que se apaga (reparte sus horas restantes con bloque normal en
  // lo que queda de su ventana). Después las que desplazó, por orden de alta,
  // para que vuelvan a su patrón habitual. Las desplazadas que hoy están en
  // alta no se tocan: a esas las maneja su propio bloque x4.
  const idsDesplazadas = empresa.empresasDesplazadas ?? [];
  const desplazadas = listaEmpresas
    .filter((e) => idsDesplazadas.includes(e.id) && e.id !== empresa.id && e.prioridad === "media")
    .sort((a, b) => a.fechaAlta.localeCompare(b.fechaAlta));
  const aRecalcular = [apagada, ...desplazadas];

  for (const actual of aRecalcular) {
    const resultado = recalcularEmpresa(actual, buscarPaquete(paquetes, actual), fechaHoy, jornada, listaBloques);
    listaBloques = resultado.bloques;
    if (!resultado.exito) empresasSinCupo.push(actual);
    listaEmpresas = reemplazarEmpresa(listaEmpresas, { ...actual, horasConsumidas: resultado.horasConsumidas });
  }

  return { empresas: listaEmpresas, bloques: listaBloques, empresasSinCupo };
}

// ---------------------------------------------------------
// Chequeo diario: mientras el switch esté prendido, cada día la empresa
// recibe su bloque x4. Se llama al abrir la app y al cambiar el día.
// ---------------------------------------------------------

export interface ResultadoChequeoDiario {
  empresas: Empresa[];
  bloques: BloqueHorario[];
  bloquesPerdidos: BloqueHorario[]; // bloques de otras empresas que no se pudieron reubicar
  empresasFinalizadas: Empresa[];   // las que agotaron su paquete y se les apagó el switch solo
  empresasSinCupo: Empresa[];       // desplazadas que no se pudieron recalcular al apagarse una
  empresasRenovadas: Empresa[];     // las que arrancaron una ventana nueva hoy
  empresasFueraDeJornada: Empresa[]; // tienen sesiones en fin de semana / fuera de horario que no se pudieron mover
  empresasSinCupoRenovacion: Empresa[]; // las que no se pudieron renovar por falta de lugar
  huboCambios: boolean;             // false = no había nada que generar, no hace falta guardar
}

/**
 * true si la empresa ya consumió todas las horas de su paquete
 * (sus bloques de hoy para atrás suman lo mismo que el paquete o más).
 * Comparo en minutos enteros para no tener problemas de decimales.
 */
function paqueteAgotado(empresa: Empresa, paquete: Paquete, bloques: BloqueHorario[], fechaHoy: string): boolean {
  const minutosConsumidos = Math.round(calcularHorasConsumidas(empresa, bloques, fechaHoy) * 60);
  return minutosConsumidos >= paquete.horas * 60;
}

/**
 * Último día para el que la empresa ya tiene generado su bloque x4.
 * Las empresas que se pusieron en alta antes de que existiera el campo
 * `ultimoDiaUrgente` usan el día en que activaron el switch (ese día sí
 * se les generó el x4).
 */
function ultimoDiaConX4(empresa: Empresa): string | null {
  if (empresa.ultimoDiaUrgente) return empresa.ultimoDiaUrgente;
  if (empresa.fechaActivacionPrioridad) return fechaLocalISO(new Date(empresa.fechaActivacionPrioridad));
  return null;
}

/**
 * Chequeo diario: primero renueva los paquetes de las empresas cuya ventana
 * terminó (ver sistema/renovacion.ts), y después genera el bloque x4 de hoy
 * para cada empresa en prioridad alta que todavía no lo tenga. Se puede
 * llamar todas las veces que se quiera en el mismo día: la segunda vez no
 * hace nada (huboCambios: false).
 *
 * - Si una empresa ya consumió todas las horas de su paquete, se le apaga el
 *   switch solo (igual que apagarlo a mano: vuelve a media y las que corrió
 *   vuelven a su patrón habitual) y se devuelve en `empresasFinalizadas`.
 * - El excedente de días anteriores se va sumando, pero generarDiaUrgente
 *   nunca agenda más horas de las que le quedan del paquete.
 * - Van en orden FIFO: la que activó el switch primero elige lugar primero.
 * - Solo genera el día de HOY. Si la app no se abrió algunos días, esos días
 *   no se rellenan: poner bloques en el pasado correría a otras empresas en
 *   días que ya pasaron.
 * - Las empresas que corre se suman a `empresasDesplazadas`, para que al
 *   apagar el switch vuelvan a su patrón habitual.
 * @param ahora momento actual (fecha de hoy y hora, para no agendar hoy en horarios que ya pasaron)
 * @returns las listas completas ya actualizadas, listas para guardar
 */
export function aplicarChequeoDiario(
  empresas: Empresa[],
  paquetes: Paquete[],
  jornada: JornadaLaboral,
  bloques: BloqueHorario[],
  ahora: Date
): ResultadoChequeoDiario {
  const momento = momentoDe(ahora);
  const fechaHoy = momento.fecha;

  // 0) Renovaciones: las empresas cuya ventana terminó arrancan una nueva
  const renovaciones = aplicarRenovaciones(empresas, paquetes, jornada, bloques, momento);
  let listaEmpresas = renovaciones.empresas;
  let listaBloques = renovaciones.bloques;
  const bloquesPerdidos: BloqueHorario[] = [];
  const empresasFinalizadas: Empresa[] = [];
  const empresasSinCupo: Empresa[] = [];
  let huboCambios = renovaciones.huboCambios;

  for (const enAlta of empresasEnAltaPorOrdenFIFO(listaEmpresas)) {
    // busco la versión actualizada de la empresa (una anterior en la fila
    // pudo haberla cambiado) y el estado actual de los bloques
    const actual = listaEmpresas.find((e) => e.id === enAlta.id) ?? enAlta;
    const paquete = buscarPaquete(paquetes, actual);

    // 1) ¿Ya consumió todo el paquete? → se apaga el switch solo
    if (paqueteAgotado(actual, paquete, listaBloques, fechaHoy)) {
      const apagado = desactivarAltaEnFecha(actual, listaEmpresas, paquetes, jornada, listaBloques, fechaHoy);
      listaEmpresas = apagado.empresas;
      listaBloques = apagado.bloques;
      empresasFinalizadas.push(actual);
      // la que se apaga tiene 0 horas restantes, así que acá solo pueden
      // aparecer desplazadas que no volvieron a entrar
      empresasSinCupo.push(...apagado.empresasSinCupo.filter((e) => e.id !== actual.id));
      huboCambios = true;
      continue; // "continue" pasa a la siguiente empresa de la fila
    }

    // 2) ¿Ya tiene el x4 de hoy, o hoy no se trabaja (fin de semana / día libre)? → nada
    const ultimoDia = ultimoDiaConX4(actual);
    if (ultimoDia !== null && ultimoDia >= fechaHoy) continue;
    if (!esDiaHabil(jornada, fechaHoy)) continue;

    // 3) Le genero el x4 de hoy
    const resultado = generarDiaUrgente(
      actual,
      paquete,
      fechaHoy,
      jornada,
      listaBloques,
      listaEmpresas,
      paquetes,
      momento // el x4 de hoy arranca desde la hora actual
    );

    // new Set(...) junta las dos listas sin repetidos (como Union en LINQ)
    const desplazadas = Array.from(
      new Set([...(actual.empresasDesplazadas ?? []), ...resultado.empresasAfectadas])
    );
    listaEmpresas = reemplazarEmpresa(listaEmpresas, {
      ...actual,
      empresasDesplazadas: desplazadas,
      ultimoDiaUrgente: fechaHoy,
    });
    listaBloques = resultado.bloques;
    bloquesPerdidos.push(...resultado.bloquesPerdidos);
    huboCambios = true;
  }

  // 4) Ninguna sesión de mañana en adelante puede quedar en fin de semana o
  //    fuera de la jornada (por ej. las que se agendaron antes de esta regla):
  //    las que estén afuera se mueven a días hábiles dentro de su ventana.
  const ajuste = ajustarCronogramaAJornada(jornada, listaEmpresas, paquetes, listaBloques, fechaHoy);
  if (ajuste.exito && ajuste.bloquesMovidos > 0) {
    listaBloques = ajuste.bloques;
    huboCambios = true;
  }

  return {
    empresas: listaEmpresas,
    bloques: listaBloques,
    bloquesPerdidos,
    empresasFinalizadas,
    empresasSinCupo,
    empresasFueraDeJornada: ajuste.exito ? [] : ajuste.empresasSinLugar,
    empresasRenovadas: renovaciones.renovadas,
    empresasSinCupoRenovacion: renovaciones.sinCupo,
    huboCambios,
  };
}
