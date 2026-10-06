// components/kit/tema.ts
// Sistema de diseño de la app ("brutalista refinado"): todos los colores,
// tipografías, espaciados y bordes salen de acá. Si querés cambiar el look
// de toda la app, este es el único archivo que hay que tocar.

/** Paleta base. */
export const colores = {
  fondo: "#F4F1EA",      // papel cálido, fondo de todas las pantallas
  superficie: "#FFFFFF", // tarjetas
  hundido: "#EAE5DA",    // campos, controles apagados, zonas secundarias
  tinta: "#111111",      // texto principal, bordes y sombras
  tintaSuave: "#55534E", // texto secundario
  tintaTenue: "#8C887F", // texto terciario, íconos inactivos
  acento: "#FFD23F",     // amarillo de la marca
  peligro: "#E5484D",    // eliminar, errores
  textoSobreTinta: "#F4F1EA",
} as const; // "as const" = los valores no se pueden reasignar (como readonly en C#)

/**
 * Colores para distinguir empresas en el cronograma y el calendario.
 * Todos se leen bien con texto negro encima.
 */
const COLORES_EMPRESA = [
  "#FFD23F", // amarillo
  "#5BC0EB", // celeste
  "#FF8A5B", // coral
  "#9BE564", // verde
  "#C3A6FF", // lila
  "#FF7EB6", // rosa
  "#4ECDC4", // turquesa
  "#F7B267", // naranja suave
];

/**
 * Color fijo de una empresa, calculado a partir de su id: la misma empresa
 * siempre tiene el mismo color, sin tener que guardarlo.
 * @param empresaId id de la empresa
 * @returns un color "#RRGGBB" de la paleta de empresas
 */
export function colorDeEmpresa(empresaId: string): string {
  // suma simple de los códigos de las letras → índice en la paleta
  let suma = 0;
  for (let i = 0; i < empresaId.length; i++) suma = (suma * 31 + empresaId.charCodeAt(i)) % 100000;
  return COLORES_EMPRESA[suma % COLORES_EMPRESA.length];
}

/**
 * Nombres de las fuentes (se cargan en src/app/_layout.tsx).
 * Con fuentes propias cada grosor es una fuente distinta: en vez de
 * fontWeight se cambia de fontFamily.
 */
export const fuentes = {
  regular: "SpaceGrotesk_400Regular",
  medio: "SpaceGrotesk_500Medium",
  semi: "SpaceGrotesk_600SemiBold",
  negrita: "SpaceGrotesk_700Bold",
  mono: "SpaceMono_400Regular",       // horas y números
  monoNegrita: "SpaceMono_700Bold",
} as const;

/** Escala de espaciados (en puntos). Usar siempre estos valores. */
export const espacio = {
  xs: 4,
  s: 8,
  m: 12,
  l: 16,
  xl: 24,
  xxl: 32,
} as const;

/** Bordes y sombra dura. */
export const borde = {
  ancho: 2,
  sombra: 4, // cuánto se corre la sombra negra hacia abajo y a la derecha
  radio: 6,  // esquinas apenas redondeadas: más prolijo que el canto vivo
} as const;

/** Estilos de texto listos para usar con StyleSheet. */
export const tipo = {
  // número/fecha chiquita arriba del título ("MARTES 06 OCT")
  antetitulo: { fontFamily: fuentes.monoNegrita, fontSize: 12, letterSpacing: 1.5, color: colores.tintaSuave },
  titulo: { fontFamily: fuentes.negrita, fontSize: 30, letterSpacing: -0.5, color: colores.tinta },
  seccion: { fontFamily: fuentes.negrita, fontSize: 18, color: colores.tinta },
  cuerpo: { fontFamily: fuentes.medio, fontSize: 15, color: colores.tinta },
  secundario: { fontFamily: fuentes.regular, fontSize: 13, color: colores.tintaSuave },
  etiqueta: { fontFamily: fuentes.monoNegrita, fontSize: 11, letterSpacing: 1.2, color: colores.tinta },
  hora: { fontFamily: fuentes.monoNegrita, fontSize: 15, color: colores.tinta },
} as const;

/** Ancho máximo del contenido (para que en tablet o web no se estire de más). */
export const ANCHO_MAXIMO = 520;
