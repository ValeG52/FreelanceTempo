// sistema/renovacion.ts
// Renovación de paquetes: cuando termina la ventana de una empresa (30 días
// si es mensual, 7 si es semanal), arranca una ventana nueva con el paquete
// completo. Igual que el resto de sistema/: sin React ni storage.

import { BloqueHorario, Empresa, JornadaLaboral, Paquete } from "../type/index";
import {
  MomentoActual,
  diasDeVentana,
  finDeVentana,
  generarCronograma,
  horaAMinutos,
  inicioDeVentana,
  sumarDias,
} from "./cronograma";

export interface ResultadoRenovaciones {
  empresas: Empresa[];
  bloques: BloqueHorario[];
  renovadas: Empresa[];       // las que arrancaron ventana nueva
  sinCupo: Empresa[];         // las que no se pudieron renovar por falta de lugar (se reintenta mañana)
  huboCambios: boolean;       // false = no había nada para renovar
}

/**
 * Inicio de la ventana que le toca a una empresa cuya ventana ya terminó:
 * el día siguiente al fin de la anterior (así se respeta el ciclo). Si la
 * app no se abrió durante varios períodos, salta directo a la ventana que
 * contiene a hoy.
 * @returns el nuevo inicio, "YYYY-MM-DD"
 */
function proximoInicioDeVentana(empresa: Empresa, paquete: Paquete, fechaHoy: string): string {
  const dias = diasDeVentana(paquete.periodo);
  let inicio = sumarDias(finDeVentana(empresa, paquete), 1);
  // mientras esa ventana también haya terminado antes de hoy, paso a la siguiente
  while (sumarDias(inicio, dias - 1) < fechaHoy) inicio = sumarDias(inicio, dias); // while igual que en C#
  return inicio;
}

/**
 * Renueva todas las empresas cuya ventana terminó antes de hoy.
 *
 * - Prioridad media: ventana nueva y cronograma completo del paquete,
 *   desde hoy (o desde el inicio de la ventana, si es posterior) hasta el
 *   fin de la ventana nueva. Si no entra, NO se renueva (regla "no hay
 *   cupos": nada a medias), se avisa y se vuelve a intentar al día siguiente.
 * - Prioridad alta: solo arranca la ventana nueva (con las horas completas
 *   otra vez). Sigue recibiendo su x4 diario; las sesiones normales se
 *   reparten cuando se apague el switch, como siempre.
 * - Van por orden de alta: la empresa más vieja elige lugar primero.
 * @param ahora momento actual (para no agendar hoy en horarios que ya pasaron)
 * @returns las listas completas ya actualizadas, listas para guardar
 */
export function aplicarRenovaciones(
  empresas: Empresa[],
  paquetes: Paquete[],
  jornada: JornadaLaboral,
  bloques: BloqueHorario[],
  ahora: MomentoActual
): ResultadoRenovaciones {
  const fechaHoy = ahora.fecha;
  let listaEmpresas = empresas;
  let listaBloques = bloques;
  const renovadas: Empresa[] = [];
  const sinCupo: Empresa[] = [];

  // [...empresas] copia la lista antes de ordenar (sort modifica la lista original)
  const porAntiguedad = [...empresas].sort((a, b) => a.fechaAlta.localeCompare(b.fechaAlta));

  for (const empresa of porAntiguedad) {
    const paquete = paquetes.find((p) => p.id === empresa.paqueteId);
    if (!paquete) continue;
    if (finDeVentana(empresa, paquete) >= fechaHoy) continue; // su ventana sigue vigente

    const renovada: Empresa = {
      ...empresa,
      inicioVentana: proximoInicioDeVentana(empresa, paquete, fechaHoy),
      horasConsumidas: 0,
    };

    if (empresa.prioridad === "media") {
      // si ya tiene algo agendado en la ventana nueva (raro), lo descuento
      const inicio = inicioDeVentana(renovada);
      const minutosYaAgendados = listaBloques
        .filter((b) => b.empresaId === empresa.id && b.fecha >= inicio)
        .reduce((total, b) => total + horaAMinutos(b.horaFin) - horaAMinutos(b.horaInicio), 0);

      const resultado = generarCronograma(
        renovada,
        paquete,
        paquete.horas - minutosYaAgendados / 60,
        inicio > fechaHoy ? inicio : fechaHoy, // nunca para atrás
        finDeVentana(renovada, paquete),
        jornada,
        listaBloques,
        ahora
      );
      if (!resultado.exito) {
        sinCupo.push(empresa);
        continue; // queda como estaba: se reintenta en el próximo chequeo
      }
      listaBloques = [...listaBloques, ...resultado.bloques];
    }

    listaEmpresas = listaEmpresas.map((e) => (e.id === renovada.id ? renovada : e));
    renovadas.push(renovada);
  }

  return {
    empresas: listaEmpresas,
    bloques: listaBloques,
    renovadas,
    sinCupo,
    huboCambios: renovadas.length > 0,
  };
}
