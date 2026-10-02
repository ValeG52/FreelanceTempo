// sistema/prioridad.ts
// Reglas para prender/apagar el switch de prioridad alta de una empresa.
// Igual que cronograma: no sabe nada de React ni de AsyncStorage.
// Recibe datos y devuelve datos NUEVOS (no modifica los originales).

import { Empresa, Paquete, BloqueHorario, JornadaLaboral } from "../type/index";
import { fechaLocalISO, generarDiaUrgente, recalcularEmpresa } from "./cronograma";

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
  const { fechaActivacionPrioridad: _fecha, empresasDesplazadas: _desplazadas, ...resto } = empresa;
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

  const resultado = generarDiaUrgente(
    activada,
    paquete,
    fechaHoy,
    jornada,
    sinSusFuturos,
    reemplazarEmpresa(empresas, activada),
    paquetes
  );

  const final: Empresa = { ...activada, empresasDesplazadas: resultado.empresasAfectadas };
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
  if (empresa.prioridad === "media") return { empresas, bloques, empresasSinCupo: [] };

  const fechaHoy = fechaLocalISO(ahora);
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
