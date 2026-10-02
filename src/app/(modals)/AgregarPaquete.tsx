// src/app/(modals)/AgregarPaquete.tsx
import React from "react";
import { View, Text, StyleSheet, TextInput, TouchableOpacity } from "react-native";
import { guardarPaquete } from "../../storage/index";
import { useState, useEffect } from "react";
import { router } from "expo-router/build/global-state/router";


const AgregarPaquete = ({ onClose }: { onClose: () => void }) => {
  const [nombre, setNombre] = useState("");
  const [horas, setHoras] = useState("");
  const [periodo, setPeriodo] = useState<"semana" | "mes">("semana");

  const GuardarPaquete = async () => {
    const nuevoPaquete = {
      id: Date.now().toString(),
      nombre,
      horas: Number(horas),
      periodo,
    };
    await guardarPaquete(nuevoPaquete);
    //onClose();
    router.replace("/mis-paquetes");
  };

  return (
    <View style={styles.container}>
      <View style={styles.card}>
        <Text style={styles.titulo}>AGREGAR PAQUETE</Text>
        <TextInput
          style={styles.input}
          placeholder="Nombre"
          placeholderTextColor="#6b6b6b"
          value={nombre}
          onChangeText={setNombre}
        />
        <TextInput
          style={styles.input}
          placeholder="Horas"
          placeholderTextColor="#6b6b6b"
          value={horas}
          onChangeText={setHoras}
          keyboardType="numeric"
        />

        <View style={styles.toggleWrap}>
          <TouchableOpacity
            style={[styles.toggleButton, periodo === "semana" && styles.toggleButtonActive]}
            onPress={() => setPeriodo("semana")}
          >
            <Text style={[styles.toggleText, periodo === "semana" && styles.toggleTextActive]}>
              SEMANA
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.toggleButton, periodo === "mes" && styles.toggleButtonActive]}
            onPress={() => setPeriodo("mes")}
          >
            <Text style={[styles.toggleText, periodo === "mes" && styles.toggleTextActive]}>
              MES
            </Text>
          </TouchableOpacity>
        </View>

        <View style={styles.buttonGroup}>
          <TouchableOpacity style={styles.primaryButton} onPress={GuardarPaquete}>
            <Text style={styles.primaryButtonText}>GUARDADO</Text>
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
  toggleWrap: {
    flexDirection: "row",
    marginBottom: 12,
    borderWidth: 2,
    borderColor: "#111111",
    backgroundColor: "#f5f1e8",
    overflow: "hidden",
  },
  toggleButton: {
    flex: 1,
    paddingVertical: 12,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#f5f1e8",
    borderRightWidth: 2,
    borderRightColor: "#111111",
  },
  toggleButtonActive: {
    backgroundColor: "#111111",
  },
  toggleText: {
    color: "#111111",
    fontSize: 12,
    fontWeight: "900",
    letterSpacing: 1.2,
  },
  toggleTextActive: {
    color: "#f5f1e8",
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

export default AgregarPaquete;