// sistema/calendario.ts
// Cálculos de fechas para la vista de calendario (semana / mes) y armado
// de la agenda de varios días. No calcula sesiones nuevas: solo ordena el
// cronograma ya generado. Igual que el resto de sistema/, sin React ni storage.

import { BloqueHorario, Empresa } from "../type/index";
import { armarAgendaDelDia, fechaAUTC, horaAMinutos, sumarDias, SesionDelDia } from "./cronograma";

export type VistaCalendario = "semana" | "mes";

/** Un casillero de la grilla del mes. */
export interface DiaDeGrilla {
  fecha: string;    // "YYYY-MM-DD"
  delMes: boolean;  // false = día del mes anterior/siguiente que completa la semana
}

/**
 * Lunes de la semana de una fecha (la semana arranca el lunes).
 * @param fechaISO cualquier día, "YYYY-MM-DD"
 * @returns el lunes de esa semana, "YYYY-MM-DD"
 */
export function inicioDeSemana(fechaISO: string): string {
  const diaSemana = fechaAUTC(fechaISO).getUTCDay(); // 0 = domingo ... 6 = sábado
  const diasDesdeLunes = (diaSemana + 6) % 7;        // lunes = 0 ... domingo = 6
  return sumarDias(fechaISO, -diasDesdeLunes);
}

/**
 * Los 7 días (lunes a domingo) de la semana de una fecha.
 * @returns lista de fechas "YYYY-MM-DD"
 */
export function diasDeSemana(fechaISO: string): string[] {
  const lunes = inicioDeSemana(fechaISO);
  // Array.from({ length: 7 }, ...) = crear una lista de 7 elementos (como Enumerable.Range)
  // el "_" es un parámetro que no se usa; i = 0, 1, ... 6
  return Array.from({ length: 7 }, (_, i) => sumarDias(lunes, i));
}

/**
 * Grilla del mes para mostrar como calendario: semanas completas de lunes a
 * domingo, incluyendo los días del mes anterior/siguiente que hacen falta
 * para completar la primera y la última semana.
 * @param fechaISO cualquier día del mes a mostrar
 * @returns lista de semanas; cada semana es una lista de 7 días
 */
export function grillaDelMes(fechaISO: string): DiaDeGrilla[][] {
  const mes = fechaISO.slice(0, 7); // "YYYY-MM"
  const primero = `${mes}-01`;
  const semanas: DiaDeGrilla[][] = [];

  // arranco en el lunes de la semana del día 1 y avanzo de a semanas
  // mientras la semana todavía tenga algún día de este mes
  for (let lunes = inicioDeSemana(primero); lunes.slice(0, 7) <= mes; lunes = sumarDias(lunes, 7)) {
    semanas.push(diasDeSemana(lunes).map((fecha) => ({ fecha, delMes: fecha.slice(0, 7) === mes })));
  }
  return semanas;
}

/**
 * Mueve el período que se está mirando hacia adelante o atrás.
 * - semana: ±7 días
 * - mes: al día 1 del mes anterior/siguiente
 * @param fechaISO fecha de referencia actual
 * @param vista "semana" o "mes"
 * @param pasos 1 = siguiente, -1 = anterior
 * @returns la nueva fecha de referencia
 */
export function moverPeriodo(fechaISO: string, vista: VistaCalendario, pasos: number): string {
  if (vista === "semana") return sumarDias(fechaISO, 7 * pasos);

  const fecha = fechaAUTC(fechaISO);
  // Date.UTC con mes fuera de rango (ej. 12 o -1) pasa solo al año siguiente/anterior
  const nueva = new Date(Date.UTC(fecha.getUTCFullYear(), fecha.getUTCMonth() + pasos, 1));
  return nueva.toISOString().slice(0, 10);
}

/**
 * Arma la agenda de varios días de una sola vez.
 * @param fechas los días a mostrar
 * @returns diccionario fecha → sesiones de ese día ordenadas por hora
 *   (Record<string, X> es como un Dictionary<string, X> de C#)
 */
export function agendaDeVariosDias(
  fechas: string[],
  bloques: BloqueHorario[],
  empresas: Empresa[]
): Record<string, SesionDelDia[]> {
  // filtro una sola vez los bloques del rango, para no recorrer todo por cada día
  const enRango = new Set(fechas);
  const delRango = bloques.filter((b) => enRango.has(b.fecha));

  const agenda: Record<string, SesionDelDia[]> = {}; // {} = diccionario vacío
  // agenda[fecha] = ... agrega (o pisa) la entrada de esa fecha
  for (const fecha of fechas) agenda[fecha] = armarAgendaDelDia(fecha, delRango, empresas);
  return agenda;
}

/**
 * Total de horas de una lista de sesiones (ej. lo agendado en un día).
 * @returns horas, con decimales (1.5 = 1 h 30 min)
 */
export function horasTotales(sesiones: SesionDelDia[]): number {
  const minutos = sesiones.reduce(
    (total, s) => total + horaAMinutos(s.bloque.horaFin) - horaAMinutos(s.bloque.horaInicio),
    0
  );
  return minutos / 60;
}
