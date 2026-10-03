// sistema/cronograma.ts
// Toda la logica de armado del cronograma. Esto no tiene que saber nada
// de React ni de AsyncStorage, solo recibe datos y devuelve datos.

import { Paquete, Empresa, BloqueHorario, JornadaLaboral, RangoHorario, DiaSemana, Prioridad } from "../type/index";

// ---------------------------------------------------------
// Helpers de tiempo. Todo lo manejo en minutos desde medianoche
// para no tener que andar comparando strings de horas a mano.
// ---------------------------------------------------------

function horaAMinutos(hora: string): number {
  const [h, m] = hora.split(":").map(Number);
  return h * 60 + m;
}

function minutosAHora(min: number): string {
  const h = Math.floor(min / 60).toString().padStart(2, "0");
  const m = (min % 60).toString().padStart(2, "0");
  return `${h}:${m}`;
}

function duracionEnMinutos(bloque: BloqueHorario): number {
  return horaAMinutos(bloque.horaFin) - horaAMinutos(bloque.horaInicio);
}

// true si el bloque pisa aunque sea un minuto del rango [inicio, fin)
function seSuperpone(bloque: BloqueHorario, inicio: number, fin: number): boolean {
  return horaAMinutos(bloque.horaInicio) < fin && horaAMinutos(bloque.horaFin) > inicio;
}

// Fechas: las "YYYY-MM-DD" las trato siempre como UTC para que la zona
// horaria del celular no me corra el día (en Argentina, UTC-3,
// new Date("2026-10-05") cae el día 4 a las 21hs si se lee en hora local).
function fechaAUTC(fechaISO: string): Date {
  return new Date(`${fechaISO.slice(0, 10)}T00:00:00Z`);
}

// suma dias a una fecha en formato "YYYY-MM-DD" y devuelve el mismo formato
function sumarDias(fechaISO: string, dias: number): string {
  const fecha = fechaAUTC(fechaISO);
  fecha.setUTCDate(fecha.getUTCDate() + dias);
  return fecha.toISOString().slice(0, 10);
}

// "Hoy" según el reloj del celular (hora local), en formato "YYYY-MM-DD".
// No uso toISOString() porque eso devuelve la fecha en UTC: a las 22hs
// en Argentina ya sería "mañana".
export function fechaLocalISO(fecha: Date): string {
  const anio = fecha.getFullYear();
  const mes = (fecha.getMonth() + 1).toString().padStart(2, "0");
  const dia = fecha.getDate().toString().padStart(2, "0");
  return `${anio}-${mes}-${dia}`;
}

const DIAS_SEMANA: DiaSemana[] = [
  "domingo", "lunes", "martes", "miercoles", "jueves", "viernes", "sabado",
];

function obtenerDiaSemana(fechaISO: string): DiaSemana {
  return DIAS_SEMANA[fechaAUTC(fechaISO).getUTCDay()];
}

// ---------------------------------------------------------
// Cuanto dura cada sesion segun el total de horas del paquete.
// Esta tabla la puedo ir ajustando despues de probarla un rato.
// ---------------------------------------------------------

function calcularTamanoBloque(horasTotales: number): number {
  if (horasTotales <= 10) return 1;
  if (horasTotales <= 20) return 2;
  if (horasTotales <= 40) return 3;
  return 4;
}

function diasDeVentana(periodo: "semana" | "mes"): number {
  return periodo === "mes" ? 30 : 7;
}

// Último día (inclusive) de la ventana de la empresa: si la ventana es de
// 30 días y arranca el día 1, el último día es el 30 (alta + 29).
export function finDeVentana(empresa: Empresa, paquete: Paquete): string {
  return sumarDias(empresa.fechaAlta, diasDeVentana(paquete.periodo) - 1);
}

// Horas que la empresa ya "gastó": todos sus bloques de hoy para atrás.
export function calcularHorasConsumidas(
  empresaId: string,
  bloques: BloqueHorario[],
  fechaHoy: string
): number {
  const minutos = bloques
    .filter((b) => b.empresaId === empresaId && b.fecha <= fechaHoy)
    .reduce((total, b) => total + duracionEnMinutos(b), 0);
  return minutos / 60;
}

// Jornada que se usa mientras el usuario no configure la suya.
// Cuando exista la pantalla de jornada, esto queda solo como valor inicial.
export const JORNADA_POR_DEFECTO: JornadaLaboral = {
  tipo: "fija",
  horarioFijo: { horaInicio: "09:00", horaFin: "18:00" },
};

