// components/kit/index.tsx
// Piezas visuales reutilizables de la app (tarjeta, botón, etiqueta, aviso,
// selector, pantalla). Todas usan el tema de ./tema, así la app se ve
// igual en todas las pantallas.
import React, { ReactNode } from "react";
import {
  View,
  Text,
  TextInput,
  TextInputProps,
  Pressable,
  ScrollView,
  StyleSheet,
  StyleProp,
  ViewStyle,
  ColorValue,
} from "react-native";
import { router, Href } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { SymbolView, SymbolViewProps } from "expo-symbols";
import { colores, fuentes, espacio, borde, tipo, ANCHO_MAXIMO } from "./tema";

// re-exporta todo lo de tema.ts: así las pantallas importan todo desde "kit"
export * from "./tema";

/**
 * Cierra un modal o una pantalla apilada: vuelve atrás si hay historial, y
 * si no (por ej. se abrió desde un link directo) va a la ruta indicada.
 * @param alternativa a dónde ir si no hay a dónde volver
 */
export function cerrarPantalla(alternativa: Href) {
  if (router.canGoBack()) {
    router.back();
  } else {
    router.replace(alternativa);
  }
}

// ---------------------------------------------------------
// Ícono
// ---------------------------------------------------------

/** Nombre de un ícono en cada plataforma (SF Symbols en iOS, Material en Android/web). */
// Tipo["campo"] = "el tipo de ese campo" (acá: el tipo de la prop name de SymbolView)
export type NombreIcono = SymbolViewProps["name"];

/**
 * Ícono del sistema (SF Symbols en iPhone, Material Symbols en Android).
 * @param nombre nombres por plataforma, ej. { ios: "calendar", android: "calendar_month", web: "calendar_month" }
 * @param color color del ícono (por defecto, tinta)
 * @param tamano tamaño en puntos
 */
// Las props se reciben como un objeto que se "desarma" en variables.
// "color = colores.tinta" = valor por defecto si no se pasa (como un parámetro opcional de C#).
// Después de los ":" va el tipo de ese objeto de props.
export function Icono({
  nombre,
  color = colores.tinta,
  tamano = 20,
}: {
  nombre: NombreIcono;
  color?: ColorValue; // ColorValue = cualquier color que acepte React Native
  tamano?: number;
}) {
  return <SymbolView name={nombre} tintColor={color} size={tamano} weight="semibold" />;
}

// ---------------------------------------------------------
// Tarjeta con sombra dura
// ---------------------------------------------------------

/**
 * Tarjeta con borde negro y sombra dura corrida hacia abajo a la derecha.
 * La sombra es una capa negra detrás (no "elevation"), así se ve igual en
 * iPhone y en Android.
 * @param style márgenes y tamaño de la tarjeta (por fuera)
 * @param estiloInterno relleno y layout del contenido (por dentro)
 * @param fondo color de la tarjeta (por defecto, blanco)
 * @param conSombra false para una tarjeta plana
 */
export function Tarjeta({
  children,
  style,
  estiloInterno,
  fondo = colores.superficie,
  conSombra = true,
}: {
  children: ReactNode; // "children" = lo que va entre <Tarjeta> y </Tarjeta>
  style?: StyleProp<ViewStyle>; // StyleProp<ViewStyle> = cualquier estilo válido para una View
  estiloInterno?: StyleProp<ViewStyle>;
  fondo?: string;
  conSombra?: boolean;
}) {
  return (
    <View style={[conSombra && styles.marcoConSombra, style]}>
      {conSombra && <View style={styles.capaSombra} />}
      {/* {children} = acá se dibuja el contenido que puso quien usa la tarjeta */}
      <View style={[styles.cara, { backgroundColor: fondo }, estiloInterno]}>{children}</View>
    </View>
  );
}

// ---------------------------------------------------------
// Botón
// ---------------------------------------------------------

type VarianteBoton = "primario" | "acento" | "secundario" | "peligro";

// diccionario variante → color (TypeScript obliga a completar las 4 variantes)
const FONDO_BOTON: Record<VarianteBoton, string> = {
  primario: colores.tinta,
  acento: colores.acento,
  secundario: colores.superficie,
  peligro: colores.peligro,
};
const TEXTO_BOTON: Record<VarianteBoton, string> = {
  primario: colores.textoSobreTinta,
  acento: colores.tinta,
  secundario: colores.tinta,
  peligro: colores.superficie,
};

