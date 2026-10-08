// type/index.ts
// Tipos compartidos de toda la app. Son como las clases "modelo" de C#,
// pero solo describen la forma de los datos: no tienen métodos.

// "type X = 'a' | 'b'" = solo puede valer uno de esos textos (como un enum)
export type Prioridad = "media" | "alta";
export type DiaSemana = "lunes" | "martes" | "miercoles" | "jueves" | "viernes" | "sabado" | "domingo";

// "export" = se puede usar desde otros archivos (como public)
// "interface" = describe qué campos tiene un objeto
export interface Paquete {
  id: string;
  nombre: string;
  horas: number;              // number = int y double a la vez
  periodo: "semana" | "mes";
}

export interface Empresa {
  id: string;
  nombre: string;
  paqueteId: string;
  prioridad: Prioridad;
  fechaAlta: string;                 // "2026-10-01" — cuándo se creó (la primera ventana arranca acá)
  // el "?" = campo opcional: puede no estar (como string? en C#)
  inicioVentana?: string;            // inicio de la ventana ACTUAL; cambia en cada renovación (si no está, es fechaAlta)
  horasConsumidas: number;           // cuántas horas del paquete ya se "gastaron"
  fechaActivacionPrioridad?: string; // solo tiene valor si prioridad === "alta"
  empresasDesplazadas?: string[];    // string[] = lista de textos (como List<string>)
  ultimoDiaUrgente?: string;         // último día ("YYYY-MM-DD") para el que ya se generó su bloque x4
}

export interface BloqueHorario {
  id: string;
  empresaId: string;
  fecha: string;      // "2026-10-05"
  horaInicio: string; // "09:00"
  horaFin: string;    // "11:00"
  nota?: string;      // lo que el usuario anotó que hizo en esa sesión (opcional)
}

// Jornada laboral: horaInicio/horaFin válidos para un día concreto
export interface RangoHorario {
  horaInicio: string;
  horaFin: string;
}

// Todos los datos de la app juntos (lo que va en un respaldo)
export interface DatosApp {
  paquetes: Paquete[];
  empresas: Empresa[];
  bloques: BloqueHorario[];
  jornada: JornadaLaboral | null; // null = todavía no se configuró
}

// Config de jornada: fija (mismo horario todos los días) o variable por día
export interface JornadaLaboral {
  tipo: "fija" | "variable";
  horarioFijo?: RangoHorario;                        // si tipo === "fija"
  // Record<Clave, Valor> = diccionario (como Dictionary<K, V>)
  // Partial<...> = no hace falta que estén todas las claves (días libres)
  horarioPorDia?: Partial<Record<DiaSemana, RangoHorario>>; // si tipo === "variable"
}
