// sistema/jornada.ts
// Reglas de la jornada laboral: cómo se edita, cómo se valida y cómo se
// convierte a lo que se guarda. Igual que el resto de sistema/: no sabe nada
// de React ni de AsyncStorage, solo recibe datos y devuelve datos.

import { DiaSemana, JornadaLaboral, RangoHorario } from "../type/index";
import { horaAMinutos, minutosAHora } from "./cronograma";

/** Días que se pueden configurar, en el orden de la pantalla. Sábado y domingo
 *  no están: esos días nunca hay sesiones. */
export const DIAS_ORDENADOS: DiaSemana[] = ["lunes", "martes", "miercoles", "jueves", "viernes"];

/** Nombre de cada día para mostrar (el tipo DiaSemana va sin tildes). */
export const NOMBRES_DIAS: Record<DiaSemana, string> = {
  lunes: "Lunes",
  martes: "Martes",
  miercoles: "Miércoles",
  jueves: "Jueves",
  viernes: "Viernes",
  sabado: "Sábado",
  domingo: "Domingo",
};

/** Cuánto se mueve una hora con cada toque de los botones − / +. */
export const PASO_MINUTOS = 30;

/** Horario que se propone para un día que no tenía horario cargado. */
const RANGO_INICIAL: RangoHorario = { horaInicio: "09:00", horaFin: "18:00" };

/** Un día en la pantalla de edición: si se trabaja, y en qué horario. */
export interface DiaEditable {
  trabaja: boolean;
  rango: RangoHorario; // se conserva aunque se apague "trabaja", por si se vuelve a prender
}

/** Todo lo que se edita en la pantalla de jornada, en un solo objeto. */
export interface JornadaEditable {
  tipo: "fija" | "variable";
  horarioFijo: RangoHorario;
  dias: Record<DiaSemana, DiaEditable>; // Record = diccionario con una entrada por cada día
}

/**
 * Suma (o resta, si es negativo) minutos a una hora "HH:MM", sin salirse del
 * día: nunca baja de 00:00 ni pasa de 24:00 (fin del día).
 * @param hora hora de partida, "HH:MM"
 * @param minutos cuánto mover, por ejemplo 30 o -30
 * @returns la hora nueva, "HH:MM"
 */
export function moverHora(hora: string, minutos: number): string {
  const nueva = Math.min(24 * 60, Math.max(0, horaAMinutos(hora) + minutos));
  return minutosAHora(nueva);
}

/**
 * Convierte la jornada guardada en lo que edita la pantalla. En una jornada
 * variable, un día sin horario es un día libre. Los campos que el tipo
 * elegido no usa se completan con el horario inicial, así al cambiar de
 * FIJA a VARIABLE (o al revés) siempre hay algo razonable cargado.
 * @param jornada la jornada guardada (o la de por defecto)
 * @returns el estado inicial de la pantalla
 */
export function jornadaAEditable(jornada: JornadaLaboral): JornadaEditable {
  const horarioFijo = jornada.horarioFijo ?? RANGO_INICIAL;

  // armo el diccionario día por día: { lunes: {...}, martes: {...}, ... }
  // "as Tipo" = le aviso a TypeScript qué tipo va a tener (lo completo en el for de abajo)
  const dias = {} as Record<DiaSemana, DiaEditable>;
  for (const dia of DIAS_ORDENADOS) {
    const rangoDelDia = jornada.horarioPorDia?.[dia];
    if (jornada.tipo === "variable") {
      dias[dia] = { trabaja: rangoDelDia !== undefined, rango: rangoDelDia ?? horarioFijo };
    } else {
      // si venía de una jornada fija, propongo los 5 días con ese horario
      dias[dia] = { trabaja: true, rango: horarioFijo };
    }
  }

  return { tipo: jornada.tipo, horarioFijo, dias };
}

/**
 * Convierte lo editado en pantalla en la jornada que se guarda. Solo guarda
 * lo que corresponde al tipo elegido: en una jornada variable, los días
 * libres directamente no aparecen.
 * @param editable lo que está cargado en la pantalla
 * @returns la jornada lista para guardar
 */
export function editableAJornada(editable: JornadaEditable): JornadaLaboral {
  if (editable.tipo === "fija") {
    return { tipo: "fija", horarioFijo: editable.horarioFijo };
  }

  const horarioPorDia: Partial<Record<DiaSemana, RangoHorario>> = {};
  for (const dia of DIAS_ORDENADOS) {
    if (editable.dias[dia].trabaja) horarioPorDia[dia] = editable.dias[dia].rango;
  }
  return { tipo: "variable", horarioPorDia };
}

/**
 * Revisa que la jornada tenga sentido antes de guardarla.
 * - Cada horario tiene que empezar antes de terminar.
 * - Una jornada variable tiene que tener al menos un día de trabajo.
 * @param jornada la jornada a revisar
 * @returns el mensaje de error para mostrar, o null si está todo bien
 */
export function validarJornada(jornada: JornadaLaboral): string | null {
  const rangoInvalido = (rango: RangoHorario): boolean =>
    horaAMinutos(rango.horaInicio) >= horaAMinutos(rango.horaFin);

  if (jornada.tipo === "fija") {
    if (!jornada.horarioFijo) return "Falta cargar el horario.";
    if (rangoInvalido(jornada.horarioFijo)) return "La hora de inicio tiene que ser antes que la de fin.";
    return null;
  }

  let diasDeTrabajo = 0;
  for (const dia of DIAS_ORDENADOS) {
    const rango = jornada.horarioPorDia?.[dia];
    if (rango === undefined) continue; // día libre
    diasDeTrabajo++;
    if (rangoInvalido(rango)) {
      return `${NOMBRES_DIAS[dia]}: la hora de inicio tiene que ser antes que la de fin.`;
    }
  }
  if (diasDeTrabajo === 0) return "Elegí al menos un día de trabajo.";
  return null;
}
