// src/app/(tabs)/mis-empresas.tsx — Mis Empresas
// Lista de empresas con su paquete, progreso de horas, switch de prioridad
// alta y botón de eliminar. Las reglas viven en sistema/; la pantalla solo
// lee, llama y guarda.
import React, { useState, useCallback } from "react";
import { View, Text, StyleSheet, Switch } from "react-native";
import { useRouter, useFocusEffect } from "expo-router";
import {
  obtenerEmpresas,
  obtenerPaquetes,
  obtenerBloques,
  obtenerJornada,
  guardarEmpresasYBloques,
} from "../../storage/index";
import { aplicarActivacionAlta, aplicarDesactivacionAlta } from "../../sistema/prioridad";
import {
  JORNADA_POR_DEFECTO,
  calcularHorasConsumidas,
  fechaLocalISO,
  finDeVentana,
  sumarDias,
} from "../../sistema/cronograma";
import { eliminarEmpresa } from "../../sistema/eliminacion";
import { BotonEliminar } from "../../components/boton-eliminar";
import {
  Pantalla,
  Tarjeta,
  Etiqueta,
  Aviso,
  Vacio,
  BotonIcono,
  colores,
  colorDeEmpresa,
  espacio,
  fuentes,
  borde,
  tipo,
} from "../../components/kit";
import { fechaLarga, textoHoras } from "../../components/formato";
import { BloqueHorario, Empresa, Paquete } from "../../type";

/**
 * Pantalla Mis Empresas: se recarga cada vez que se entra a la pestaña.
 * El botón + de arriba abre Agregar Empresa.
 */
