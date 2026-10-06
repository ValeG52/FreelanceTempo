// src/app/(modals)/AgregarEmpresa.tsx — modal para dar de alta una empresa
// Al guardar se genera todo su cronograma; si no entra, no se guarda nada.
import React, { useState, useEffect } from "react";
import { View, Text, StyleSheet, Pressable } from "react-native";
import {
  obtenerPaquetes,
  obtenerEmpresas,
  obtenerBloques,
  obtenerJornada,
  guardarEmpresasYBloques,
} from "../../storage/index";
import { Empresa, Paquete } from "../../type/index";
import {
  crearEmpresaConCronograma,
  fechaLocalISO,
  momentoDe,
  JORNADA_POR_DEFECTO,
} from "../../sistema/cronograma";
import {
  Pantalla,
  Campo,
  Boton,
  BotonIcono,
  Aviso,
  Icono,
  cerrarPantalla,
  colores,
  espacio,
  fuentes,
  borde,
  tipo,
} from "../../components/kit";

/**
 * Modal Agregar Empresa: nombre y paquete. Arranca siempre en prioridad
 * media y con fecha de alta hoy.
 */
const AgregarEmpresa = () => {
  const [nombre, setNombre] = useState("");
  const [paqueteId, setPaqueteId] = useState("");
  const [paquetes, setPaquetes] = useState<Paquete[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);

  // con [] corre una sola vez, al abrir la pantalla: carga los paquetes
  useEffect(() => {
    obtenerPaquetes().then((data) => setPaquetes(data));
  }, []);

  // trim() saca los espacios de los costados: "  " cuenta como vacío
  const valido = nombre.trim() !== "" && paqueteId !== "";

  /** Crea la empresa con todo su cronograma; si no hay cupos, avisa y no guarda nada. */
  const guardar = async () => {
    const paquete = paquetes.find((p) => p.id === paqueteId);
    if (!paquete || !valido) return;
    setError(null);
    setGuardando(true);

    try {
      const nuevaEmpresa: Empresa = {
        id: Date.now().toString(),
        nombre: nombre.trim(),
        paqueteId,
        prioridad: "media",                     // siempre arranca en media
        fechaAlta: fechaLocalISO(new Date()),   // "YYYY-MM-DD" de hoy, define el inicio de su ventana
        horasConsumidas: 0,                     // arranca en cero, todavía no gastó nada
      };

      const [empresas, bloques, jornadaGuardada] = await Promise.all([
        obtenerEmpresas(),
        obtenerBloques(),
        obtenerJornada(),
      ]);

      // el sistema arma todas las sesiones del paquete dentro de su ventana
      const resultado = crearEmpresaConCronograma(
        nuevaEmpresa,
        paquete,
        jornadaGuardada ?? JORNADA_POR_DEFECTO,
        bloques,
        momentoDe(new Date()) // hoy solo se agenda desde la hora actual
      );

      if (!resultado.exito) {
        // regla de negocio: si no entra todo, no se guarda nada (ni la empresa)
        setError("No hay cupos para este paquete en los próximos días.");
        return;
      }

      await guardarEmpresasYBloques([...empresas, nuevaEmpresa], resultado.bloques);
      cerrarPantalla("/mis-empresas");
    } finally {
      setGuardando(false);
    }
  };

  return (
    <Pantalla
      antetitulo="Nueva"
      titulo="Empresa"
      conTabs={false}
      accion={
        <BotonIcono
          icono={{ ios: "xmark", android: "close", web: "close" }}
          etiquetaAccesible="Cerrar"
          onPress={() => cerrarPantalla("/mis-empresas")}
        />
      }
    >
      {/* value = lo que muestra; onChangeText = qué hacer cuando se escribe (acá: guardar en el state) */}
      <Campo etiqueta="Nombre" placeholder="Ej. Acme S.A." value={nombre} onChangeText={setNombre} />

      <Text style={[tipo.etiqueta, styles.etiqueta]}>PAQUETE</Text>
      {paquetes.length === 0 ? (
        <Aviso texto="Todavía no hay paquetes. Creá uno en la pestaña Paquetes antes de agregar una empresa." />
      ) : (
        // lista de paquetes para elegir uno (tipo "radio button")
        <View style={styles.opciones}>
          {paquetes.map((paquete, indice) => {
            const elegido = paquete.id === paqueteId;
            return (
              <Pressable
                key={paquete.id}
                onPress={() => setPaqueteId(paquete.id)}
                accessibilityRole="radio"
                accessibilityState={{ checked: elegido }}
                style={[styles.opcion, indice > 0 && styles.opcionSeparada, elegido && styles.opcionElegida]}
              >
                <View style={[styles.radio, elegido && styles.radioElegido]}>
                  {elegido && <Icono nombre={{ ios: "checkmark", android: "check", web: "check" }} tamano={14} />}
                </View>
                <Text style={[styles.opcionNombre, elegido && styles.textoClaro]} numberOfLines={1}>
                  {paquete.nombre}
                </Text>
                <Text style={[styles.opcionDetalle, elegido && styles.textoClaro]}>
                  {paquete.horas} h/{paquete.periodo}
                </Text>
              </Pressable>
            );
          })}
        </View>
      )}

      <Text style={[tipo.secundario, styles.nota]}>
        Se arma su cronograma completo al guardar. Arranca en prioridad media.
      </Text>

      {error && <Aviso texto={error} tipoAviso="error" />}

      <View style={styles.botones}>
        <Boton texto="Guardar empresa" onPress={guardar} disabled={!valido || guardando} />
        <Boton texto="Cancelar" variante="secundario" onPress={() => cerrarPantalla("/mis-empresas")} />
      </View>
    </Pantalla>
  );
};

const styles = StyleSheet.create({
  etiqueta: {
    marginBottom: 6,
  },
  opciones: {
    borderWidth: borde.ancho,
    borderColor: colores.tinta,
    borderRadius: borde.radio,
    overflow: "hidden",
    backgroundColor: colores.superficie,
  },
  opcion: {
    flexDirection: "row",
    alignItems: "center",
    gap: espacio.m,
    paddingVertical: 14,
    paddingHorizontal: espacio.m,
  },
  opcionSeparada: {
    borderTopWidth: 1.5,
    borderTopColor: colores.hundido,
  },
  opcionElegida: {
    backgroundColor: colores.tinta,
  },
  radio: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: borde.ancho,
    borderColor: colores.tinta,
    backgroundColor: colores.superficie,
    alignItems: "center",
    justifyContent: "center",
  },
  radioElegido: {
    backgroundColor: colores.acento,
    borderColor: colores.acento,
  },
  opcionNombre: {
    flex: 1,
    fontFamily: fuentes.semi,
    fontSize: 16,
    color: colores.tinta,
  },
  opcionDetalle: {
    fontFamily: fuentes.mono,
    fontSize: 13,
    color: colores.tintaSuave,
  },
  textoClaro: {
    color: colores.textoSobreTinta,
  },
  nota: {
    marginTop: espacio.m,
    marginBottom: espacio.l,
  },
  botones: {
    gap: espacio.m,
    marginTop: espacio.s,
  },
});

export default AgregarEmpresa;
