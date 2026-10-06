// components/boton-eliminar.tsx
// Botón de eliminar con confirmación en dos pasos: el primer toque pide
// confirmar y el segundo borra. Lo hago así en vez de usar Alert porque
// Alert no muestra botones en la versión web.
import React, { useState } from "react";
import { View, StyleSheet } from "react-native";
import { Boton, espacio } from "./kit";

interface BotonEliminarProps {
  onConfirmar: () => void;
  disabled?: boolean; // el "?" significa que la prop es opcional
}

/**
 * Muestra "Eliminar"; al tocarlo cambia a "¿Seguro? Sí" / "No".
 * Recién con "Sí" llama a onConfirmar.
 */
export function BotonEliminar({ onConfirmar, disabled = false }: BotonEliminarProps) {
  const [confirmando, setConfirmando] = useState(false); // ¿ya tocó "Eliminar" una vez?

  // un componente puede devolver cosas distintas según el state
  if (!confirmando) {
    return (
      <Boton
        texto="Eliminar"
        variante="secundario"
        chico
        icono={{ ios: "trash", android: "delete", web: "delete" }}
        onPress={() => setConfirmando(true)}
        disabled={disabled}
      />
    );
  }

  return (
    <View style={styles.fila}>
      <Boton
        texto="¿Seguro? Sí"
        variante="peligro"
        chico
        onPress={() => {
          setConfirmando(false);
          onConfirmar();
        }}
        disabled={disabled}
      />
      <Boton texto="No" variante="secundario" chico onPress={() => setConfirmando(false)} />
    </View>
  );
}

const styles = StyleSheet.create({
  fila: {
    flexDirection: "row",
    gap: espacio.s,
  },
});
