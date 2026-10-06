// sistema/cronograma.ts
// Toda la logica de armado del cronograma. Esto no tiene que saber nada
// de React ni de AsyncStorage, solo recibe datos y devuelve datos.

import { Paquete, Empresa, BloqueHorario, JornadaLaboral, RangoHorario, DiaSemana, Prioridad } from "../type/index";

// ---------------------------------------------------------
// Helpers de tiempo. Todo lo manejo en minutos desde medianoche
// para no tener que andar comparando strings de horas a mano.
// ---------------------------------------------------------

// "09:30" → 570. Los ": number" y ": string" son los tipos de parámetros y retorno.
export function horaAMinutos(hora: string): number {
  // split(":") parte el texto en ["09", "30"]; map(Number) los pasa a números.
  // const [h, m] = ... guarda el primero en h y el segundo en m ("desestructurar").
  const [h, m] = hora.split(":").map(Number);
  return h * 60 + m;
}

// 570 → "09:30"
export function minutosAHora(min: number): string {
  // padStart(2, "0") completa con ceros a la izquierda: "9" → "09"
  const h = Math.floor(min / 60).toString().padStart(2, "0");
  const m = (min % 60).toString().padStart(2, "0"); // % = resto de la división
  // `texto ${variable}` = texto con variables adentro (como $"..." en C#)
  return `${h}:${m}`;
}

// sin "export": solo se puede usar dentro de este archivo (como private)
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
export function fechaAUTC(fechaISO: string): Date {
  // slice(0, 10) = los primeros 10 caracteres (como Substring); la "Z" final = UTC
  return new Date(`${fechaISO.slice(0, 10)}T00:00:00Z`);
}

// suma dias a una fecha en formato "YYYY-MM-DD" y devuelve el mismo formato
export function sumarDias(fechaISO: string, dias: number): string {
  const fecha = fechaAUTC(fechaISO);
  fecha.setUTCDate(fecha.getUTCDate() + dias);
  return fecha.toISOString().slice(0, 10);
}

// "Hoy" según el reloj del celular (hora local), en formato "YYYY-MM-DD".
// No uso toISOString() porque eso devuelve la fecha en UTC: a las 22hs
// en Argentina ya sería "mañana".
export function fechaLocalISO(fecha: Date): string {
  const anio = fecha.getFullYear();
  const mes = (fecha.getMonth() + 1).toString().padStart(2, "0"); // getMonth() va de 0 a 11
  const dia = fecha.getDate().toString().padStart(2, "0");
  return `${anio}-${mes}-${dia}`;
}

const DIAS_SEMANA: DiaSemana[] = [
  "domingo", "lunes", "martes", "miercoles", "jueves", "viernes", "sabado",
];

function obtenerDiaSemana(fechaISO: string): DiaSemana {
  return DIAS_SEMANA[fechaAUTC(fechaISO).getUTCDay()]; // getUTCDay(): 0 = domingo ... 6 = sábado
}

// ---------------------------------------------------------
// Momento actual: fecha de hoy + hora, para no agendar sesiones en
// horarios de hoy que ya pasaron.
// ---------------------------------------------------------

// Los comentarios /** ... */ son documentación: VS Code los muestra al pasar el mouse
// (como los /// <summary> de C#).
/** Fecha de hoy ("YYYY-MM-DD") y minutos desde la medianoche (15:30 → 930). */
export interface MomentoActual {
  fecha: string;
  minutos: number;
}

/**
 * Convierte un Date (por ej. new Date()) en MomentoActual, en hora local.
 * @param fecha el momento a convertir
 */
export function momentoDe(fecha: Date): MomentoActual {
  // { campo: valor, ... } crea un objeto en el momento (no hace falta "new")
  return { fecha: fechaLocalISO(fecha), minutos: fecha.getHours() * 60 + fecha.getMinutes() };
}

/** Las sesiones de hoy arrancan, como muy temprano, en el próximo cuarto de hora. */
const REDONDEO_INICIO_MIN = 15;

// ---------------------------------------------------------
// Tamaño de sesión: las horas del paquete repartidas en los días de
// su período (semana = 7, mes = 30). Ej: 30 h por mes → 1 h por día.
// ---------------------------------------------------------

/** Las sesiones duran múltiplos de 5 minutos, para que los horarios queden prolijos. */
const REDONDEO_SESION_MIN = 5;