// ---------------------------------------------------------
// La jornada laboral puede ser fija o variable segun el dia.
// Esta funcion me devuelve el rango de ese dia puntual, o null
// si ese dia no se trabaja (por ej domingo en jornada variable).
// ---------------------------------------------------------

function obtenerJornadaDelDia(jornada: JornadaLaboral, fechaISO: string): RangoHorario | null {
  if (jornada.tipo === "fija") {
    return jornada.horarioFijo ?? null;
  }
  const dia = obtenerDiaSemana(fechaISO);
  return jornada.horarioPorDia?.[dia] ?? null;
}

// ---------------------------------------------------------
// Busca un hueco libre de "duracionMin" dentro de la jornada de ese
// dia, evitando los bloques que ya estan ocupados. Devuelve el rango
// horario si encuentra lugar, o null si no entra en ningun lado.
// ---------------------------------------------------------

function bloquesDelDia(bloques: BloqueHorario[], fechaISO: string): BloqueHorario[] {
  return bloques
    .filter((b) => b.fecha === fechaISO)
    .sort((a, b) => horaAMinutos(a.horaInicio) - horaAMinutos(b.horaInicio));
}

function buscarHuecoLibre(
  fechaISO: string,
  jornada: RangoHorario,
  duracionMin: number,
  bloquesExistentes: BloqueHorario[]
): RangoHorario | null {
  const inicioJornada = horaAMinutos(jornada.horaInicio);
  const finJornada = horaAMinutos(jornada.horaFin);

  const ocupados = bloquesDelDia(bloquesExistentes, fechaISO);

  // recorro los espacios entre bloques ocupados, mas el espacio
  // desde el inicio de la jornada hasta el primer bloque
  let cursor = inicioJornada;

  for (const bloque of ocupados) {
    const inicioBloque = horaAMinutos(bloque.horaInicio);
    const finBloque = horaAMinutos(bloque.horaFin);

    if (inicioBloque - cursor >= duracionMin) {
      // hay hueco antes de este bloque
      return { horaInicio: minutosAHora(cursor), horaFin: minutosAHora(cursor + duracionMin) };
    }
    cursor = Math.max(cursor, finBloque);
  }

  // reviso si queda hueco despues del ultimo bloque, hasta el fin de jornada
  if (finJornada - cursor >= duracionMin) {
    return { horaInicio: minutosAHora(cursor), horaFin: minutosAHora(cursor + duracionMin) };
  }

  return null; // no entro en ningun lado ese dia
}

// genera un id único para un bloque nuevo
function nuevoIdBloque(empresaId: string, fecha: string, extra: number): string {
  return `${empresaId}-${fecha}-${Date.now()}-${extra}`;
}

// ---------------------------------------------------------
// Generacion normal (prioridad media). La uso tanto al crear
// una empresa nueva como al recalcular el saldo restante
// despues de que se apaga una urgencia.
// ---------------------------------------------------------

export interface ResultadoCronograma {
  exito: boolean;
  bloques: BloqueHorario[]; // solo los bloques NUEVOS de esta empresa
}

