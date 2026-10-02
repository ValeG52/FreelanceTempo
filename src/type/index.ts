export type Prioridad = "media" | "alta";
export type DiaSemana = "lunes" | "martes" | "miercoles" | "jueves" | "viernes" | "sabado" | "domingo";

export interface Paquete {
  id: string;
  nombre: string;
  horas: number;
  periodo: "semana" | "mes";
}

export interface Empresa {
  id: string;
  nombre: string;
  paqueteId: string;
  prioridad: Prioridad;
  fechaAlta: string;                 // "2026-10-01" — cuándo se creó, define su ventana
  horasConsumidas: number;           // cuántas horas del paquete ya se "gastaron"
  fechaActivacionPrioridad?: string; // solo tiene valor si prioridad === "alta"
  empresasDesplazadas?: string[];    // ids de las empresas que corrió mientras estuvo en alta
}

export interface BloqueHorario {
  id: string;
  empresaId: string;
  fecha: string;      // "2026-10-05"
  horaInicio: string; // "09:00"
  horaFin: string;    // "11:00"
}

// Jornada laboral: horaInicio/horaFin válidos para un día concreto
export interface RangoHorario {
  horaInicio: string;
  horaFin: string;
}

// Config de jornada: fija (mismo horario todos los días) o variable por día
export interface JornadaLaboral {
  tipo: "fija" | "variable";
  horarioFijo?: RangoHorario;                        // si tipo === "fija"
  horarioPorDia?: Partial<Record<DiaSemana, RangoHorario>>; // si tipo === "variable"
}