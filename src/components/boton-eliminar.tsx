// components/boton-eliminar.tsx
// Botón de eliminar con confirmación en dos pasos: el primer toque pide
// confirmar y el segundo borra. Lo hago así en vez de usar Alert porque
// Alert no muestra botones en la versión web.
import React, { useState } from "react";
import { View, Text, StyleSheet, TouchableOpacity } from "react-native";

interface BotonEliminarProps {
  onConfirmar: () => void;
  disabled?: boolean; // el "?" significa que la prop es opcional
}

export function BotonEliminar({ onConfirmar, disabled = false }: BotonEliminarProps) {
  const [confirmando, setConfirmando] = useState(false);

  if (!confirmando) {
    return (
      <TouchableOpacity
        style={[styles.boton, styles.botonEliminar, disabled && styles.deshabilitado]}
        onPress={() => setConfirmando(true)}
        disabled={disabled}
        accessibilityRole="button"
      >
        <Text style={styles.textoClaro}>ELIMINAR</Text>
      </TouchableOpacity>
    );
  }

  return (
    <View style={styles.fila}>
      <TouchableOpacity
        style={[styles.boton, styles.botonEliminar, disabled && styles.deshabilitado]}
        onPress={() => {
          setConfirmando(false);
          onConfirmar();
        }}
        disabled={disabled}
        accessibilityRole="button"
      >
        <Text style={styles.textoClaro}>¿SEGURO? SÍ</Text>
      </TouchableOpacity>
      <TouchableOpacity
        style={[styles.boton, styles.botonCancelar]}
        onPress={() => setConfirmando(false)}
        accessibilityRole="button"
      >
        <Text style={styles.textoOscuro}>NO</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  fila: {
    flexDirection: "row",
    gap: 8,
  },
  boton: {
    borderWidth: 2,
    borderColor: "#111111",
    paddingHorizontal: 12,
    paddingVertical: 8,
    alignItems: "center",
  },
  botonEliminar: {
    backgroundColor: "#b00020",
  },
  botonCancelar: {
    backgroundColor: "#ffffff",
  },
  deshabilitado: {
    opacity: 0.45,
  },
  textoClaro: {
    color: "#ffffff",
    fontSize: 12,
    fontWeight: "900",
    letterSpacing: 1,
  },
  textoOscuro: {
    color: "#111111",
    fontSize: 12,
    fontWeight: "900",
    letterSpacing: 1,
  },
});
