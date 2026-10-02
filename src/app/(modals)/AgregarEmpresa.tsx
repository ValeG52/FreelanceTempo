// src/app/(modals)/AgregarEmpresa.tsx
import React from "react";
import { View, Text, StyleSheet, TextInput, TouchableOpacity } from "react-native";
import {
  obtenerPaquetes,
  obtenerEmpresas,
  obtenerBloques,
  obtenerJornada,
  guardarEmpresasYBloques,
} from "../../storage/index";
import { useState, useEffect } from "react";
import { Empresa, Paquete } from "../../type/index";
import { crearEmpresaConCronograma, fechaLocalISO, JORNADA_POR_DEFECTO } from "../../sistema/cronograma";
import { router } from "expo-router";

const AgregarEmpresa = ({ onClose }: { onClose: () => void }) => {
  const [nombre, setNombre] = useState("");
  const [paqueteId, setPaqueteId] = useState("");
  const [paquetes, setPaquetes] = useState<Paquete[]>([]);
  const [selectorAbierto, setSelectorAbierto] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    obtenerPaquetes().then((data) => setPaquetes(data));
  }, []);

  const GuardarEmpresa = async () => {
    const paquete = paquetes.find((p) => p.id === paqueteId);
    if (!paquete) return;
    setError(null);

    const nuevaEmpresa: Empresa = {
      id: Date.now().toString(),
      nombre,
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
      bloques
    );

    if (!resultado.exito) {
      // regla de negocio: si no entra todo, no se guarda nada (ni la empresa)
      setError("No hay cupos para este paquete en los próximos días.");
      return;
    }

    await guardarEmpresasYBloques([...empresas, nuevaEmpresa], resultado.bloques);
    if (onClose) onClose();
    router.replace("/mis-empresas");
  };

  return (
    <View style={styles.container}>
      <View style={styles.card}>
        <Text style={styles.titulo}>AGREGAR EMPRESA</Text>
        <TextInput
          style={styles.input}
          placeholder="Nombre"
          placeholderTextColor="#6b6b6b"
          value={nombre}
          onChangeText={setNombre}
        />
        <View style={styles.packageSelectWrap}>
          <TouchableOpacity
            style={styles.packageSelect}
            onPress={() => setSelectorAbierto(!selectorAbierto)}
            accessibilityRole="button"
            accessibilityLabel="Seleccionar paquete"
          >
            <Text style={paqueteId ? styles.packageSelectText : styles.packageSelectPlaceholder}>
              {paquetes.find((paquete) => paquete.id === paqueteId)?.nombre ?? "Selecciona un paquete"}
            </Text>
            <Text style={styles.packageSelectArrow}>{selectorAbierto ? "▲" : "▼"}</Text>
          </TouchableOpacity>
          {selectorAbierto && (
            <View style={styles.packageOptions}>
              {paquetes.length > 0 ? (
                paquetes.map((paquete) => (
                  <TouchableOpacity
                    key={paquete.id}
                    style={[
                      styles.packageOption,
                      paquete.id === paqueteId && styles.packageOptionActive,
                    ]}
                    onPress={() => {
                      setPaqueteId(paquete.id);
                      setSelectorAbierto(false);
                    }}
                  >
                    <Text style={styles.packageOptionText}>
                      {paquete.nombre} - {paquete.horas} h/{paquete.periodo}
                    </Text>
                  </TouchableOpacity>
                ))
              ) : (
                <Text style={styles.packageEmptyText}>No hay paquetes agregados</Text>
              )}
            </View>
          )}
        </View>
        {error && <Text style={styles.errorText}>{error}</Text>}
        <View style={styles.buttonGroup}>
          <TouchableOpacity
            style={[styles.primaryButton, !paqueteId && styles.primaryButtonDisabled]}
            onPress={GuardarEmpresa}
            disabled={!paqueteId}
          >
            <Text style={styles.primaryButtonText}>GUARDAR</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.secondaryButton} onPress={() => router.push("/")}>
            <Text style={styles.secondaryButtonText}>CERRAR</Text>
          </TouchableOpacity>
        </View>
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
    padding: 20,
    backgroundColor: "#f5f1e8",
    justifyContent: "center",
  },
  card: {
    width: "100%",
    backgroundColor: "#ffffff",
    borderWidth: 2,
    borderColor: "#111111",
    padding: 18,
    shadowColor: "#000000",
    shadowOffset: { width: 5, height: 5 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 8,
  },
  titulo: {
    fontSize: 24,
    fontWeight: "900",
    marginBottom: 20,
    color: "#111111",
    textAlign: "center",
    letterSpacing: 1,
  },
  input: {
    height: 46,
    borderWidth: 2,
    borderColor: "#111111",
    backgroundColor: "#f5f1e8",
    marginBottom: 12,
    paddingHorizontal: 12,
    color: "#111111",
    fontWeight: "700",
  },
  packageSelectWrap: {
    marginBottom: 12,
  },
  packageSelect: {
    minHeight: 46,
    borderWidth: 2,
    borderColor: "#111111",
    backgroundColor: "#f5f1e8",
    paddingHorizontal: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  packageSelectText: {
    color: "#111111",
    fontWeight: "700",
  },
  packageSelectPlaceholder: {
    color: "#6b6b6b",
    fontWeight: "700",
  },
  packageSelectArrow: {
    color: "#111111",
    fontSize: 12,
    fontWeight: "900",
    marginLeft: 8,
  },
  packageOptions: {
    borderWidth: 2,
    borderTopWidth: 0,
    borderColor: "#111111",
    backgroundColor: "#ffffff",
  },
  packageOption: {
    minHeight: 44,
    justifyContent: "center",
    paddingHorizontal: 12,
    borderTopWidth: 1,
    borderTopColor: "#111111",
  },
  packageOptionActive: {
    backgroundColor: "#ffde59",
  },
  packageOptionText: {
    color: "#111111",
    fontWeight: "700",
  },
  packageEmptyText: {
    color: "#6b6b6b",
    fontWeight: "700",
    padding: 12,
  },
  errorText: {
    color: "#b00020",
    fontWeight: "900",
    marginBottom: 8,
  },
  buttonGroup: {
    gap: 10,
    marginTop: 8,
  },
  primaryButton: {
    backgroundColor: "#111111",
    borderWidth: 2,
    borderColor: "#111111",
    paddingVertical: 12,
    alignItems: "center",
    shadowColor: "#000000",
    shadowOffset: { width: 4, height: 4 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 6,
  },
  primaryButtonDisabled: {
    opacity: 0.45,
  },
  primaryButtonText: {
    color: "#f5f1e8",
    fontSize: 14,
    fontWeight: "900",
    letterSpacing: 1.2,
  },
  secondaryButton: {
    backgroundColor: "#ffde59",
    borderWidth: 2,
    borderColor: "#111111",
    paddingVertical: 12,
    alignItems: "center",
    shadowColor: "#000000",
    shadowOffset: { width: 4, height: 4 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 6,
  },
  secondaryButtonText: {
    color: "#111111",
    fontSize: 14,
    fontWeight: "900",
    letterSpacing: 1.2,
  },
});

export default AgregarEmpresa;