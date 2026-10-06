// components/tarjeta-sesion.tsx
// Tarjeta de una sesión del cronograma: franja con el color de la empresa,
// horario, nombre, duración, la etiqueta ALTA si corresponde y la nota
// (lo que el usuario escribió que hizo). La usan la pantalla Hoy y el Calendario.
import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { SesionDelDia } from "../sistema/cronograma";
import { Tarjeta, Etiqueta, Boton, Icono, colores, colorDeEmpresa, espacio, fuentes, tipo } from "./kit";
import { textoDuracion } from "./formato";

/**
 * Muestra una sesión.
 * @param sesion la sesión (bloque + nombre y prioridad de su empresa)
 * @param compacta versión más baja, para listas largas (calendario)
 * @param onEditarNota si se pasa, aparece el botón "Agregar nota" / "Editar nota"
 *   (en Hoy). Si no se pasa, la nota solo se lee (en el Calendario).
 */
export function TarjetaSesion({
  sesion,
  compacta = false,
  onEditarNota,
}: {
  sesion: SesionDelDia;
  compacta?: boolean;
  onEditarNota?: () => void;
}) {
  const { bloque, nombreEmpresa, prioridad } = sesion; // saca esos 3 campos de sesion en variables
  const color = colorDeEmpresa(bloque.empresaId);

  return (
    <Tarjeta style={styles.margen} estiloInterno={styles.fila} conSombra={!compacta}>
      {/* franja de color de la empresa, a la izquierda */}
      <View style={[styles.franja, { backgroundColor: color }]} />

      <View style={[styles.horario, compacta && styles.horarioCompacto]}>
        <Text style={tipo.hora}>{bloque.horaInicio}</Text>
        <Text style={styles.horaFin}>{bloque.horaFin}</Text>
      </View>

      <View style={[styles.info, compacta && styles.infoCompacta]}>
        {/* numberOfLines={1}: si el nombre es largo, se corta con "..." */}
        <Text style={styles.nombre} numberOfLines={1}>
          {nombreEmpresa}
        </Text>
        <View style={styles.detalle}>
          <Text style={tipo.secundario}>{textoDuracion(bloque.horaInicio, bloque.horaFin)}</Text>
          {prioridad === "alta" && <Etiqueta texto="Alta" fondo={colores.acento} />}
        </View>

        {/* la nota, si tiene. Uso "? :" y no "&&": con un texto vacío, "&&"
            intentaría dibujar "" fuera de un <Text> y la app fallaría */}
        {bloque.nota ? (
          <View style={styles.nota}>
            <Icono nombre={{ ios: "note.text", android: "notes", web: "notes" }} color={colores.tintaSuave} tamano={14} />
            <Text style={styles.notaTexto}>{bloque.nota}</Text>
          </View>
        ) : null}

        {/* botón para escribir la nota (solo si quien usa la tarjeta pasó onEditarNota) */}
        {onEditarNota && (
          <Boton
            texto={bloque.nota ? "Editar nota" : "Agregar nota"}
            variante="secundario"
            chico
            icono={{ ios: "square.and.pencil", android: "edit_note", web: "edit_note" }}
            onPress={onEditarNota}
            style={styles.botonNota}
          />
        )}
      </View>
    </Tarjeta>
  );
}

const styles = StyleSheet.create({
  margen: {
    marginBottom: espacio.m,
  },
  nota: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 6,
    marginTop: espacio.s,
    padding: espacio.s,
    borderRadius: 4,
    backgroundColor: colores.fondo,
  },
  notaTexto: {
    flex: 1,
    fontFamily: fuentes.regular,
    fontSize: 13,
    color: colores.tinta,
  },
  botonNota: {
    alignSelf: "flex-start", // el botón no se estira a lo ancho
    marginTop: espacio.s,
  },
  fila: {
    flexDirection: "row",
    alignItems: "stretch",
  },
  franja: {
    width: 10,
    borderRightWidth: 2,
    borderRightColor: colores.tinta,
  },
  horario: {
    width: 74,
    paddingVertical: espacio.m,
    alignItems: "center",
    justifyContent: "center",
    borderRightWidth: 1.5,
    borderRightColor: colores.hundido,
  },
  horarioCompacto: {
    paddingVertical: espacio.s,
  },
  horaFin: {
    fontFamily: fuentes.mono,
    fontSize: 12,
    color: colores.tintaSuave,
    marginTop: 2,
  },
  info: {
    flex: 1,
    justifyContent: "center",
    paddingHorizontal: espacio.m,
    paddingVertical: espacio.m,
  },
  infoCompacta: {
    paddingVertical: espacio.s,
  },
  nombre: {
    fontFamily: fuentes.negrita,
    fontSize: 16,
    color: colores.tinta,
  },
  detalle: {
    flexDirection: "row",
    alignItems: "center",
    gap: espacio.s,
    marginTop: 4,
  },
});