export function generarCronograma(
  empresa: Empresa,
  paquete: Paquete,
  horasARepartir: number, // normalmente paquete.horas, pero al recalcular puede ser menos
  fechaInicio: string,    // desde cuando empiezo a buscar hueco
  fechaLimite: string,    // hasta cuando puedo buscar (fin de su ventana, inclusive)
  jornada: JornadaLaboral,
  bloquesExistentes: BloqueHorario[]
): ResultadoCronograma {
  const tamanoBloqueMin = calcularTamanoBloque(paquete.horas) * 60; // siempre sobre el total original del paquete
  let minutosQueFaltan = Math.round(horasARepartir * 60);
  if (minutosQueFaltan <= 0) return { exito: true, bloques: [] };

  const sesionesNecesarias = Math.ceil(minutosQueFaltan / tamanoBloqueMin);

  // armo la lista de días de la ventana en los que se trabaja
  const diasHabiles: { fecha: string; jornada: RangoHorario }[] = [];
  for (let dia = fechaInicio; dia <= fechaLimite; dia = sumarDias(dia, 1)) {
    const jornadaDelDia = obtenerJornadaDelDia(jornada, dia);
    if (jornadaDelDia) diasHabiles.push({ fecha: dia, jornada: jornadaDelDia });
  }
  if (diasHabiles.length === 0) return { exito: false, bloques: [] };

  // Para que las sesiones queden lo más espaciadas posible, a la sesión N
  // le corresponde el día N * paso. Ej: 10 sesiones en 30 días → una cada 3 días.
  const paso = diasHabiles.length / sesionesNecesarias;
  const bloquesGenerados: BloqueHorario[] = [];

  for (let sesion = 0; sesion < sesionesNecesarias; sesion++) {
    // la última sesión puede ser más corta (ej: 15hs en bloques de 2 → la última es de 1h)
    const duracionMin = Math.min(tamanoBloqueMin, minutosQueFaltan);
    const diaObjetivo = Math.floor(sesion * paso);
    let ubicada = false;

    // si el día objetivo está lleno, pruebo los siguientes; al llegar al
    // final de la ventana vuelvo a empezar desde el principio (por eso el %)
    for (let intento = 0; intento < diasHabiles.length && !ubicada; intento++) {
      const { fecha, jornada: jornadaDelDia } = diasHabiles[(diaObjetivo + intento) % diasHabiles.length];
      const hueco = buscarHuecoLibre(fecha, jornadaDelDia, duracionMin, [
        ...bloquesExistentes,
        ...bloquesGenerados, // para no pisarme a mi mismo
      ]);

      if (hueco) {
        bloquesGenerados.push({
          id: nuevoIdBloque(empresa.id, fecha, sesion),
          empresaId: empresa.id,
          fecha,
          horaInicio: hueco.horaInicio,
          horaFin: hueco.horaFin,
        });
        minutosQueFaltan -= duracionMin;
        ubicada = true;
      }
    }

    // no entró en ningún día de la ventana → no hay cupos, y NO devuelvo nada parcial
    if (!ubicada) return { exito: false, bloques: [] };
  }

  return { exito: true, bloques: bloquesGenerados };
}

// Al crear una empresa: le genero todo el paquete dentro de su ventana.
// Devuelve la lista COMPLETA de bloques (los de antes + los nuevos).
export function crearEmpresaConCronograma(
  empresa: Empresa,
  paquete: Paquete,
  jornada: JornadaLaboral,
  bloquesExistentes: BloqueHorario[]
): { exito: boolean; bloques: BloqueHorario[] } {
  const resultado = generarCronograma(
    empresa,
    paquete,
    paquete.horas,
    empresa.fechaAlta,
    finDeVentana(empresa, paquete),
    jornada,
    bloquesExistentes
  );
  if (!resultado.exito) return { exito: false, bloques: bloquesExistentes };
  return { exito: true, bloques: [...bloquesExistentes, ...resultado.bloques] };
}

// Recalcula lo que le queda a una empresa: borra sus bloques de mañana en
// adelante y reparte las horas restantes con bloque NORMAL hasta el fin de su
// ventana original. Si no entra, deja todo como estaba (exito: false).
export function recalcularEmpresa(
  empresa: Empresa,
  paquete: Paquete,
  fechaHoy: string,
  jornada: JornadaLaboral,
  bloques: BloqueHorario[]
): { exito: boolean; bloques: BloqueHorario[]; horasConsumidas: number } {
  const horasConsumidas = calcularHorasConsumidas(empresa.id, bloques, fechaHoy);
  const horasRestantes = Math.max(0, paquete.horas - horasConsumidas);
  const sinSusFuturos = bloques.filter((b) => !(b.empresaId === empresa.id && b.fecha > fechaHoy));

  const resultado = generarCronograma(
    empresa,
    paquete,
    horasRestantes,
    sumarDias(fechaHoy, 1),
    finDeVentana(empresa, paquete),
    jornada,
    sinSusFuturos
  );

  if (!resultado.exito) return { exito: false, bloques, horasConsumidas };
  return { exito: true, bloques: [...sinSusFuturos, ...resultado.bloques], horasConsumidas };
}

// ---------------------------------------------------------
// Prioridad alta. Cada dia le busco un bloque x4 a la empresa
// urgente, y si hace falta corro a las demas empresas de ese dia
// a otro dia dentro de SU ventana.
// ---------------------------------------------------------

export interface ResultadoDiaUrgente {
  bloques: BloqueHorario[];          // lista COMPLETA actualizada (lista para guardar)
  empresasAfectadas: string[];       // las que corrí de lugar, para recalcularlas al apagar
  bloquesPerdidos: BloqueHorario[];  // los que no pude reubicar dentro de su ventana
}

// tope de días hacia adelante para repartir el excedente del bloque x4
const MAX_DIAS_EXCEDENTE = 30;

