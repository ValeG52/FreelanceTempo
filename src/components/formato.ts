// components/formato.ts
// Cómo se muestran fechas y duraciones en pantalla (en español).
// Es solo presentación: no tiene reglas de negocio.

const DIAS = ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"];
const DIAS_CORTOS = ["dom", "lun", "mar", "mié", "jue", "vie", "sáb"];
const MESES = [
  "enero", "febrero", "marzo", "abril", "mayo", "junio",
  "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre",
];

/** "2026-10-06" → partes numéricas (año, mes 0-11, día) y día de la semana (0 = domingo). */
function partes(fechaISO: string): { anio: number; mes: number; dia: number; diaSemana: number } {
  const [anio, mes, dia] = fechaISO.split("-").map(Number);
  // Date.UTC para que la zona horaria del celular no corra el día
  const diaSemana = new Date(Date.UTC(anio, mes - 1, dia)).getUTCDay();
  return { anio, mes: mes - 1, dia, diaSemana };
}

/** "2026-10-06" → "martes 6 de octubre" */
export function fechaLarga(fechaISO: string): string {
  const { mes, dia, diaSemana } = partes(fechaISO);
  return `${DIAS[diaSemana]} ${dia} de ${MESES[mes]}`;
}

/** "2026-10-06" → "mar" */
export function diaCorto(fechaISO: string): string {
  return DIAS_CORTOS[partes(fechaISO).diaSemana];
}

/** "2026-10-06" → 6 */
export function numeroDeDia(fechaISO: string): number {
  return partes(fechaISO).dia;
}

/** "2026-10-06" → "Octubre 2026" */
export function mesYAnio(fechaISO: string): string {
  const { anio, mes } = partes(fechaISO);
  return `${MESES[mes][0].toUpperCase()}${MESES[mes].slice(1)} ${anio}`;
}

/** Rango de una semana: ("2026-10-05", "2026-10-11") → "5 – 11 oct" (o "28 sep – 4 oct" si cambia el mes) */
export function rangoDeSemana(desde: string, hasta: string): string {
  const a = partes(desde);
  const b = partes(hasta);
  const mesCorto = (m: number) => MESES[m].slice(0, 3);
  if (a.mes === b.mes) return `${a.dia} – ${b.dia} ${mesCorto(b.mes)}`;
  return `${a.dia} ${mesCorto(a.mes)} – ${b.dia} ${mesCorto(b.mes)}`;
}

/**
 * Duración legible a partir de horas con decimales.
 * Ejemplos: 2 → "2 h" · 2.5 → "2 h 30 min" · 0.75 → "45 min"
 */
export function textoHoras(horas: number): string {
  const minutos = Math.round(horas * 60);
  const h = Math.floor(minutos / 60);
  const resto = minutos % 60;
  if (resto === 0) return `${h} h`;
  if (h === 0) return `${resto} min`;
  return `${h} h ${resto} min`;
}

/**
 * Duración de un bloque a partir de sus horas de inicio y fin.
 * Ejemplo: "09:00", "11:30" → "2 h 30 min"
 */
export function textoDuracion(horaInicio: string, horaFin: string): string {
  const [hi, mi] = horaInicio.split(":").map(Number);
  const [hf, mf] = horaFin.split(":").map(Number);
  return textoHoras((hf * 60 + mf - (hi * 60 + mi)) / 60);
}