const MisEmpresas = () => {
  const router = useRouter();
  const [empresas, setEmpresas] = useState<Empresa[]>([]);
  const [paquetes, setPaquetes] = useState<Paquete[]>([]);
  const [bloques, setBloques] = useState<BloqueHorario[]>([]);

  // Mientras se guarda un cambio bloqueo TODOS los switches: prender o apagar
  // uno puede mover bloques de otras empresas, así que no quiero dos cálculos a la vez
  const [guardando, setGuardando] = useState(false);
  // mensaje para el usuario después de cambiar un switch (null = no mostrar nada)
  const [aviso, setAviso] = useState<string | null>(null);

  // recargo al entrar a la pestaña (por ej. al volver de Agregar Empresa)
  useFocusEffect(
    useCallback(() => {
      // .then(([e, p, b]) => ...) = cuando lleguen las tres listas, guardarlas en el state
      Promise.all([obtenerEmpresas(), obtenerPaquetes(), obtenerBloques()]).then(([e, p, b]) => {
        setEmpresas(e);
        setPaquetes(p);
        setBloques(b);
      });
    }, [])
  );

  /** Prende o apaga la prioridad alta de una empresa y guarda el cronograma resultante. */
  const cambiarPrioridad = async (empresa: Empresa, prendido: boolean) => {
    setGuardando(true);
    setAviso(null);
    try {
      // leo todo fresco del storage (no confío en el state, puede estar viejo)
      // Promise.all espera las 4 lecturas en paralelo, como Task.WhenAll en C#
      const [empresasGuardadas, paquetesGuardados, bloquesGuardados, jornadaGuardada] = await Promise.all([
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
        const resultado = aplicarActivacionAlta(actual, empresasGuardadas, paquetesGuardados, jornada, bloquesGuardados, ahora);
        await guardarEmpresasYBloques(resultado.empresas, resultado.bloques);
        setEmpresas(resultado.empresas);
        setBloques(resultado.bloques);
        if (resultado.bloquesPerdidos.length > 0) {
          setAviso(
            `${resultado.bloquesPerdidos.length} sesión(es) de otras empresas no entraron en su ventana y se quitaron del cronograma.`
          );
        }
      } else {
        const resultado = aplicarDesactivacionAlta(actual, empresasGuardadas, paquetesGuardados, jornada, bloquesGuardados, ahora);
        await guardarEmpresasYBloques(resultado.empresas, resultado.bloques);
        setEmpresas(resultado.empresas);
        setBloques(resultado.bloques);
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

  /** Borra la empresa y todos sus bloques (libera su espacio en el cronograma). */
  const borrarEmpresa = async (empresa: Empresa) => {
    setGuardando(true);
    setAviso(null);
    try {
      const [empresasGuardadas, bloquesGuardados] = await Promise.all([obtenerEmpresas(), obtenerBloques()]);
      // el sistema saca la empresa y todos sus bloques (libera su espacio)
      const resultado = eliminarEmpresa(empresa.id, empresasGuardadas, bloquesGuardados);
      await guardarEmpresasYBloques(resultado.empresas, resultado.bloques);
      setEmpresas(resultado.empresas);
      setBloques(resultado.bloques);
    } catch {
      setAviso("No se pudo eliminar la empresa.");
    } finally {
      setGuardando(false);
    }
  };

  const hoy = fechaLocalISO(new Date());

  return (
    <Pantalla
      antetitulo={`${empresas.length} ${empresas.length === 1 ? "empresa" : "empresas"}`}
      titulo="Empresas"
      accion={
        <BotonIcono
          icono={{ ios: "plus", android: "add", web: "add" }}
          etiquetaAccesible="Agregar empresa"
          variante="acento"
          onPress={() => router.push("/AgregarEmpresa")}
        />
      }
    >
      {aviso && <Aviso texto={aviso} />}

      {empresas.length === 0 && (
        <Vacio
          icono={{ ios: "building.2", android: "business", web: "business" }}
          titulo="Todavía no hay empresas"
          detalle="Tocá + para agregar la primera. Antes necesitás tener al menos un paquete."
        />
      )}

      {/* map con { } y return: se pueden calcular cosas antes de devolver lo que se dibuja */}
      {empresas.map((empresa) => {
        const paquete = paquetes.find((p) => p.id === empresa.paqueteId);
        const consumidas = calcularHorasConsumidas(empresa, bloques, hoy); // solo la ventana actual
        const total = paquete?.horas ?? 0;
        // progreso entre 0 y 1 (Math.min por si se pasó del total)
        const progreso = total > 0 ? Math.min(1, consumidas / total) : 0; // entre 0 y 1 (0.5 = mitad)
        const enAlta = empresa.prioridad === "alta";

        return (
          <Tarjeta key={empresa.id} style={styles.tarjeta} estiloInterno={styles.tarjetaInterna}>
            <View style={styles.cabecera}>
              <View style={[styles.color, { backgroundColor: colorDeEmpresa(empresa.id) }]} />
              <View style={styles.flex}>
                <Text style={styles.nombre} numberOfLines={1}>
                  {empresa.nombre}
                </Text>
                <Text style={tipo.secundario}>
                  {paquete ? `${paquete.nombre} · ${paquete.horas} h por ${paquete.periodo}` : "Paquete eliminado"}
                </Text>
              </View>
              {enAlta && <Etiqueta texto="Alta" />}
            </View>

            {/* progreso de horas consumidas */}
            <View style={styles.progresoFila}>
              <Text style={tipo.etiqueta}>
                {textoHoras(consumidas)} / {total} h
              </Text>
              {paquete && (
                <Text style={[tipo.etiqueta, styles.tenue]}>
                  SE RENUEVA EL {fechaLarga(sumarDias(finDeVentana(empresa, paquete), 1)).toUpperCase()}
                </Text>
              )}
            </View>
            <View style={styles.barra}>
              {/* el ancho en % es el progreso: `${n}%` arma el texto "45%" */}
              {progreso > 0 && <View style={[styles.barraRelleno, { width: `${progreso * 100}%` }]} />}
            </View>

            <View style={styles.separador} />

            <View style={styles.pie}>
              <View style={styles.switchFila}>
                {/* Switch = interruptor on/off; onValueChange recibe el valor nuevo (true/false) */}
                <Switch
                  value={enAlta}
                  onValueChange={(prendido) => cambiarPrioridad(empresa, prendido)}
                  disabled={guardando}
                  trackColor={{ false: colores.hundido, true: colores.tinta }}
                  thumbColor={enAlta ? colores.acento : colores.superficie}
                  ios_backgroundColor={colores.hundido}
                  accessibilityLabel={`Prioridad alta para ${empresa.nombre}`}
                />
                <Text style={styles.switchTexto}>Prioridad alta</Text>
              </View>
              <BotonEliminar onConfirmar={() => borrarEmpresa(empresa)} disabled={guardando} />
            </View>
          </Tarjeta>
        );
      })}
    </Pantalla>
  );
};

const styles = StyleSheet.create({
  flex: { flex: 1 },
  tenue: { color: colores.tintaTenue },
  tarjeta: {
    marginBottom: espacio.l,
  },
  tarjetaInterna: {
    padding: espacio.l,
  },
  cabecera: {
    flexDirection: "row",
    alignItems: "center",
    gap: espacio.m,
  },
  color: {
    width: 16,
    height: 40,
    borderRadius: 3,
    borderWidth: borde.ancho,
    borderColor: colores.tinta,
  },
  nombre: {
    fontFamily: fuentes.negrita,
    fontSize: 18,
    color: colores.tinta,
  },
  progresoFila: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: espacio.s,
    marginTop: espacio.l,
    marginBottom: 6,
  },
  barra: {
    height: 12,
    borderWidth: borde.ancho,
    borderColor: colores.tinta,
    borderRadius: 3,
    backgroundColor: colores.hundido,
    overflow: "hidden",
  },
  barraRelleno: {
    height: "100%",
    backgroundColor: colores.acento,
    borderRightWidth: borde.ancho,
    borderRightColor: colores.tinta,
  },
  separador: {
    height: 1.5,
    backgroundColor: colores.hundido,
    marginVertical: espacio.m,
  },
  pie: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    flexWrap: "wrap",
    gap: espacio.s,
  },
  switchFila: {
    flexDirection: "row",
    alignItems: "center",
    gap: espacio.s,
  },
  switchTexto: {
    fontFamily: fuentes.semi,
    fontSize: 14,
    color: colores.tinta,
  },
});

export default MisEmpresas;