/**
 * Botón con sombra dura que "se hunde" al tocarlo (la cara se corre hasta
 * tapar la sombra).
 * @param texto lo que dice el botón
 * @param onPress qué hacer al tocarlo
 * @param variante color: primario (negro), acento (amarillo), secundario (blanco), peligro (rojo)
 * @param chico versión compacta, para acciones dentro de tarjetas
 * @param icono ícono opcional a la izquierda del texto
 * @param disabled si es true no responde y se ve apagado
 */
export function Boton({
  texto,
  onPress,
  variante = "primario",
  chico = false,
  icono,
  disabled = false,
  style,
}: {
  texto: string;
  onPress: () => void; // "() => void" = una función sin parámetros que no devuelve nada (como Action)
  variante?: VarianteBoton;
  chico?: boolean;
  icono?: NombreIcono;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const sombra = chico ? 3 : borde.sombra;
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      style={[{ paddingRight: sombra, paddingBottom: sombra }, disabled && styles.apagado, style]}
    >
      {/* Pressable puede recibir una función: nos dice si está apretado en este momento */}
      {({ pressed }) => (
        // <> ... </> = "fragmento": agrupa varios elementos sin agregar una View extra
        <>
          <View style={[styles.capaSombra, { top: sombra, left: sombra }]} />
          <View
            style={[
              styles.cara,
              chico ? styles.botonChico : styles.boton,
              { backgroundColor: FONDO_BOTON[variante] },
              // si está apretado, corro la cara hasta tapar la sombra (efecto "hundido")
              pressed && { transform: [{ translateX: sombra }, { translateY: sombra }] },
            ]}
          >
            {icono && <Icono nombre={icono} color={TEXTO_BOTON[variante]} tamano={chico ? 14 : 18} />}
            <Text style={[chico ? styles.botonTextoChico : styles.botonTexto, { color: TEXTO_BOTON[variante] }]}>
              {texto}
            </Text>
          </View>
        </>
      )}
    </Pressable>
  );
}

/**
 * Botón cuadrado solo con ícono (por ejemplo, ajustes en el encabezado).
 * @param etiquetaAccesible lo que lee el lector de pantalla
 */
export function BotonIcono({
  icono,
  onPress,
  etiquetaAccesible,
  variante = "secundario",
}: {
  icono: NombreIcono;
  onPress: () => void;
  etiquetaAccesible: string;
  variante?: VarianteBoton;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={etiquetaAccesible}
      style={{ paddingRight: 3, paddingBottom: 3 }}
    >
      {({ pressed }) => (
        <>
          <View style={[styles.capaSombra, { top: 3, left: 3 }]} />
          <View
            style={[
              styles.cara,
              styles.botonIcono,
              { backgroundColor: FONDO_BOTON[variante] },
              pressed && { transform: [{ translateX: 3 }, { translateY: 3 }] },
            ]}
          >
            <Icono nombre={icono} color={TEXTO_BOTON[variante]} tamano={20} />
          </View>
        </>
      )}
    </Pressable>
  );
}

// ---------------------------------------------------------
// Etiqueta, aviso, estado vacío
// ---------------------------------------------------------

/**
 * Etiqueta chiquita con borde (ej. "ALTA", "30 H/MES").
 * @param fondo color de fondo (por defecto, amarillo de la marca)
 */
export function Etiqueta({ texto, fondo = colores.acento }: { texto: string; fondo?: string }) {
  return (
    <View style={[styles.etiqueta, { backgroundColor: fondo }]}>
      <Text style={tipo.etiqueta}>{texto.toUpperCase()}</Text>
    </View>
  );
}

/**
 * Caja de aviso para mensajes al usuario.
 * @param tipoAviso "info" (amarillo) o "error" (rojo)
 */
export function Aviso({ texto, tipoAviso = "info" }: { texto: string; tipoAviso?: "info" | "error" }) {
  const esError = tipoAviso === "error";
  return (
    <Tarjeta
      fondo={esError ? colores.peligro : colores.acento}
      conSombra={false}
      estiloInterno={styles.aviso}
      style={styles.margenAbajo}
    >
      <Icono
        nombre={
          esError
            ? { ios: "exclamationmark.triangle.fill", android: "warning", web: "warning" }
            : { ios: "info.circle.fill", android: "info", web: "info" }
        }
        color={esError ? colores.superficie : colores.tinta}
        tamano={18}
      />
      <Text style={[styles.avisoTexto, esError && { color: colores.superficie }]}>{texto}</Text>
    </Tarjeta>
  );
}