/** true si la fecha cae sábado o domingo (esos días nunca hay sesiones). */
export function esFinDeSemana(fechaISO: string): boolean {
  const dia = obtenerDiaSemana(fechaISO);
  return dia === "sabado" || dia === "domingo";
}

/**
 * Días hábiles (lunes a viernes) de una ventana.
 * - Semanal: siempre 5.
 * - Mensual: los 30 días de la ventana menos sábados y domingos (20 a 22,
 *   según el día de la semana en que arranque).
 * @param inicio primer día de la ventana, "YYYY-MM-DD"
 */
export function diasHabilesDeVentana(periodo: "semana" | "mes", inicio: string): number {
  if (periodo === "semana") return 5;
  let habiles = 0;
  for (let i = 0; i < diasDeVentana(periodo); i++) {
    if (!esFinDeSemana(sumarDias(inicio, i))) habiles++;
  }
  return habiles;
}

/**
 * Duración de una sesión normal del paquete: horas ÷ días hábiles de la
 * ventana (5 si es semanal; 20 a 22 si es mensual), redondeado hacia arriba
 * a múltiplos de 5 minutos. Ejemplos: 10 h/semana → 2 h · 8 h/semana →
 * 1 h 40 min (96 min redondeado) · 30 h/mes con 22 días hábiles → 1 h 25 min.
 * @param inicioVentana primer día de la ventana (para contar sus días hábiles)
 * @returns minutos por sesión (como mínimo 5)
 */
export function tamanoBloqueMinutos(paquete: Paquete, inicioVentana: string): number {
  const minutosPorDia = (paquete.horas * 60) / diasHabilesDeVentana(paquete.periodo, inicioVentana);
  // Math.ceil = redondea hacia arriba; Math.max = el mayor de los dos
  return Math.max(REDONDEO_SESION_MIN, Math.ceil(minutosPorDia / REDONDEO_SESION_MIN) * REDONDEO_SESION_MIN);
}

/** Días de la ventana según el período del paquete: 30 si es mensual, 7 si es semanal. */
export function diasDeVentana(periodo: "semana" | "mes"): number {
  return periodo === "mes" ? 30 : 7;
}

/**
 * Primer día de la ventana ACTUAL de la empresa. Cambia cada vez que el
 * paquete se renueva; las empresas que nunca se renovaron usan su fechaAlta.
 */
export function inicioDeVentana(empresa: Empresa): string {
  // a ?? b = "a, y si a no tiene valor (null/undefined), b" (igual que en C#)
  return empresa.inicioVentana ?? empresa.fechaAlta;
}

// Último día (inclusive) de la ventana actual de la empresa: si la ventana es
// de 30 días y arranca el día 1, el último día es el 30 (inicio + 29).
export function finDeVentana(empresa: Empresa, paquete: Paquete): string {
  return sumarDias(inicioDeVentana(empresa), diasDeVentana(paquete.periodo) - 1);
}

/**
 * Horas que la empresa ya "gastó" en su ventana ACTUAL: sus bloques desde el
 * inicio de la ventana hasta hoy, incluido. Lo de ventanas anteriores (ya
 * renovadas) no cuenta.
 */
export function calcularHorasConsumidas(
  empresa: Empresa,
  bloques: BloqueHorario[],
  fechaHoy: string
): number {
  const desde = inicioDeVentana(empresa);
  const minutos = bloques
    // && = "y". Las fechas "YYYY-MM-DD" se pueden comparar como texto con >= y <=
    .filter((b) => b.empresaId === empresa.id && b.fecha >= desde && b.fecha <= fechaHoy)
    // reduce = acumula: arranca en 0 y le va sumando cada bloque (como Aggregate / Sum en LINQ)
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
  if (esFinDeSemana(fechaISO)) return null; // sábados y domingos no se trabaja nunca
  if (jornada.tipo === "fija") {
    return jornada.horarioFijo ?? null;
  }
  const dia = obtenerDiaSemana(fechaISO);
  // ?.[dia] = busca la clave "dia" en el diccionario, sin fallar si no existe
  return jornada.horarioPorDia?.[dia] ?? null;
}

/**
 * true si ese día se trabaja: no es sábado ni domingo y la jornada tiene
 * horario para ese día (en una jornada variable puede haber días libres).
 */
export function esDiaHabil(jornada: JornadaLaboral, fechaISO: string): boolean {
  return obtenerJornadaDelDia(jornada, fechaISO) !== null;
}

