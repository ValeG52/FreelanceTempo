// sistema/notas.ts
// Notas de las sesiones: lo que el usuario escribe que hizo en ese horario.
// Igual que el resto de sistema/: sin React ni storage.

import { BloqueHorario } from "../type/index";

/** Largo máximo de una nota (en caracteres). */
export const LARGO_MAXIMO_NOTA = 500;

/**
 * Pone (o cambia) la nota de una sesión. Si el texto queda vacío, la nota
 * se borra. Saca los espacios de más al principio y al final.
 * @param bloques todos los bloques guardados
 * @param bloqueId la sesión a la que se le pone la nota
 * @param texto lo que escribió el usuario
 * @returns la lista completa de bloques actualizada, lista para guardar
 */
export function ponerNota(bloques: BloqueHorario[], bloqueId: string, texto: string): BloqueHorario[] {
  const limpia = texto.trim().slice(0, LARGO_MAXIMO_NOTA);

  return bloques.map((bloque) => {
    if (bloque.id !== bloqueId) return bloque; // los demás quedan igual

    if (limpia === "") {
      // nota vacía = borrarla: saco el campo "nota" del objeto
      const { nota: _borrada, ...sinNota } = bloque;
      return sinNota;
    }
    return { ...bloque, nota: limpia }; // copia del bloque con la nota nueva
  });
}
