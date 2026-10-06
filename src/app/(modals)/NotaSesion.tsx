// src/app/(modals)/NotaSesion.tsx — modal para escribir la nota de una sesión
// Se abre desde la pantalla Hoy con el id del bloque como parámetro:
// router.push({ pathname: "/NotaSesion", params: { bloqueId } })
import React, { useState, useEffect } from "react";
import { View, Text, TextInput, StyleSheet } from "react-native";
import { useLocalSearchParams } from "expo-router";
import { obtenerBloques, obtenerEmpresas, guardarBloques } from "../../storage/index";
import { ponerNota, LARGO_MAXIMO_NOTA } from "../../sistema/notas";
import { BloqueHorario } from "../../type";
import {
  Pantalla,
  Boton,
  BotonIcono,
  Aviso,
  cerrarPantalla,
  colores,
  colorDeEmpresa,
  espacio,
  fuentes,
  borde,
  tipo,
} from "../../components/kit";
import { fechaLarga, textoDuracion } from "../../components/formato";

/**
 * Modal Nota: muestra la sesión (empresa y horario) y un campo de texto para
 * anotar lo que se hizo. Guardar con el texto vacío borra la nota.
 */
const NotaSesion = () => {
  // lee el parámetro de la ruta: el id del bloque al que se le escribe la nota
  // (<{ bloqueId?: string }> = el tipo de los parámetros que espero)
  const { bloqueId } = useLocalSearchParams<{ bloqueId?: string }>();

  const [bloque, setBloque] = useState<BloqueHorario | null>(null);
  const [nombreEmpresa, setNombreEmpresa] = useState("");
  const [texto, setTexto] = useState("");
  const [noEncontrado, setNoEncontrado] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // al abrir: busco el bloque y su empresa, y cargo la nota que ya tenga
  useEffect(() => {
    Promise.all([obtenerBloques(), obtenerEmpresas()]).then(([bloques, empresas]) => {
      const encontrado = bloques.find((b) => b.id === bloqueId);
      if (!encontrado) {
        setNoEncontrado(true); // por ej. si se borró la empresa mientras tanto
        return;
      }
      setBloque(encontrado);
      setTexto(encontrado.nota ?? "");
      setNombreEmpresa(empresas.find((e) => e.id === encontrado.empresaId)?.nombre ?? "");
    });
  }, [bloqueId]);

  /** Guarda la nota (leyendo los bloques frescos del storage) y cierra el modal. */
  const guardar = async () => {
    if (!bloque) return;
    setGuardando(true);
    setError(null);
    try {
      const bloques = await obtenerBloques();
      // la regla vive en sistema/: recorta espacios, y si queda vacía la borra
      await guardarBloques(ponerNota(bloques, bloque.id, texto));
      cerrarPantalla("/");
    } catch {
      setError("No se pudo guardar la nota.");
    } finally {
      setGuardando(false);
    }
  };

  return (
    <Pantalla
      antetitulo={bloque ? `Nota · ${fechaLarga(bloque.fecha)}` : "Nota"}
      titulo={nombreEmpresa || "Sesión"} // || = si está vacío, usar "Sesión"
      conTabs={false}
      accion={
        <BotonIcono
          icono={{ ios: "xmark", android: "close", web: "close" }}
          etiquetaAccesible="Cerrar"
          onPress={() => cerrarPantalla("/")}
        />
      }
    >
      {noEncontrado && <Aviso texto="Esta sesión ya no existe en el cronograma." tipoAviso="error" />}

      {bloque && (
        <>
          {/* horario de la sesión, con el color de la empresa */}
          <View style={styles.horario}>
            <View style={[styles.color, { backgroundColor: colorDeEmpresa(bloque.empresaId) }]} />
            <Text style={tipo.hora}>
              {bloque.horaInicio} – {bloque.horaFin}
            </Text>
            <Text style={tipo.secundario}>{textoDuracion(bloque.horaInicio, bloque.horaFin)}</Text>
          </View>

          <Text style={[tipo.etiqueta, styles.etiqueta]}>¿QUÉ HICISTE EN ESTA SESIÓN?</Text>
          <TextInput
            style={styles.campo}
            value={texto}
            onChangeText={setTexto}
            placeholder="Ej. Reunión de avance, se corrigió el reporte de ventas…"
            placeholderTextColor={colores.tintaTenue}
            multiline // varias líneas
            maxLength={LARGO_MAXIMO_NOTA}
            textAlignVertical="top" // en Android, que el texto arranque arriba
            autoFocus // abre el teclado al entrar
          />
          {/* contador de caracteres */}
          <Text style={[tipo.secundario, styles.contador]}>
            {texto.length}/{LARGO_MAXIMO_NOTA}
          </Text>

          {error && <Aviso texto={error} tipoAviso="error" />}

          <View style={styles.botones}>
            <Boton texto={guardando ? "Guardando..." : "Guardar nota"} onPress={guardar} disabled={guardando} />
            <Boton texto="Cancelar" variante="secundario" onPress={() => cerrarPantalla("/")} />
          </View>
          <Text style={[tipo.secundario, styles.ayuda]}>Para borrar la nota, dejá el texto vacío y guardá.</Text>
        </>
      )}
    </Pantalla>
  );
};

const styles = StyleSheet.create({
  horario: {
    flexDirection: "row",
    alignItems: "center",
    gap: espacio.s,
    marginBottom: espacio.xl,
  },
  color: {
    width: 14,
    height: 14,
    borderRadius: 3,
    borderWidth: borde.ancho,
    borderColor: colores.tinta,
  },
  etiqueta: {
    marginBottom: 6,
  },
  campo: {
    minHeight: 160,
    borderWidth: borde.ancho,
    borderColor: colores.tinta,
    borderRadius: borde.radio,
    backgroundColor: colores.superficie,
    padding: espacio.m,
    fontFamily: fuentes.medio,
    fontSize: 16,
    color: colores.tinta,
  },
  contador: {
    textAlign: "right",
    marginTop: 4,
    marginBottom: espacio.l,
  },
  botones: {
    gap: espacio.m,
  },
  ayuda: {
    textAlign: "center",
    marginTop: espacio.l,
  },
});

export default NotaSesion;