/**
 * Como obtenerJornadaDelDia, pero si el día es HOY recorta el principio de
 * la jornada a la hora actual (redondeada al próximo cuarto de hora), para
 * no agendar en horarios que ya pasaron. Si la jornada de hoy ya terminó,
 * devuelve null (hoy no queda lugar).
 * @param ahora momento actual; si no se pasa, no se recorta nada
 */
function jornadaDisponible(
  jornada: JornadaLaboral,
  fechaISO: string,
  ahora?: MomentoActual
): RangoHorario | null {
  const rango = obtenerJornadaDelDia(jornada, fechaISO);
  // !x = "x no tiene valor"; || = "o". Si no es hoy, devuelvo la jornada tal cual.
  if (!rango || !ahora || fechaISO !== ahora.fecha) return rango;

  const desde = Math.ceil(ahora.minutos / REDONDEO_INICIO_MIN) * REDONDEO_INICIO_MIN;
  const inicio = Math.max(horaAMinutos(rango.horaInicio), desde);
  if (inicio >= horaAMinutos(rango.horaFin)) return null;
  return { horaInicio: minutosAHora(inicio), horaFin: rango.horaFin };
}

// ---------------------------------------------------------
// Busca un hueco libre de "duracionMin" dentro de la jornada de ese
// dia, evitando los bloques que ya estan ocupados. Devuelve el rango
// horario si encuentra lugar, o null si no entra en ningun lado.
// ---------------------------------------------------------

