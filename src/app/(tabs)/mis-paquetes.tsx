// src/app/(tabs)/mis-paquetes.tsx — Mis Paquetes
// Lista de paquetes de horas con el tamaño de sesión que les corresponde y
// cuántas empresas los usan. Solo se puede borrar un paquete que no usa nadie.
import React, { useState, useCallback } from "react";
import { View, Text, StyleSheet } from "react-native";
import { useRouter, useFocusEffect } from "expo-router";
import { obtenerPaquetes, obtenerEmpresas, guardarPaquetes } from "../../storage/index";
import { empresasQueUsanPaquete } from "../../sistema/eliminacion";
import { tamanoBloqueMinutos, fechaLocalISO } from "../../sistema/cronograma";
import { textoHoras } from "../../components/formato";
import { BotonEliminar } from "../../components/boton-eliminar";
import {
  Pantalla,
  Tarjeta,
  Etiqueta,
  Aviso,
  Vacio,
  BotonIcono,
  colores,
  espacio,
  fuentes,
  tipo,
} from "../../components/kit";
import { Empresa, Paquete } from "../../type";

/**
 * Pantalla Mis Paquetes: se recarga cada vez que se entra a la pestaña.
 * El botón + de arriba abre Agregar Paquete.
 */
const MisPaquetes = () => {
  const router = useRouter();
  const [paquetes, setPaquetes] = useState<Paquete[]>([]);
  const [empresas, setEmpresas] = useState<Empresa[]>([]);
  const [guardando, setGuardando] = useState(false);
  // mensaje para el usuario (null = no mostrar nada)
  const [aviso, setAviso] = useState<string | null>(null);

  // recargo al entrar a la pestaña (por ej. al volver de Agregar Paquete)
  useFocusEffect(
    useCallback(() => {
      Promise.all([obtenerPaquetes(), obtenerEmpresas()]).then(([p, e]) => {
        setPaquetes(p);
        setEmpresas(e);
      });
    }, [])
  );

  /** Borra el paquete, salvo que alguna empresa lo esté usando (en ese caso avisa). */
  const borrarPaquete = async (paquete: Paquete) => {
    setGuardando(true);
    setAviso(null);
    try {
      const [paquetesGuardados, empresasGuardadas] = await Promise.all([obtenerPaquetes(), obtenerEmpresas()]);

      // regla: no se borra un paquete que alguna empresa está usando
      const queLoUsan = empresasQueUsanPaquete(paquete.id, empresasGuardadas);
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
    <Pantalla
      antetitulo={`${paquetes.length} ${paquetes.length === 1 ? "paquete" : "paquetes"}`}
      titulo="Paquetes"
      accion={
        <BotonIcono
          icono={{ ios: "plus", android: "add", web: "add" }}
          etiquetaAccesible="Agregar paquete"
          variante="acento"
          onPress={() => router.push("/AgregarPaquete")}
        />
      }
    >
      {aviso && <Aviso texto={aviso} />}

      {paquetes.length === 0 && (
        <Vacio
          icono={{ ios: "shippingbox", android: "inventory_2", web: "inventory_2" }}
          titulo="Todavía no hay paquetes"
          detalle="Un paquete es una cantidad de horas por semana o por mes. Tocá + para crear el primero."
        />
      )}

      {paquetes.map((paquete) => {
        const enUso = empresasQueUsanPaquete(paquete.id, empresas).length;
        // tamaño para una ventana que arrancara hoy (en los mensuales varía un poco
        // según cuántos días hábiles tenga la ventana: por eso el "≈")
        const minutosSesion = tamanoBloqueMinutos(paquete, fechaLocalISO(new Date()));
        const tamanoSesion = (paquete.periodo === "mes" ? "≈" : "") + textoHoras(minutosSesion / 60);

        return (
          <Tarjeta key={paquete.id} style={styles.tarjeta} estiloInterno={styles.tarjetaInterna}>
            <View style={styles.cabecera}>
              <Text style={styles.nombre} numberOfLines={1}>
                {paquete.nombre}
              </Text>
              <Etiqueta texto={paquete.periodo === "mes" ? "Mensual" : "Semanal"} fondo={colores.superficie} />
            </View>

            {/* tres datos en fila */}
            <View style={styles.datos}>
              <Dato valor={`${paquete.horas} h`} etiqueta={`por ${paquete.periodo}`} />
              <Dato valor={tamanoSesion} etiqueta="por sesión" />
              <Dato valor={String(enUso)} etiqueta={enUso === 1 ? "empresa" : "empresas"} />
            </View>

            <View style={styles.pie}>
              <BotonEliminar onConfirmar={() => borrarPaquete(paquete)} disabled={guardando} />
            </View>
          </Tarjeta>
        );
      })}
    </Pantalla>
  );
};

/** Un dato del paquete: número grande y etiqueta chica abajo. */
function Dato({ valor, etiqueta }: { valor: string; etiqueta: string }) {
  return (
    <View style={styles.dato}>
      <Text style={styles.datoValor}>{valor}</Text>
      <Text style={[tipo.etiqueta, styles.datoEtiqueta]}>{etiqueta.toUpperCase()}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  tarjeta: {
    marginBottom: espacio.l,
  },
  tarjetaInterna: {
    padding: espacio.l,
  },
  cabecera: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: espacio.m,
  },
  nombre: {
    flex: 1,
    fontFamily: fuentes.negrita,
    fontSize: 18,
    color: colores.tinta,
  },
  datos: {
    flexDirection: "row",
    marginTop: espacio.l,
    borderWidth: 1.5,
    borderColor: colores.hundido,
    borderRadius: 4,
  },
  dato: {
    flex: 1,
    paddingVertical: espacio.m,
    alignItems: "center",
  },
  datoValor: {
    fontFamily: fuentes.monoNegrita,
    fontSize: 18,
    color: colores.tinta,
  },
  datoEtiqueta: {
    fontSize: 10,
    color: colores.tintaSuave,
    marginTop: 2,
  },
  pie: {
    flexDirection: "row",
    justifyContent: "flex-end",
    marginTop: espacio.m,
  },
});

export default MisPaquetes;
