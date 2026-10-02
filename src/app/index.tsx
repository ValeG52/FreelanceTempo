// src/app/Inicio.tsx
import React, { useState } from "react";
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from "react-native";
import { useRouter } from "expo-router";



const HomeScreen = () => {
  const router = useRouter();
  const [menuAbierto, setMenuAbierto] = useState(false);

  const fechaActual = new Date();
  const fechaFormateada = fechaActual.toLocaleDateString("es-AR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });

  const opciones = [
    { label: "Agregar Paquete", onPress: () => router.push("/AgregarPaquete") },
    { label: "Agregar Empresa", onPress: () => router.push("/AgregarEmpresa") },
    { label: "Mis Empresas", onPress: () => router.push("/mis-empresas") },
    { label: "Mis Paquetes", onPress: () => router.push("/mis-paquetes") },
  ];

  const horas = Array.from({ length: 14 }, (_, index) => 9 + index);

  return (
    <View style={styles.container}>
      <View style={styles.topBar}>
        <View style={styles.headerTextWrap}>
          <Text style={styles.title}>CRONOGRAMA</Text>
          <Text style={styles.dateText}>{fechaFormateada}</Text>
        </View>

        <View style={styles.menuWrapper}>
          <TouchableOpacity
            style={styles.menuButton}
            onPress={() => setMenuAbierto((prev) => !prev)}
            activeOpacity={0.8}
          >
            <Text style={styles.menuButtonText}>MENU</Text>
          </TouchableOpacity>

          {menuAbierto && (
            <View style={styles.menuDropdown}>
              {opciones.map((opcion) => (
                <TouchableOpacity
                  key={opcion.label}
                  style={styles.menuItem}
                  onPress={() => {
                    setMenuAbierto(false);
                    opcion.onPress();
                  }}
                >
                  <Text style={styles.menuItemText}>{opcion.label}</Text>
                </TouchableOpacity>
              ))}
            </View>
          )}
        </View>
      </View>

      <ScrollView
        style={styles.scheduleContainer}
        contentContainerStyle={styles.scheduleContent}
        showsVerticalScrollIndicator={false}
      >
        {horas.map((hora) => (
          <View key={hora} style={styles.hourRow}>
            <Text style={styles.hourText}>{hora}:00</Text>
            <View style={styles.slot} />
          </View>
        ))}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f5f1e8",
    paddingHorizontal: 18,
    paddingTop: 28,
    paddingBottom: 24,
  },
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 20,
    minHeight: 52,
  },
  headerTextWrap: {
    flex: 1,
    justifyContent: "center",
    paddingRight: 8,
  },
  title: {
    color: "#111111",
    fontSize: 26,
    fontWeight: "900",
    letterSpacing: 0.8,
  },
  dateText: {
    color: "#4d4d4d",
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 1,
    textTransform: "uppercase",
    marginTop: 2,
  },
  menuWrapper: {
    width: 120,
    position: "relative",
    zIndex: 10,
    alignItems: "flex-end",
  },
  menuButton: {
    backgroundColor: "#111111",
    borderWidth: 2,
    borderColor: "#111111",
    borderRadius: 0,
    paddingVertical: 12,
    paddingHorizontal: 14,
    alignItems: "center",
    transform: [{ skewX: "-8deg" }],
    shadowColor: "#000000",
    shadowOffset: { width: 4, height: 4 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 6,
  },
  menuButtonText: {
    color: "#f5f1e8",
    fontSize: 14,
    fontWeight: "900",
    letterSpacing: 1.5,
    transform: [{ skewX: "8deg" }],
  },
  menuDropdown: {
    position: "absolute",
    top: 52,
    right: 0,
    width: 210,
    backgroundColor: "#f5f1e8",
    borderWidth: 2,
    borderColor: "#111111",
    overflow: "hidden",
    shadowColor: "#000000",
    shadowOffset: { width: 5, height: 5 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 8,
    zIndex: 20,
  },
  menuItem: {
    paddingVertical: 14,
    paddingHorizontal: 14,
    borderBottomWidth: 2,
    borderBottomColor: "#111111",
    backgroundColor: "#f5f1e8",
  },
  menuItemText: {
    color: "#111111",
    fontSize: 14,
    fontWeight: "700",
    letterSpacing: 0.5,
  },
  scheduleContainer: {
    flex: 1,
    marginTop: 8,
  },
  scheduleContent: {
    paddingBottom: 20,
  },
  titleRow: {
    display: "none",
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
    textTransform: "uppercase",
  },
  hourRow: {
    flexDirection: "row",
    alignItems: "center",
    borderBottomWidth: 2,
    borderBottomColor: "#111111",
    paddingVertical: 10,
    backgroundColor: "#f5f1e8",
  },
  hourText: {
    width: 62,
    color: "#111111",
    fontSize: 16,
    fontWeight: "900",
  },
  slot: {
    flex: 1,
    minHeight: 34,
    justifyContent: "center",
    borderLeftWidth: 2,
    borderLeftColor: "#111111",
    paddingLeft: 12,
    backgroundColor: "#ffffff",
  },
  slotText: {
    color: "#111111",
    fontSize: 14,
    fontWeight: "800",
    letterSpacing: 0.8,
    textTransform: "uppercase",
  },
});

export default HomeScreen;