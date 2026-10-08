// src/app/ajustes.tsx — Ajustes
// Se abre con el botón ⚙ de la pantalla Hoy. Tiene la jornada laboral y el
// respaldo de datos (exportar a un archivo / restaurar desde un archivo).
import React, { useState } from "react";
import { View, Text, StyleSheet, Pressable, Platform } from "react-native";
import { useRouter } from "expo-router";
import { File, Paths } from "expo-file-system";
import * as Sharing from "expo-sharing"; // "* as Sharing" = trae todo el módulo bajo ese nombre
import * as DocumentPicker from "expo-document-picker";
import { obtenerTodo, reemplazarTodo } from "../storage/index";
import { armarRespaldo, leerRespaldo, nombreArchivoRespaldo, Respaldo } from "../sistema/respaldo";
import { fechaLocalISO } from "../sistema/cronograma";
import {
  Pantalla,
  Tarjeta,
  Boton,
  BotonIcono,
  Aviso,
  Icono,
  cerrarPantalla,
  colores,
  espacio,
  fuentes,
  tipo,
} from "../components/kit";
import { fechaLarga } from "../components/formato";

// En la compu (web) no hay menú de compartir ni carpeta de la app: el respaldo
// se descarga directo, como cualquier archivo que se baja del navegador.
const esWeb = Platform.OS === "web";

