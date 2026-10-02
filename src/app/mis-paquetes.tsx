// src/app/mis-paquetes.tsx
import React, { useState, useEffect } from "react";
import { View, Text, StyleSheet, TouchableOpacity } from "react-native";
import { obtenerPaquetes, obtenerEmpresas, guardarPaquetes } from "../storage/index";
import { empresasQueUsanPaquete } from "../sistema/eliminacion";
import { BotonEliminar } from "../components/boton-eliminar";
import { Paquete } from "../type";
import { useRouter } from "expo-router";

const MisPaquetes = () => {
  const [paquetes, setPaquetes] = useState<Paquete[]>([]);
  const router = useRouter();
  const [guardando, setGuardando] = useState(false);
  // mensaje para el usuario (null = no mostrar nada)
  const [aviso, setAviso] = useState<string | null>(null);

  useEffect(() => {
    obtenerPaquetes().then((data) => setPaquetes(data));
  }, []);

  const borrarPaquete = async (paquete: Paquete) => {
    setGuardando(true);
    setAviso(null);
    try {
      const [paquetesGuardados, empresas] = await Promise.all([obtenerPaquetes(), obtenerEmpresas()]);

      // regla: no se borra un paquete que alguna empresa está usando
      const queLoUsan = empresasQueUsanPaquete(paquete.id, empresas);
      if (queLoUsan.length > 0) {
        const nombres = queLoUsan.map((e) => e.nombre).join(", ");
        setAviso(`No se puede eliminar "${paquete.nombre}": lo usa ${nombres}. Eliminá esas empresas primero.`);
        return; // el finally igual se ejecuta y apaga "guardando"
      }

      const nuevaLista = paquetesGuardados.filter((p) => p.id !== paquete.id);
      await guardarPaquetes(nuevaLista);
      setPaquetes(nuevaLista);
    } catch {
      setAviso("No se pudo eliminar el paquete.");
    } finally {
      setGuardando(false);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.headerRow}>
        <Text style={styles.titulo}>MIS PAQUETES</Text>
        <View style={styles.pill}>
          <Text style={styles.pillText}>{paquetes.length}</Text>
        </View>
      </View>

      <TouchableOpacity
        style={styles.botonAgregar}
        onPress={() => router.push("/AgregarPaquete")}
      >
        <Text style={styles.textoBoton}>AGREGAR PAQUETE</Text>
      </TouchableOpacity>

      {aviso && (
        <View style={styles.aviso}>
          <Text style={styles.avisoTexto}>{aviso}</Text>
        </View>
      )}

      <View style={styles.seccionPaquetes}>
        {paquetes.map((paquete) => (
          <View key={paquete.id} style={styles.paqueteItem}>
            <Text style={styles.tituloPaquete}>{paquete.nombre}</Text>
            <Text style={styles.detallePaquete}>
              HORAS: {paquete.horas} · PERIODO: {paquete.periodo}
            </Text>
            <View style={styles.filaAcciones}>
              <BotonEliminar onConfirmar={() => borrarPaquete(paquete)} disabled={guardando} />
            </View>
          </View>
        ))}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    width: "100%",
    maxWidth: 430,
    alignSelf: "center",
    paddingHorizontal: 18,
    paddingTop: 28,
    paddingBottom: 24,
    backgroundColor: "#f5f1e8",
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 18,
  },
  titulo: {
    fontSize: 26,
    fontWeight: "900",
    color: "#111111",
    letterSpacing: 0.8,
  },
  pill: {
    backgroundColor: "#ffde59",
    borderWidth: 2,
    borderColor: "#111111",
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  pillText: {
    color: "#111111",
    fontSize: 11,
    fontWeight: "900",
    letterSpacing: 1.4,
  },
  aviso: {
    borderWidth: 2,
    borderColor: "#111111",
    backgroundColor: "#ffde59",
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  avisoTexto: {
    color: "#111111",
    fontSize: 13,
    fontWeight: "700",
  },
  filaAcciones: {
    flexDirection: "row",
    justifyContent: "flex-end",
    marginTop: 12,
  },
  seccionPaquetes: {
    marginTop: 18,
  },
  paqueteItem: {
    borderWidth: 2,
    borderColor: "#111111",
    backgroundColor: "#ffffff",
    paddingHorizontal: 12,
    paddingVertical: 14,
    marginBottom: 12,
    shadowColor: "#000000",
    shadowOffset: { width: 4, height: 4 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 5,
  },
  tituloPaquete: {
    fontSize: 18,
    fontWeight: "900",
    color: "#111111",
    textTransform: "uppercase",
  },
  detallePaquete: {
    marginTop: 6,
    fontSize: 13,
    fontWeight: "700",
    color: "#333333",
    letterSpacing: 0.4,
  },
  botonAgregar: {
    backgroundColor: "#111111",
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 2,
    borderColor: "#111111",
    paddingVertical: 15,
    marginBottom: 18,
    transform: [{ skewX: "-8deg" }],
  },
  textoBoton: {
    color: "#f5f1e8",
    fontSize: 14,
    fontWeight: "900",
    letterSpacing: 1.2,
    transform: [{ skewX: "8deg" }],
  },
});

export default MisPaquetes;