// Elige dónde poner el bloque urgente en un día.
// - "intocables": empresas cuyos bloques NO se pueden mover (la urgente misma
//   y las que activaron prioridad alta antes que ella — orden FIFO).
// - Busco el hueco más grande entre bloques intocables; si no entra todo,
//   uso lo que entre y el resto pasa al día siguiente.
// - Dentro de ese hueco, elijo la posición que menos minutos de otras
//   empresas obligue a correr ("el mejor hueco disponible").
function elegirLugarUrgente(
  fechaISO: string,
  jornada: RangoHorario,
  minutosQueFaltan: number,
  bloques: BloqueHorario[],
  intocables: Set<string>
): { inicio: number; fin: number } | null {
  const inicioJornada = horaAMinutos(jornada.horaInicio);
  const finJornada = horaAMinutos(jornada.horaFin);
  const delDia = bloquesDelDia(bloques, fechaISO);
  const fijos = delDia.filter((b) => intocables.has(b.empresaId));
  const movibles = delDia.filter((b) => !intocables.has(b.empresaId));

  // huecos que dejan libres los bloques fijos
  const huecos: { inicio: number; fin: number }[] = [];
  let cursor = inicioJornada;
  for (const fijo of fijos) {
    const inicioFijo = horaAMinutos(fijo.horaInicio);
    if (inicioFijo > cursor) huecos.push({ inicio: cursor, fin: Math.min(inicioFijo, finJornada) });
    cursor = Math.max(cursor, horaAMinutos(fijo.horaFin));
  }
  if (finJornada > cursor) huecos.push({ inicio: cursor, fin: finJornada });

  const validos = huecos.filter((h) => h.fin > h.inicio);
  if (validos.length === 0) return null; // ese día está todo tomado por intocables

  const mayor = validos.reduce((a, b) => (b.fin - b.inicio > a.fin - a.inicio ? b : a));
  const duracion = Math.min(minutosQueFaltan, mayor.fin - mayor.inicio);

  // posiciones candidatas: pegado al inicio o al final del hueco, o pegado
  // antes/después de cada bloque movible (ahí es donde se minimizan los choques)
  const candidatos = [
    mayor.inicio,
    mayor.fin - duracion,
    ...movibles.map((b) => horaAMinutos(b.horaFin)),
    ...movibles.map((b) => horaAMinutos(b.horaInicio) - duracion),
  ].filter((inicio) => inicio >= mayor.inicio && inicio + duracion <= mayor.fin);

  let mejorInicio = mayor.inicio;
  let menosMinutosMovidos = Infinity;
  for (const inicio of candidatos) {
    const minutosMovidos = movibles
      .filter((b) => seSuperpone(b, inicio, inicio + duracion))
      .reduce((total, b) => total + duracionEnMinutos(b), 0);
    if (minutosMovidos < menosMinutosMovidos) {
      menosMinutosMovidos = minutosMovidos;
      mejorInicio = inicio;
    }
  }

  return { inicio: mejorInicio, fin: mejorInicio + duracion };
}

// busca el proximo dia (a partir de fechaDesde) donde entre este bloque movido,
// sin pasarse de fechaLimite (el fin de la ventana de la empresa afectada)
function reubicarBloque(
  bloque: BloqueHorario,
  fechaDesde: string,
  fechaLimite: string,
  jornada: JornadaLaboral,
  bloquesExistentes: BloqueHorario[]
): BloqueHorario | null {
  const duracionMin = duracionEnMinutos(bloque);

  for (let dia = fechaDesde; dia <= fechaLimite; dia = sumarDias(dia, 1)) {
    const jornadaDelDia = obtenerJornadaDelDia(jornada, dia);
    if (jornadaDelDia) {
      const hueco = buscarHuecoLibre(dia, jornadaDelDia, duracionMin, bloquesExistentes);
      if (hueco) {
        // mantengo el mismo id: es el mismo bloque, solo cambia de lugar
        return { ...bloque, fecha: dia, horaInicio: hueco.horaInicio, horaFin: hueco.horaFin };
      }
    }
  }
  return null; // no encontre lugar dentro de su ventana
}

