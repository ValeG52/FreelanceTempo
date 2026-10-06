// sistema/eliminacion.ts
// Reglas para borrar empresas y paquetes. Sin React ni AsyncStorage:
// recibe las listas y devuelve las listas nuevas, listas para guardar.

import { Empresa, BloqueHorario } from "../type/index";

// Borrar una empresa libera TODO su espacio en el cronograma: se van
// todos sus bloques (pasados y futuros). A las demás no se las reordena.
// El tipo de retorno { empresas: ...; bloques: ... } es un objeto con dos listas
// (como devolver una tupla con nombre en C#).
export function eliminarEmpresa(
  empresaId: string,
  empresas: Empresa[],
  bloques: BloqueHorario[]
): { empresas: Empresa[]; bloques: BloqueHorario[] } {
  const empresasRestantes = empresas
    // filter = deja solo las que cumplen (como Where en LINQ)
    .filter((e) => e.id !== empresaId) // !== es "distinto" (=== es "igual")
    // si alguna en prioridad alta la tenía anotada como desplazada, la saco de esa
    // lista para que al apagar el switch no intente recalcular una empresa que ya no existe
    .map((e) =>
      // "?." = si empresasDesplazadas no existe, no falla: da undefined
      e.empresasDesplazadas?.includes(empresaId)
        // { ...e, campo: x } = copia de e cambiando solo ese campo (como "with" en C#)
        ? { ...e, empresasDesplazadas: e.empresasDesplazadas.filter((id) => id !== empresaId) }
        : e
    );

  return {
    empresas: empresasRestantes,
    bloques: bloques.filter((b) => b.empresaId !== empresaId),
  };
}

// Un paquete solo se puede borrar si ninguna empresa lo usa: sin el paquete
// no se sabe cuántas horas ni qué ventana tiene esa empresa.
// Devuelve las empresas que lo usan (lista vacía = se puede borrar).
export function empresasQueUsanPaquete(paqueteId: string, empresas: Empresa[]): Empresa[] {
  return empresas.filter((e) => e.paqueteId === paqueteId);
}
