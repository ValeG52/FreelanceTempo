// src/app/mis-empresas.tsx
import React, { useState, useEffect } from "react";
import { View, Text, StyleSheet, TouchableOpacity, Switch } from "react-native";
import {
  obtenerEmpresas,
  obtenerPaquetes,
  obtenerBloques,
  obtenerJornada,
  guardarEmpresasYBloques,
} from "../storage/index";
import { aplicarActivacionAlta, aplicarDesactivacionAlta } from "../sistema/prioridad";
import { JORNADA_POR_DEFECTO } from "../sistema/cronograma";
import { eliminarEmpresa } from "../sistema/eliminacion";
import { BotonEliminar } from "../components/boton-eliminar";
import { Empresa } from "../type";
import { useRouter } from "expo-router";

const MisEmpresas = () => {
  const [empresas, setEmpresas] = useState<Empresa[]>([]);
  const router = useRouter();

  // Mientras se guarda un cambio bloqueo TODOS los switches: prender o apagar
  // uno puede mover bloques de otras empresas, así que no quiero dos cálculos a la vez
  const [guardando, setGuardando] = useState(false);
  // mensaje para el usuario después de cambiar un switch (null = no mostrar nada)
  const [aviso, setAviso] = useState<string | null>(null);

  useEffect(() => {
    obtenerEmpresas().then((data) => setEmpresas(data));
  }, []);

  const cambiarPrioridad = async (empresa: Empresa, prendido: boolean) => {
    setGuardando(true);
    setAviso(null);
    try {
      // leo todo fresco del storage (no confío en el state, puede estar viejo)
      // Promise.all espera las 4 lecturas en paralelo, como Task.WhenAll en C#
      const [empresasGuardadas, paquetes, bloques, jornadaGuardada] = await Promise.all([
        obtenerEmpresas(),
        obtenerPaquetes(),
        obtenerBloques(),
        obtenerJornada(),
      ]);
      const jornada = jornadaGuardada ?? JORNADA_POR_DEFECTO;
      // uso la versión guardada de la empresa, no la del state
      const actual = empresasGuardadas.find((e) => e.id === empresa.id) ?? empresa;
      const ahora = new Date();

      // la regla de negocio vive en sistema/: la pantalla solo decide cuál llamar
      if (prendido) {
        const resultado = aplicarActivacionAlta(actual, empresasGuardadas, paquetes, jornada, bloques, ahora);
        await guardarEmpresasYBloques(resultado.empresas, resultado.bloques);
        setEmpresas(resultado.empresas);
        if (resultado.bloquesPerdidos.length > 0) {
          setAviso(
            `${resultado.bloquesPerdidos.length} sesión(es) de otras empresas no entraron en su ventana y se quitaron del cronograma.`
          );
        }
      } else {
        const resultado = aplicarDesactivacionAlta(actual, empresasGuardadas, paquetes, jornada, bloques, ahora);
        await guardarEmpresasYBloques(resultado.empresas, resultado.bloques);
        setEmpresas(resultado.empresas);
        if (resultado.empresasSinCupo.length > 0) {
          const nombres = resultado.empresasSinCupo.map((e) => e.nombre).join(", ");
          setAviso(`No hay cupos para recalcular: ${nombres}. Quedaron con su horario anterior.`);
        }
      }
    } catch (error) {
      // "error" es de tipo unknown en TypeScript: chequeo que sea un Error antes de usar .message
      setAviso(error instanceof Error ? error.message : "No se pudo cambiar la prioridad.");
    } finally {
      setGuardando(false);
    }
  };

  const borrarEmpresa = async (empresa: Empresa) => {
    setGuardando(true);
    setAviso(null);
    try {
      const [empresasGuardadas, bloques] = await Promise.all([obtenerEmpresas(), obtenerBloques()]);
      // el sistema saca la empresa y todos sus bloques (libera su espacio)
      const resultado = eliminarEmpresa(empresa.id, empresasGuardadas, bloques);
      await guardarEmpresasYBloques(resultado.empresas, resultado.bloques);
      setEmpresas(resultado.empresas);
    } catch {
      setAviso("No se pudo eliminar la empresa.");
    } finally {
      setGuardando(false);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.headerRow}>
        <Text style={styles.titulo}>MIS EMPRESAS</Text>
        <View style={styles.pill}>
          <Text style={styles.pillText}>{empresas.length}</Text>
        </View>
      </View>

      <TouchableOpacity
        style={styles.botonAgregar}
        onPress={() => router.push("/AgregarEmpresa")}
      >
        <Text style={styles.textoBoton}>AGREGAR EMPRESA</Text>
      </TouchableOpacity>

      {aviso && (
        <View style={styles.aviso}>
          <Text style={styles.avisoTexto}>{aviso}</Text>
        </View>
      )}

      <View style={styles.seccionEmpresas}>
        {empresas.map((empresa) => (
          <View key={empresa.id} style={styles.empresaItem}>
            <Text style={styles.tituloEmpresa}>{empresa.nombre}</Text>
            <View style={styles.filaPrioridad}>
              <Text style={styles.detalleEmpresa}>
                PRIORIDAD: {empresa.prioridad.toUpperCase()}
              </Text>
              <Switch
                value={empresa.prioridad === "alta"}
                onValueChange={(prendido) => cambiarPrioridad(empresa, prendido)}
                disabled={guardando}
                trackColor={{ false: "#d9d4c7", true: "#111111" }}
                thumbColor={empresa.prioridad === "alta" ? "#ffde59" : "#ffffff"}
                ios_backgroundColor="#d9d4c7"
                accessibilityLabel={`Prioridad alta para ${empresa.nombre}`}
              />
            </View>
            <View style={styles.filaAcciones}>
              <BotonEliminar onConfirmar={() => borrarEmpresa(empresa)} disabled={guardando} />
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
  seccionEmpresas: {
    marginTop: 18,
  },
  empresaItem: {
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
  tituloEmpresa: {
    fontSize: 18,
    fontWeight: "900",
    color: "#111111",
    textTransform: "uppercase",
  },
  filaPrioridad: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 6,
  },
  filaAcciones: {
    flexDirection: "row",
    justifyContent: "flex-end",
    marginTop: 12,
  },
  detalleEmpresa: {
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

export default MisEmpresas;