/**
 * Lo que se muestra cuando una lista está vacía.
 * @param titulo texto principal ("Sin sesiones hoy")
 * @param detalle explicación corta debajo
 */
export function Vacio({ titulo, detalle, icono }: { titulo: string; detalle: string; icono: NombreIcono }) {
  return (
    <View style={styles.vacio}>
      <Icono nombre={icono} color={colores.tintaTenue} tamano={32} />
      <Text style={[tipo.seccion, styles.vacioTitulo]}>{titulo}</Text>
      <Text style={[tipo.secundario, styles.centrado]}>{detalle}</Text>
    </View>
  );
}

// ---------------------------------------------------------
// Selector de opciones (control segmentado)
// ---------------------------------------------------------

/**
 * Fila de opciones donde se elige una sola (ej. FIJA / VARIABLE, SEMANA / MES).
 * Es genérico: <T extends string> significa que funciona con cualquier
 * tipo de texto, como un genérico de C#.
 */
export function Selector<T extends string>({
  opciones,
  valor,
  onCambiar,
}: {
  opciones: { valor: T; texto: string }[];
  valor: T;
  onCambiar: (nuevo: T) => void; // función que recibe la opción elegida
}) {
  return (
    <View style={styles.selector}>
      {/* map también puede dar el índice (0, 1, 2...) como segundo parámetro */}
      {opciones.map((opcion, indice) => {
        const activa = opcion.valor === valor;
        return (
          <Pressable
            key={opcion.valor}
            onPress={() => onCambiar(opcion.valor)}
            accessibilityRole="button"
            accessibilityState={{ selected: activa }}
            style={[
              styles.selectorOpcion,
              indice > 0 && styles.selectorSeparador,
              activa && styles.selectorOpcionActiva,
            ]}
          >
            <Text style={[styles.selectorTexto, activa && styles.selectorTextoActivo]}>{opcion.texto}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

// ---------------------------------------------------------
// Campo de texto
// ---------------------------------------------------------

/**
 * Campo de texto con su etiqueta arriba. Recibe todas las props de un
 * TextInput normal (value, onChangeText, keyboardType, etc.).
 * @param etiqueta texto de arriba ("NOMBRE")
 */
// "...props" = todas las demás props que no son etiqueta, juntas en un objeto.
// "A & B" = un tipo que tiene los campos de A y también los de B.
export function Campo({ etiqueta, ...props }: { etiqueta: string } & TextInputProps) {
  return (
    <View style={styles.campo}>
      <Text style={[tipo.etiqueta, styles.campoEtiqueta]}>{etiqueta.toUpperCase()}</Text>
      {/* {...props} = le pasa al TextInput todas esas props de una */}
      <TextInput placeholderTextColor={colores.tintaTenue} style={styles.campoInput} {...props} />
    </View>
  );
}

// ---------------------------------------------------------
// Pantalla
// ---------------------------------------------------------

/**
 * Estructura común de todas las pantallas: respeta la zona segura de arriba
 * (notch / barra de estado), muestra el encabezado y deja el contenido en un
 * scroll centrado.
 * @param antetitulo texto chico arriba del título (ej. la fecha)
 * @param titulo título grande de la pantalla
 * @param accion botón opcional a la derecha del título
 * @param conTabs true si la pantalla está dentro de la barra de pestañas
 *   (la barra ya ocupa la zona segura de abajo)
 */
export function Pantalla({
  antetitulo,
  titulo,
  accion,
  children,
  conTabs = true,
}: {
  antetitulo?: string;
  titulo: string;
  accion?: ReactNode;
  children: ReactNode;
  conTabs?: boolean;
}) {
  const insets = useSafeAreaInsets(); // márgenes del notch y la barra de inicio del celular
  return (
    <View style={[styles.pantalla, { paddingTop: insets.top }]}>
      <ScrollView
        contentContainerStyle={[
          styles.pantallaContenido,
          { paddingBottom: (conTabs ? 0 : insets.bottom) + espacio.xxl },
        ]}
        keyboardShouldPersistTaps="handled" // los toques funcionan aunque el teclado esté abierto
      >
        <View style={styles.encabezado}>
          <View style={styles.flex}>
            {antetitulo && <Text style={tipo.antetitulo}>{antetitulo.toUpperCase()}</Text>}
            <Text style={tipo.titulo}>{titulo}</Text>
          </View>
          {accion}
        </View>
        {children}
      </ScrollView>
    </View>
  );
}

// Estilos de los componentes del kit.
// position "absolute" + top/left = ubicar algo encima de otro, corrido esos puntos.
const styles = StyleSheet.create({
  flex: { flex: 1 },
  centrado: { textAlign: "center" },
  margenAbajo: { marginBottom: espacio.l },
  apagado: { opacity: 0.45 },

  marcoConSombra: {
    paddingRight: borde.sombra,
    paddingBottom: borde.sombra,
  },
  capaSombra: {
    position: "absolute",
    top: borde.sombra,
    left: borde.sombra,
    right: 0,
    bottom: 0,
    backgroundColor: colores.tinta,
    borderRadius: borde.radio,
  },
  cara: {
    borderWidth: borde.ancho,
    borderColor: colores.tinta,
    borderRadius: borde.radio,
    overflow: "hidden",
  },

  boton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: espacio.s,
    paddingVertical: 14,
    paddingHorizontal: espacio.l,
  },
  botonChico: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 7,
    paddingHorizontal: espacio.m,
  },
  botonTexto: {
    fontFamily: fuentes.negrita,
    fontSize: 15,
    letterSpacing: 0.5,
  },
  botonTextoChico: {
    fontFamily: fuentes.semi,
    fontSize: 13,
  },
  botonIcono: {
    width: 42,
    height: 42,
    alignItems: "center",
    justifyContent: "center",
  },

  etiqueta: {
    borderWidth: 1.5,
    borderColor: colores.tinta,
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
    alignSelf: "flex-start",
  },

  aviso: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: espacio.s,
    padding: espacio.m,
  },
  avisoTexto: {
    flex: 1,
    fontFamily: fuentes.medio,
    fontSize: 14,
    color: colores.tinta,
  },

  vacio: {
    alignItems: "center",
    gap: espacio.s,
    paddingVertical: espacio.xxl,
    paddingHorizontal: espacio.l,
    borderWidth: borde.ancho,
    borderColor: colores.tinta,
    borderStyle: "dashed",
    borderRadius: borde.radio,
  },
  vacioTitulo: {
    marginTop: espacio.xs,
  },

  selector: {
    flexDirection: "row",
    borderWidth: borde.ancho,
    borderColor: colores.tinta,
    borderRadius: borde.radio,
    overflow: "hidden",
    backgroundColor: colores.superficie,
  },
  selectorOpcion: {
    flex: 1,
    paddingVertical: 10,
    alignItems: "center",
  },
  selectorSeparador: {
    borderLeftWidth: borde.ancho,
    borderLeftColor: colores.tinta,
  },
  selectorOpcionActiva: {
    backgroundColor: colores.tinta,
  },
  selectorTexto: {
    fontFamily: fuentes.monoNegrita,
    fontSize: 12,
    letterSpacing: 1.2,
    color: colores.tinta,
  },
  selectorTextoActivo: {
    color: colores.acento,
  },

  campo: {
    marginBottom: espacio.l,
  },
  campoEtiqueta: {
    marginBottom: 6,
  },
  campoInput: {
    height: 50,
    borderWidth: borde.ancho,
    borderColor: colores.tinta,
    borderRadius: borde.radio,
    backgroundColor: colores.superficie,
    paddingHorizontal: espacio.m,
    fontFamily: fuentes.medio,
    fontSize: 16,
    color: colores.tinta,
  },

  pantalla: {
    flex: 1,
    backgroundColor: colores.fondo,
  },
  pantallaContenido: {
    width: "100%",
    maxWidth: ANCHO_MAXIMO,
    alignSelf: "center",
    paddingHorizontal: espacio.l + 2,
    paddingTop: espacio.l,
  },
  encabezado: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: espacio.m,
    marginBottom: espacio.xl,
  },
});