/** Descarga un texto como archivo desde el navegador (solo web). */
function descargarEnNavegador(nombreArchivo: string, contenido: string) {
  // Blob = el contenido del archivo en memoria; el link temporal lo "descarga"
  const blob = new Blob([contenido], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = nombreArchivo;
  link.click();
  URL.revokeObjectURL(url); // libera la memoria del Blob
}

/**
 * Pantalla Ajustes: acceso a la jornada laboral y respaldo de datos.
 * Restaurar un respaldo reemplaza TODO, así que pide confirmar antes.
 */
const Ajustes = () => {
  const router = useRouter();
  const [trabajando, setTrabajando] = useState(false);
  const [aviso, setAviso] = useState<{ texto: string; tipo: "info" | "error" } | null>(null);
  // respaldo leído y validado, esperando que el usuario confirme la restauración
  const [aRestaurar, setARestaurar] = useState<Respaldo | null>(null);

  /** Arma el archivo de respaldo y abre el menú de compartir para guardarlo donde se quiera. */
  const exportar = async () => {
    setTrabajando(true);
    setAviso(null);
    try {
      const ahora = new Date();
      const respaldo = armarRespaldo(await obtenerTodo(), ahora);

      if (esWeb) {
        descargarEnNavegador(nombreArchivoRespaldo(ahora), JSON.stringify(respaldo, null, 2));
        setAviso({ texto: "Respaldo descargado (quedó en la carpeta Descargas).", tipo: "info" });
        return; // el finally igual se ejecuta
      }

      if (!(await Sharing.isAvailableAsync())) {
        setAviso({ texto: "Este dispositivo no permite compartir archivos.", tipo: "error" });
        return;
      }

      // escribo el archivo en la carpeta temporal de la app (si ya existía uno de hoy, lo piso)
      const archivo = new File(Paths.cache, nombreArchivoRespaldo(ahora));
      if (archivo.exists) archivo.delete();
      archivo.create();
      archivo.write(JSON.stringify(respaldo, null, 2)); // null, 2 = con sangría, legible

      // abre el menú del celular: Drive, Archivos, WhatsApp, mail...
      await Sharing.shareAsync(archivo.uri, {
        mimeType: "application/json", // Android
        UTI: "public.json", // iPhone
        dialogTitle: "Guardar respaldo",
      });
    } catch {
      setAviso({ texto: "No se pudo crear el respaldo.", tipo: "error" });
    } finally {
      setTrabajando(false);
    }
  };

  /** Deja elegir un archivo, lo valida y, si sirve, pide confirmar antes de restaurar. */
  const elegirArchivo = async () => {
    setAviso(null);
    setARestaurar(null);
    try {
      // "*/*" = cualquier archivo: según de dónde venga, un .json puede no tener el tipo correcto
      const resultado = await DocumentPicker.getDocumentAsync({ type: "*/*", copyToCacheDirectory: true });
      if (resultado.canceled) return; // el usuario cerró el selector

      // en web el selector devuelve el archivo del navegador (.file); en el celular, una ruta (.uri)
      const elegido = resultado.assets[0];
      const texto = elegido.file ? await elegido.file.text() : await new File(elegido.uri).text();
      const lectura = leerRespaldo(texto); // la validación vive en sistema/
      if (!lectura.ok) {
        setAviso({ texto: lectura.error, tipo: "error" });
        return;
      }
      setARestaurar(lectura.respaldo); // muestra el resumen y el botón de confirmar
    } catch {
      setAviso({ texto: "No se pudo leer el archivo.", tipo: "error" });
    }
  };

  /** Reemplaza todos los datos por los del respaldo elegido. */
  const restaurar = async () => {
    if (!aRestaurar) return;
    setTrabajando(true);
    try {
      await reemplazarTodo(aRestaurar);
      setARestaurar(null);
      setAviso({ texto: "Respaldo restaurado. Ya podés ver tus datos en Hoy y en el Calendario.", tipo: "info" });
    } catch {
      setAviso({ texto: "No se pudo restaurar el respaldo. Tus datos no se modificaron.", tipo: "error" });
    } finally {
      setTrabajando(false);
    }
  };

  return (
    <Pantalla
      antetitulo="Tempomanager"
      titulo="Ajustes"
      conTabs={false}
      accion={
        <BotonIcono
          icono={{ ios: "xmark", android: "close", web: "close" }}
          etiquetaAccesible="Cerrar"
          onPress={() => cerrarPantalla("/")}
        />
      }
    >
      {/* ----- Jornada ----- */}
      <Text style={[tipo.etiqueta, styles.seccion]}>HORARIO</Text>
      <Pressable onPress={() => router.push("/jornada")} accessibilityRole="button">
        <Tarjeta estiloInterno={styles.fila} style={styles.margen}>
          <Icono nombre={{ ios: "clock.fill", android: "schedule", web: "schedule" }} />
          <View style={styles.flex}>
            <Text style={styles.filaTitulo}>Jornada laboral</Text>
            <Text style={tipo.secundario}>Tu horario de trabajo, de lunes a viernes</Text>
          </View>
          <Icono nombre={{ ios: "chevron.right", android: "chevron_right", web: "chevron_right" }} color={colores.tintaTenue} />
        </Tarjeta>
      </Pressable>

      {/* ----- Respaldo ----- */}
      <Text style={[tipo.etiqueta, styles.seccion]}>RESPALDO DE DATOS</Text>
      <Tarjeta estiloInterno={styles.bloque} style={styles.margen}>
        <Text style={tipo.cuerpo}>
          {esWeb
            ? "Tus datos están guardados solo en este navegador de esta compu (no se comparten con el celular). " +
              "Para pasarlos de un lado al otro, exportá el respaldo en uno y restauralo en el otro. " +
              "Si borrás los datos de navegación de este sitio, se pierden: hacé un respaldo de vez en cuando."
            : "Tus datos están guardados solo en este celular. Hacé un respaldo de vez en cuando y guardalo en " +
              "Drive, Archivos o mandátelo por mail: si cambiás de celular o borrás la app, lo restaurás desde acá."}
        </Text>
        <View style={styles.botones}>
          <Boton
            texto="Exportar respaldo"
            icono={{ ios: "square.and.arrow.up", android: "upload", web: "upload" }}
            onPress={exportar}
            disabled={trabajando}
          />
          <Boton
            texto="Restaurar desde archivo"
            variante="secundario"
            icono={{ ios: "square.and.arrow.down", android: "download", web: "download" }}
            onPress={elegirArchivo}
            disabled={trabajando}
          />
        </View>
      </Tarjeta>

      {aviso && <Aviso texto={aviso.texto} tipoAviso={aviso.tipo} />}

      {/* confirmación antes de restaurar: muestra qué tiene el respaldo */}
      {aRestaurar && (
        <Tarjeta fondo={colores.acento} estiloInterno={styles.bloque} style={styles.margen}>
          <Text style={tipo.seccion}>¿Restaurar este respaldo?</Text>
          <Text style={tipo.cuerpo}>
            Del {fechaLarga(fechaLocalISO(new Date(aRestaurar.creado)))}: {aRestaurar.empresas.length} empresas,{" "}
            {aRestaurar.paquetes.length} paquetes y {aRestaurar.bloques.length} sesiones.
          </Text>
          <Text style={[tipo.cuerpo, styles.advertencia]}>
            Reemplaza TODOS los datos que hay ahora en {esWeb ? "esta compu" : "el celular"}. No se puede deshacer.
          </Text>
          <View style={styles.botones}>
            <Boton texto="Sí, restaurar" variante="peligro" onPress={restaurar} disabled={trabajando} />
            <Boton texto="Cancelar" variante="secundario" onPress={() => setARestaurar(null)} />
          </View>
        </Tarjeta>
      )}
    </Pantalla>
  );
};

const styles = StyleSheet.create({
  flex: { flex: 1 },
  seccion: {
    color: colores.tintaSuave,
    marginBottom: espacio.s,
  },
  margen: {
    marginBottom: espacio.xl,
  },
  fila: {
    flexDirection: "row",
    alignItems: "center",
    gap: espacio.m,
    padding: espacio.l,
  },
  filaTitulo: {
    fontFamily: fuentes.negrita,
    fontSize: 16,
    color: colores.tinta,
  },
  bloque: {
    padding: espacio.l,
    gap: espacio.m,
  },
  botones: {
    gap: espacio.m,
    marginTop: espacio.s,
  },
  advertencia: {
    fontFamily: fuentes.negrita,
  },
});

export default Ajustes;
