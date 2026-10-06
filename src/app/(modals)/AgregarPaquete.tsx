// src/app/(modals)/AgregarPaquete.tsx — modal para crear un paquete de horas
import React, { useState } from "react";
import { View, Text, StyleSheet } from "react-native";
import { guardarPaquete } from "../../storage/index";
import { tamanoBloqueMinutos, diasDeVentana, fechaLocalISO } from "../../sistema/cronograma";
import { textoHoras } from "../../components/formato";
import { Paquete } from "../../type";
import {
  Pantalla,
  Campo,
  Selector,
  Boton,
  BotonIcono,
  Tarjeta,
  cerrarPantalla,
  colores,
  espacio,
  tipo,
} from "../../components/kit";

/**
 * Modal Agregar Paquete: nombre, horas y período (semana o mes).
 * Muestra de qué tamaño van a ser las sesiones antes de guardar.
 */
const AgregarPaquete = () => {
  const [nombre, setNombre] = useState("");
  const [horas, setHoras] = useState("");
  const [periodo, setPeriodo] = useState<"semana" | "mes">("semana"); // solo puede valer "semana" o "mes"
  const [guardando, setGuardando] = useState(false);

  // lo que se escribe es texto: Number(...) lo pasa a número (como double.Parse, pero sin excepción)
  const horasNumero = Number(horas.replace(",", ".")); // acepta "10,5" además de "10.5"
  // isFinite = es un número de verdad (Number("hola") da NaN, que no lo es)
  const valido = nombre.trim() !== "" && Number.isFinite(horasNumero) && horasNumero > 0;

  /** Guarda el paquete nuevo y cierra el modal. */
  const guardar = async () => {
    if (!valido) return;
    setGuardando(true);
    try {
      const nuevoPaquete: Paquete = {
        id: Date.now().toString(),
        nombre: nombre.trim(),
        horas: horasNumero,
        periodo,
      };
      await guardarPaquete(nuevoPaquete);
      cerrarPantalla("/mis-paquetes");
    } finally {
      setGuardando(false);
    }
  };

  return (
    <Pantalla
      antetitulo="Nuevo"
      titulo="Paquete"
      conTabs={false}
      accion={
        <BotonIcono
          icono={{ ios: "xmark", android: "close", web: "close" }}
          etiquetaAccesible="Cerrar"
          onPress={() => cerrarPantalla("/mis-paquetes")}
        />
      }
    >
      <Campo etiqueta="Nombre" placeholder="Ej. Soporte mensual" value={nombre} onChangeText={setNombre} />
      <Campo
        etiqueta="Horas"
        placeholder="Ej. 20"
        value={horas}
        onChangeText={setHoras}
        keyboardType="numeric"
      />

      <Text style={[tipo.etiqueta, styles.etiqueta]}>PERÍODO</Text>
      <Selector<"semana" | "mes">
        opciones={[
          { valor: "semana", texto: "SEMANA" },
          { valor: "mes", texto: "MES" },
        ]}
        valor={periodo}
        onCambiar={setPeriodo}
      />

      {/* vista previa: cómo se va a repartir */}
      {valido && (
        <Tarjeta fondo={colores.hundido} conSombra={false} style={styles.previa} estiloInterno={styles.previaInterna}>
          <Text style={tipo.cuerpo}>
            Sesiones de {periodo === "mes" ? "≈" : ""}
            {textoHoras(tamanoBloqueMinutos({ id: "", nombre, horas: horasNumero, periodo }, fechaLocalISO(new Date())) / 60)}
            , una por día hábil (lunes a viernes) en los {diasDeVentana(periodo)} días de cada ventana. Se
            renueva sola al terminar.
          </Text>
        </Tarjeta>
      )}

      <View style={styles.botones}>
        <Boton texto="Guardar paquete" onPress={guardar} disabled={!valido || guardando} />
        <Boton texto="Cancelar" variante="secundario" onPress={() => cerrarPantalla("/mis-paquetes")} />
      </View>
    </Pantalla>
  );
};

const styles = StyleSheet.create({
  etiqueta: {
    marginBottom: 6,
  },
  previa: {
    marginTop: espacio.l,
  },
  previaInterna: {
    padding: espacio.m,
  },
  botones: {
    gap: espacio.m,
    marginTop: espacio.xl,
  },
});

export default AgregarPaquete;