function bloquesDelDia(bloques: BloqueHorario[], fechaISO: string): BloqueHorario[] {
  return bloques
    .filter((b) => b.fecha === fechaISO)
    // sort con comparador: negativo = a va antes que b (ordena por hora de inicio)
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
  let cursor = inicioJornada; // let = variable que SÍ se puede cambiar

  // for (const x of lista) = recorre la lista (como foreach)
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
  return `${empresaId}-${fecha}-${Date.now()}-${extra}`; // Date.now() = milisegundos actuales
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
  bloquesExistentes: BloqueHorario[],
  ahora?: MomentoActual   // si se pasa, hoy solo se agenda desde la hora actual
): ResultadoCronograma {
  const tamanoBloqueMin = tamanoBloqueMinutos(paquete, inicioDeVentana(empresa)); // según los días hábiles de su ventana
  let minutosQueFaltan = Math.round(horasARepartir * 60);
  if (minutosQueFaltan <= 0) return { exito: true, bloques: [] };

  const sesionesNecesarias = Math.ceil(minutosQueFaltan / tamanoBloqueMin);

  // armo la lista de días de la ventana en los que se trabaja
  // (el tipo es "lista de objetos con fecha y jornada")
  const diasHabiles: { fecha: string; jornada: RangoHorario }[] = [];
  // for clásico, pero avanzando de a un día con sumarDias
  for (let dia = fechaInicio; dia <= fechaLimite; dia = sumarDias(dia, 1)) {
    const jornadaDelDia = jornadaDisponible(jornada, dia, ahora);
    // push = agregar al final de la lista (como Add)
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
      // saco los campos del objeto: "fecha" con su nombre y "jornada" renombrado a jornadaDelDia
      const { fecha, jornada: jornadaDelDia } = diasHabiles[(diaObjetivo + intento) % diasHabiles.length];
      const hueco = buscarHuecoLibre(fecha, jornadaDelDia, duracionMin, [
        ...bloquesExistentes,
        ...bloquesGenerados, // para no pisarme a mi mismo
      ]);

      if (hueco) {
        bloquesGenerados.push({
          id: nuevoIdBloque(empresa.id, fecha, sesion),
          empresaId: empresa.id,
          fecha, // atajo de "fecha: fecha" (campo y variable con el mismo nombre)
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
  bloquesExistentes: BloqueHorario[],
  ahora?: MomentoActual   // para no agendar hoy en horarios que ya pasaron
): { exito: boolean; bloques: BloqueHorario[] } {
  const resultado = generarCronograma(
    empresa,
    paquete,
    paquete.horas,
    inicioDeVentana(empresa),
    finDeVentana(empresa, paquete),
    jornada,
    bloquesExistentes,
    ahora
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
  const horasConsumidas = calcularHorasConsumidas(empresa, bloques, fechaHoy);
  const horasRestantes = Math.max(0, paquete.horas - horasConsumidas);
  // todos los bloques MENOS los de esta empresa de mañana en adelante (el ! niega todo el paréntesis)
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

  // { bloques, horasConsumidas } = atajo de { bloques: bloques, horasConsumidas: horasConsumidas }
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
  intocables: Set<string> // Set = conjunto sin repetidos (como HashSet<string>)
): { inicio: number; fin: number } | null {
  const inicioJornada = horaAMinutos(jornada.horaInicio);
  const finJornada = horaAMinutos(jornada.horaFin);
  const delDia = bloquesDelDia(bloques, fechaISO);
  const fijos = delDia.filter((b) => intocables.has(b.empresaId)); // has = Contains
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

  // reduce sin valor inicial: se queda con el hueco más largo (como MaxBy)
  const mayor = validos.reduce((a, b) => (b.fin - b.inicio > a.fin - a.inicio ? b : a));
  const duracion = Math.min(minutosQueFaltan, mayor.fin - mayor.inicio);

  // posiciones candidatas: pegado al inicio o al final del hueco, o pegado
  // antes/después de cada bloque movible (ahí es donde se minimizan los choques)
  // los "..." meten todos los elementos de otra lista dentro de esta
  const candidatos = [
    mayor.inicio,
    mayor.fin - duracion,
    ...movibles.map((b) => horaAMinutos(b.horaFin)),
    ...movibles.map((b) => horaAMinutos(b.horaInicio) - duracion),
  ].filter((inicio) => inicio >= mayor.inicio && inicio + duracion <= mayor.fin);

  let mejorInicio = mayor.inicio;
  let menosMinutosMovidos = Infinity; // Infinity = número más grande que cualquier otro
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
        // ({ ...bloque, ... } = copia del bloque pisando fecha y horas)
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
  paquetes: Paquete[],
  ahora?: MomentoActual   // para que el x4 de hoy no caiga en horarios que ya pasaron
): ResultadoDiaUrgente {
  // Nunca pido más de lo que le queda del paquete: horas del paquete menos
  // TODO lo que ya tiene agendado (lo consumido + lo que quedó para días
  // siguientes por excedentes anteriores). Así el excedente se va sumando
  // día a día, pero se corta cuando se agotan las horas.
  const minutosAgendados = todosLosBloques
    .filter((b) => b.empresaId === empresa.id && b.fecha >= inicioDeVentana(empresa)) // solo la ventana actual
    .reduce((total, b) => total + duracionEnMinutos(b), 0);
  const minutosQueLeQuedan = paquete.horas * 60 - minutosAgendados;
  const minutosNecesarios = Math.min(tamanoBloqueMinutos(paquete, inicioDeVentana(empresa)) * 4, minutosQueLeQuedan);
  if (minutosNecesarios <= 0) {
    // ya tiene todas sus horas agendadas: no genero nada
    return { bloques: todosLosBloques, empresasAfectadas: [], bloquesPerdidos: [] };
  }

  // FIFO: las que activaron alta ANTES que esta no se pueden correr
  const miActivacion = empresa.fechaActivacionPrioridad ?? "9999";
  const intocables = new Set<string>([empresa.id]); // arranca con la urgente misma adentro
  for (const otra of empresas) {
    const activoAntes =
      otra.prioridad === "alta" &&
      otra.fechaActivacionPrioridad !== undefined &&
      otra.fechaActivacionPrioridad < miActivacion;
    if (activoAntes) intocables.add(otra.id);
  }

  // fin de ventana de cada empresa, para saber hasta dónde puedo correr sus bloques
  const finVentanaPorEmpresa = new Map<string, string>(); // Map = diccionario (Dictionary<string, string>)
  for (const e of empresas) {
    // find = el primero que cumple, o undefined (como FirstOrDefault)
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
    const jornadaDelDia = jornadaDisponible(jornada, dia, ahora); // hoy: desde la hora actual
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
    empresasAfectadas: Array.from(empresasAfectadas), // Array.from = Set → lista (ToList)
    bloquesPerdidos,
  };
}

// ---------------------------------------------------------
// Agenda de un día: lo que muestra la pantalla de inicio.
// No calcula nada nuevo, solo filtra el cronograma ya generado.
// ---------------------------------------------------------

/** Una sesión de la agenda del día: el bloque más los datos de su empresa que muestra la pantalla. */
export interface SesionDelDia {
  bloque: BloqueHorario;   // el bloque horario tal como está guardado
  nombreEmpresa: string;   // para mostrar en la tarjeta
  prioridad: Prioridad;    // para mostrar la etiqueta "ALTA"
}

/**
 * Arma la agenda de un día a partir del cronograma ya generado: filtra los
 * bloques de esa fecha, les suma el nombre y la prioridad de su empresa, y
 * los ordena por hora de inicio. No crea ni mueve bloques.
 * Si un bloque apunta a una empresa que ya no existe (no debería pasar), se saltea.
 * @param fechaISO día a mostrar, "YYYY-MM-DD"
 * @param bloques todos los bloques guardados
 * @param empresas todas las empresas guardadas
 * @returns las sesiones de ese día, de la más temprana a la más tarde
 */
export function armarAgendaDelDia(
  fechaISO: string,
  bloques: BloqueHorario[],
  empresas: Empresa[]
): SesionDelDia[] {
  const sesiones: SesionDelDia[] = [];
  for (const bloque of bloques) {
    if (bloque.fecha !== fechaISO) continue; // continue = saltar al siguiente
    const empresa = empresas.find((e) => e.id === bloque.empresaId);
    if (!empresa) continue;
    sesiones.push({ bloque, nombreEmpresa: empresa.nombre, prioridad: empresa.prioridad });
  }
  // sort con comparador, como OrderBy en C#: negativo = a va antes que b
  return sesiones.sort(
    (a, b) => horaAMinutos(a.bloque.horaInicio) - horaAMinutos(b.bloque.horaInicio)
  );
}

// ---------------------------------------------------------
// Cambio de jornada: el cronograma SIEMPRE tiene que quedar dentro de la
// jornada laboral. Al cambiarla, las sesiones que quedan afuera se mueven.
// ---------------------------------------------------------

/** true si el bloque cae entero dentro de la jornada de su día (y ese día se trabaja). */
function bloqueDentroDeJornada(bloque: BloqueHorario, jornada: JornadaLaboral): boolean {
  const rango = obtenerJornadaDelDia(jornada, bloque.fecha);
  if (!rango) return false; // ese día es libre
  return (
    horaAMinutos(bloque.horaInicio) >= horaAMinutos(rango.horaInicio) &&
    horaAMinutos(bloque.horaFin) <= horaAMinutos(rango.horaFin)
  );
}

/**
 * El espacio libre más largo de un día dentro de su jornada, o null si no
 * queda nada libre. Se usa para partir los bloques x4 cuando no entran enteros.
 */
function huecoMasGrande(
  fechaISO: string,
  jornada: RangoHorario,
  bloquesExistentes: BloqueHorario[]
): { inicio: number; fin: number } | null {
  const finJornada = horaAMinutos(jornada.horaFin);
  let cursor = horaAMinutos(jornada.horaInicio);
  let mejor: { inicio: number; fin: number } | null = null; // null hasta encontrar el primero

  for (const bloque of bloquesDelDia(bloquesExistentes, fechaISO)) {
    const inicioBloque = Math.min(horaAMinutos(bloque.horaInicio), finJornada);
    if (inicioBloque > cursor && (!mejor || inicioBloque - cursor > mejor.fin - mejor.inicio)) {
      mejor = { inicio: cursor, fin: inicioBloque };
    }
    cursor = Math.max(cursor, horaAMinutos(bloque.horaFin));
  }
  if (finJornada > cursor && (!mejor || finJornada - cursor > mejor.fin - mejor.inicio)) {
    mejor = { inicio: cursor, fin: finJornada };
  }
  return mejor;
}

export interface ResultadoAjusteJornada {
  exito: boolean;               // false = alguna sesión no entra: NO hay que guardar nada
  bloques: BloqueHorario[];     // lista COMPLETA actualizada (solo sirve si exito)
  bloquesMovidos: number;       // cuántas sesiones se cambiaron de lugar
  empresasSinLugar: Empresa[];  // las que tienen sesiones que no entran en ningún lado
}

/**
 * Acomoda el cronograma a una jornada laboral nueva: toda sesión de mañana
 * en adelante que quede fuera de la jornada (día libre u horario fuera de
 * rango) se mueve a otro lugar dentro de la jornada nueva.
 *
 * - Sesiones normales: se mueven enteras, dentro de la ventana de su
 *   empresa. Primero se busca desde su día original hacia adelante (para
 *   no amontonarlas al principio) y si no, desde mañana.
 * - Sesiones x4 de empresas en prioridad alta: no tienen ventana, así que
 *   se buscan hasta 30 días hacia adelante y, si no entran enteras, se
 *   parten (igual que el excedente del x4). Van primero, en orden FIFO.
 * - Si alguna sesión no entra en ningún lado, devuelve exito: false y la
 *   lista de empresas afectadas (regla "no hay cupos": nada a medias).
 * - Lo de hoy y días anteriores no se toca.
 * @param fechaHoy día de hoy, "YYYY-MM-DD"
 */
export function ajustarCronogramaAJornada(
  jornada: JornadaLaboral,
  empresas: Empresa[],
  paquetes: Paquete[],
  bloques: BloqueHorario[],
  fechaHoy: string
): ResultadoAjusteJornada {
  const manana = sumarDias(fechaHoy, 1);
  const fuera = bloques.filter((b) => b.fecha >= manana && !bloqueDentroDeJornada(b, jornada));
  if (fuera.length === 0) {
    return { exito: true, bloques, bloquesMovidos: 0, empresasSinLugar: [] };
  }

  // función guardada en una constante (una lambda con nombre), solo para usar acá adentro
  const empresaDe = (bloque: BloqueHorario): Empresa | undefined =>
    empresas.find((e) => e.id === bloque.empresaId);
  // clave para ordenar: las de prioridad alta primero (por orden de activación), después el resto
  const claveOrden = (bloque: BloqueHorario): string => {
    const empresa = empresaDe(bloque);
    const prioridad = empresa?.prioridad === "alta" ? `0-${empresa.fechaActivacionPrioridad ?? ""}` : "1";
    return `${prioridad}|${bloque.fecha}|${bloque.horaInicio}`;
  };
  // [...fuera] copia la lista (sort cambia la original); localeCompare compara textos
  const aMover = [...fuera].sort((a, b) => claveOrden(a).localeCompare(claveOrden(b)));

  // arranco sin los bloques que hay que mover y los voy agregando ya ubicados
  const idsFuera = new Set(fuera.map((b) => b.id));
  const resultado = bloques.filter((b) => !idsFuera.has(b.id));
  const sinLugar = new Set<string>();

  for (const bloque of aMover) {
    const empresa = empresaDe(bloque);
    const paquete = empresa ? paquetes.find((p) => p.id === empresa.paqueteId) : undefined;
    if (!empresa || !paquete) continue; // bloque huérfano: se descarta

    if (empresa.prioridad === "alta") {
      // x4: lleno los huecos más grandes día por día hasta cubrir su duración
      let minutosQueFaltan = duracionEnMinutos(bloque);
      let pedazo = 0;
      for (let dia = bloque.fecha; minutosQueFaltan > 0 && dia <= sumarDias(bloque.fecha, MAX_DIAS_EXCEDENTE); dia = sumarDias(dia, 1)) {
        const rango = obtenerJornadaDelDia(jornada, dia);
        const hueco = rango ? huecoMasGrande(dia, rango, resultado) : null;
        if (!hueco) continue;
        const duracion = Math.min(minutosQueFaltan, hueco.fin - hueco.inicio);
        resultado.push({
          id: pedazo === 0 ? bloque.id : nuevoIdBloque(empresa.id, dia, pedazo),
          empresaId: empresa.id,
          fecha: dia,
          horaInicio: minutosAHora(hueco.inicio),
          horaFin: minutosAHora(hueco.inicio + duracion),
        });
        minutosQueFaltan -= duracion;
        pedazo++; // ++ = sumar 1
      }
      if (minutosQueFaltan > 0) sinLugar.add(empresa.id);
      continue;
    }

    // sesión normal: entera, dentro de la ventana de su empresa
    const limite = finDeVentana(empresa, paquete);
    // pruebo desde su día original; si da null (??), pruebo desde mañana
    const movido =
      reubicarBloque(bloque, bloque.fecha, limite, jornada, resultado) ??
      reubicarBloque(bloque, manana, limite, jornada, resultado);
    if (movido) {
      resultado.push(movido);
    } else {
      sinLugar.add(empresa.id);
    }
  }

  if (sinLugar.size > 0) {
    return {
      exito: false,
      bloques,
      bloquesMovidos: 0,
      empresasSinLugar: empresas.filter((e) => sinLugar.has(e.id)),
    };
  }
  return { exito: true, bloques: resultado, bloquesMovidos: fuera.length, empresasSinLugar: [] };
}
