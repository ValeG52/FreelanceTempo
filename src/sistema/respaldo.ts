// sistema/respaldo.ts
// Respaldo de datos: arma el contenido del archivo de respaldo y valida un
// archivo antes de restaurarlo. Igual que el resto de sistema/: sin React ni
// storage (leer/escribir el archivo lo hace la pantalla).

import { DatosApp, JornadaLaboral } from "../type/index";
import { fechaLocalISO } from "./cronograma";

/** Marca que identifica un respaldo de esta app (para no importar cualquier JSON). */
const MARCA_APP = "tempomanager";

/** Versión del formato del archivo. Si algún día cambia, se sabe cómo leer los viejos. */
export const VERSION_RESPALDO = 1;

/** Lo que se guarda en el archivo: todos los datos más una cabecera. */
export interface Respaldo extends DatosApp {
  // "extends" = tiene todos los campos de DatosApp, más estos
  app: string;
  version: number;
  creado: string; // fecha y hora en que se hizo, formato ISO
}

/**
 * Arma el respaldo a partir de los datos actuales.
 * @param ahora momento en que se hace (queda anotado en el archivo)
 */
export function armarRespaldo(datos: DatosApp, ahora: Date): Respaldo {
  return { app: MARCA_APP, version: VERSION_RESPALDO, creado: ahora.toISOString(), ...datos };
}

/** Nombre del archivo: "tempomanager-respaldo-2026-10-08.json". */
export function nombreArchivoRespaldo(ahora: Date): string {
  return `${MARCA_APP}-respaldo-${fechaLocalISO(ahora)}.json`;
}

/** Resultado de leer un archivo: o el respaldo, o el motivo por el que no sirve. */
// "A | B" = puede ser una cosa o la otra; "ok" dice cuál es (como un Result<T> de C#)
export type ResultadoLectura = { ok: true; respaldo: Respaldo } | { ok: false; error: string };

// --- helpers de validación ("unknown" = todavía no sé qué tipo tiene) ---
const esTexto = (x: unknown): x is string => typeof x === "string" && x !== "";
const esNumero = (x: unknown): x is number => typeof x === "number" && Number.isFinite(x);
const esObjeto = (x: unknown): x is Record<string, unknown> => typeof x === "object" && x !== null;

function jornadaValida(j: unknown): j is JornadaLaboral | null {
  if (j === null) return true;
  return esObjeto(j) && (j.tipo === "fija" || j.tipo === "variable");
}

/**
 * Lee el texto de un archivo de respaldo y revisa que sea válido antes de
 * restaurarlo: que sea de esta app, que tenga todas las listas, que cada
 * dato tenga sus campos y que no haya sesiones de empresas inexistentes ni
 * empresas con paquetes inexistentes. Si algo falla, no se restaura nada.
 * @param texto el contenido del archivo
 */
export function leerRespaldo(texto: string): ResultadoLectura {
  let datos: unknown;
  try {
    datos = JSON.parse(texto);
  } catch {
    return { ok: false, error: "El archivo no es un respaldo válido (no se pudo leer)." };
  }

  if (!esObjeto(datos) || datos.app !== MARCA_APP) {
    return { ok: false, error: "Este archivo no es un respaldo de Tempomanager." };
  }
  if (!esNumero(datos.version) || datos.version > VERSION_RESPALDO) {
    return { ok: false, error: "Este respaldo es de una versión más nueva de la app. Actualizá la app primero." };
  }

  const { paquetes, empresas, bloques, jornada } = datos;
  // Array.isArray = "es una lista"
  if (!Array.isArray(paquetes) || !Array.isArray(empresas) || !Array.isArray(bloques) || !jornadaValida(jornada)) {
    return { ok: false, error: "El respaldo está incompleto o dañado." };
  }

  // every = "todos cumplen" (como All en LINQ)
  const paquetesOk = paquetes.every(
    (p) => esObjeto(p) && esTexto(p.id) && esTexto(p.nombre) && esNumero(p.horas) && (p.periodo === "semana" || p.periodo === "mes")
  );
  const empresasOk = empresas.every(
    (e) => esObjeto(e) && esTexto(e.id) && esTexto(e.nombre) && esTexto(e.paqueteId) && esTexto(e.fechaAlta)
  );
  const bloquesOk = bloques.every(
    (b) => esObjeto(b) && esTexto(b.id) && esTexto(b.empresaId) && esTexto(b.fecha) && esTexto(b.horaInicio) && esTexto(b.horaFin)
  );
  if (!paquetesOk || !empresasOk || !bloquesOk) {
    return { ok: false, error: "El respaldo está dañado: hay datos con campos faltantes." };
  }

  // que todo apunte a cosas que existen
  const idsPaquetes = new Set(paquetes.map((p) => p.id));
  const idsEmpresas = new Set(empresas.map((e) => e.id));
  if (!empresas.every((e) => idsPaquetes.has(e.paqueteId)) || !bloques.every((b) => idsEmpresas.has(b.empresaId))) {
    return { ok: false, error: "El respaldo está dañado: hay datos que apuntan a empresas o paquetes que no existen." };
  }

  // ya revisé todo: le aviso a TypeScript que es un Respaldo con "as"
  return { ok: true, respaldo: datos as unknown as Respaldo };
}