// Genera el bloque x4 de UN día para una empresa en prioridad alta.
// Ojo: hay que llamarla UNA VEZ POR DIA (al activar el switch, y despues desde
// el chequeo diario), no se corre "para todo el futuro" porque no se sabe
// cuándo se va a apagar el switch.
export function generarDiaUrgente(
  empresa: Empresa,
  paquete: Paquete,
  fechaHoy: string,
  jornada: JornadaLaboral,
  todosLosBloques: BloqueHorario[],
  empresas: Empresa[],
  paquetes: Paquete[]
): ResultadoDiaUrgente {
  const minutosNecesarios = calcularTamanoBloque(paquete.horas) * 4 * 60;

  // FIFO: las que activaron alta ANTES que esta no se pueden correr
  const miActivacion = empresa.fechaActivacionPrioridad ?? "9999";
  const intocables = new Set<string>([empresa.id]);
  for (const otra of empresas) {
    const activoAntes =
      otra.prioridad === "alta" &&
      otra.fechaActivacionPrioridad !== undefined &&
      otra.fechaActivacionPrioridad < miActivacion;
    if (activoAntes) intocables.add(otra.id);
  }

  // fin de ventana de cada empresa, para saber hasta dónde puedo correr sus bloques
  const finVentanaPorEmpresa = new Map<string, string>();
  for (const e of empresas) {
    const p = paquetes.find((x) => x.id === e.paqueteId);
    if (p) finVentanaPorEmpresa.set(e.id, finDeVentana(e, p));
  }

  let bloques = [...todosLosBloques]; // copia de trabajo que voy actualizando
  const empresasAfectadas = new Set<string>();
  const bloquesPerdidos: BloqueHorario[] = [];
  let minutosQueFaltan = minutosNecesarios;
  let dia = fechaHoy;

  // itero por si el bloque de hoy no entra completo y hay que seguir mañana
  for (let vuelta = 0; minutosQueFaltan > 0 && vuelta < MAX_DIAS_EXCEDENTE; vuelta++) {
    const jornadaDelDia = obtenerJornadaDelDia(jornada, dia);
    const lugar = jornadaDelDia
      ? elegirLugarUrgente(dia, jornadaDelDia, minutosQueFaltan, bloques, intocables)
      : null;

    if (lugar) {
      // saco los bloques de otros que se superponen con el lugar elegido
      const movidos = bloquesDelDia(bloques, dia).filter(
        (b) => !intocables.has(b.empresaId) && seSuperpone(b, lugar.inicio, lugar.fin)
      );
      const idsMovidos = new Set(movidos.map((m) => m.id));
      bloques = bloques.filter((b) => !idsMovidos.has(b.id));

      bloques.push({
        id: nuevoIdBloque(empresa.id, dia, vuelta),
        empresaId: empresa.id,
        fecha: dia,
        horaInicio: minutosAHora(lugar.inicio),
        horaFin: minutosAHora(lugar.fin),
      });

      // a cada movido le busco lugar desde el día siguiente hasta el fin de SU ventana
      for (const movido of movidos) {
        empresasAfectadas.add(movido.empresaId);
        const limite = finVentanaPorEmpresa.get(movido.empresaId) ?? sumarDias(dia, 30);
        const nuevoLugar = reubicarBloque(movido, sumarDias(dia, 1), limite, jornada, bloques);
        if (nuevoLugar) {
          bloques.push(nuevoLugar);
        } else {
          bloquesPerdidos.push(movido); // caso raro: su ventana ya casi terminó
        }
      }

      minutosQueFaltan -= lugar.fin - lugar.inicio;
    }

    dia = sumarDias(dia, 1);
  }

  return {
    bloques,
    empresasAfectadas: Array.from(empresasAfectadas),
    bloquesPerdidos,
  };
}

// ---------------------------------------------------------
// Agenda de un día: lo que muestra la pantalla de inicio.
// No calcula nada nuevo, solo filtra el cronograma ya generado.
// ---------------------------------------------------------

export interface SesionDelDia {
  bloque: BloqueHorario;
  nombreEmpresa: string;
  prioridad: Prioridad;
}

// Devuelve los bloques de esa fecha ordenados por hora de inicio, cada uno
// con el nombre de su empresa. Si un bloque apunta a una empresa que ya no
// existe (no debería pasar), se saltea.
export function armarAgendaDelDia(
  fechaISO: string,
  bloques: BloqueHorario[],
  empresas: Empresa[]
): SesionDelDia[] {
  const sesiones: SesionDelDia[] = [];
  for (const bloque of bloques) {
    if (bloque.fecha !== fechaISO) continue;
    const empresa = empresas.find((e) => e.id === bloque.empresaId);
    if (!empresa) continue;
    sesiones.push({ bloque, nombreEmpresa: empresa.nombre, prioridad: empresa.prioridad });
  }
  // sort con comparador, como OrderBy en C#: negativo = a va antes que b
  return sesiones.sort(
    (a, b) => horaAMinutos(a.bloque.horaInicio) - horaAMinutos(b.bloque.horaInicio)
  );
}
