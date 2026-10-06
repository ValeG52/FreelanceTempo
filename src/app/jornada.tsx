// src/app/jornada.tsx — Jornada laboral
// Acá el usuario elige su horario de trabajo: FIJO (el mismo todos los días)
// o VARIABLE (un horario por día, con días libres). Las reglas (validar,
// convertir, acomodar el cronograma) viven en sistema/; la pantalla solo
// muestra y guarda. Se abre desde el botón de ajustes de la pantalla Hoy.
import React, { useState, useEffect } from "react";
import { View, Text, StyleSheet, Pressable, Switch } from "react-native";
import {
  obtenerJornada,
  obtenerEmpresas,
  obtenerPaquetes,
  obtenerBloques,
  guardarJornadaYBloques,
} from "../storage/index";
import { JORNADA_POR_DEFECTO, ajustarCronogramaAJornada, fechaLocalISO } from "../sistema/cronograma";
import {
  DIAS_ORDENADOS,
  NOMBRES_DIAS,
  PASO_MINUTOS,
  JornadaEditable,
  DiaEditable,
  jornadaAEditable,
  editableAJornada,
  moverHora,
  validarJornada,
} from "../sistema/jornada";
import { DiaSemana, RangoHorario } from "../type";
import {
  Pantalla,
  Selector,
  Tarjeta,
  Boton,
  BotonIcono,
  Aviso,
  Icono,
  cerrarPantalla,
  colores,
  espacio,
  fuentes,
  borde,
  tipo,
} from "../components/kit";

/**
 * Control para elegir una hora: muestra la hora con un botón − a la
 * izquierda y uno + a la derecha, que la mueven de a PASO_MINUTOS.
 * @param etiqueta texto de arriba ("INICIO" / "FIN")
 * @param hora hora actual, "HH:MM"
 * @param onCambiar se llama con la hora nueva cada vez que se toca − o +
 */
const SelectorHora = ({
  etiqueta,
  hora,
  onCambiar,
}: {
  etiqueta: string;
  hora: string;
  onCambiar: (nuevaHora: string) => void;
}) => (
  // "=> ( ... )" con paréntesis = devuelve directamente este JSX, sin escribir return
  <View style={styles.selectorHora}>
    <Text style={[tipo.etiqueta, styles.selectorEtiqueta]}>{etiqueta}</Text>
    <View style={styles.selectorFila}>
      <Pressable
        style={({ pressed }) => [styles.selectorBoton, pressed && styles.selectorBotonApretado]}
        onPress={() => onCambiar(moverHora(hora, -PASO_MINUTOS))}
        accessibilityRole="button"
        accessibilityLabel={`${etiqueta} 30 minutos antes`}
      >
        <Icono nombre={{ ios: "minus", android: "remove", web: "remove" }} color={colores.textoSobreTinta} tamano={16} />
      </Pressable>
      <Text style={styles.selectorTextoHora}>{hora}</Text>
      <Pressable
        style={({ pressed }) => [styles.selectorBoton, pressed && styles.selectorBotonApretado]}
        onPress={() => onCambiar(moverHora(hora, PASO_MINUTOS))}
        accessibilityRole="button"
        accessibilityLabel={`${etiqueta} 30 minutos después`}
      >
        <Icono nombre={{ ios: "plus", android: "add", web: "add" }} color={colores.textoSobreTinta} tamano={16} />
      </Pressable>
    </View>
  </View>
);

/**
 * Pantalla de jornada laboral: carga la jornada guardada (o la de por
 * defecto, 09:00 a 18:00), deja editarla y al tocar GUARDAR la guarda junto
 * con el cronograma acomodado a ella.
 */
const Jornada = () => {
  // null mientras se lee del storage
  const [editable, setEditable] = useState<JornadaEditable | null>(null);
  const [guardando, setGuardando] = useState(false);
  // mensaje para el usuario (null = no mostrar nada)
  const [aviso, setAviso] = useState<string | null>(null);

  useEffect(() => {
    obtenerJornada().then((guardada) => setEditable(jornadaAEditable(guardada ?? JORNADA_POR_DEFECTO)));
  }, []);

  // mientras carga, dibujo una pantalla vacía (de acá para abajo, editable ya tiene valor)
  if (!editable) return <View style={styles.cargando} />;

  // Los cambios de state siempre crean objetos nuevos ("{ ...x, campo }"),
  // nunca se modifica el objeto que ya está: así React se da cuenta del cambio.

  /** Cambia entre FIJA y VARIABLE. */
  const cambiarTipo = (tipoJornada: "fija" | "variable") => {
    setEditable({ ...editable, tipo: tipoJornada });
    setAviso(null);
  };

  /** Cambia la hora de inicio o de fin del horario fijo. */
  // keyof RangoHorario = el nombre de un campo: "horaInicio" o "horaFin"
  const cambiarHorarioFijo = (campo: keyof RangoHorario, hora: string) => {
    // [campo]: hora = usar el VALOR de la variable campo como nombre del campo
    setEditable({ ...editable, horarioFijo: { ...editable.horarioFijo, [campo]: hora } });
    setAviso(null);
  };

  /** Cambia algo de un día puntual (si trabaja, o su horario). */
  // Partial<DiaEditable> = un DiaEditable donde todos los campos son opcionales
  const cambiarDia = (dia: DiaSemana, cambios: Partial<DiaEditable>) => {
    setEditable({ ...editable, dias: { ...editable.dias, [dia]: { ...editable.dias[dia], ...cambios } } });
    setAviso(null);
  };

  /**
   * Valida la jornada, acomoda el cronograma para que todas las sesiones
   * queden dentro de ella y, si todo entra, guarda las dos cosas juntas y
   * cierra la pantalla. Si alguna sesión no entra, no guarda nada y avisa.
   */
  const guardar = async () => {
    const jornada = editableAJornada(editable);
    const error = validarJornada(jornada);
    if (error) {
      setAviso(error);
      return;
    }

    setGuardando(true);
    try {
      // leo todo fresco del storage (Promise.all = Task.WhenAll en C#)
      const [empresas, paquetes, bloques] = await Promise.all([
        obtenerEmpresas(),
        obtenerPaquetes(),
        obtenerBloques(),
      ]);

      // la regla vive en sistema/: mueve las sesiones que quedan fuera de la jornada nueva
      const ajuste = ajustarCronogramaAJornada(jornada, empresas, paquetes, bloques, fechaLocalISO(new Date()));
      if (!ajuste.exito) {
        const nombres = ajuste.empresasSinLugar.map((e) => e.nombre).join(", ");
        setAviso(
          `No hay cupos: con este horario no entran las sesiones de ${nombres}. No se guardó la jornada.`
        );
        return; // el finally igual se ejecuta y apaga "guardando"
      }

      await guardarJornadaYBloques(jornada, ajuste.bloques);
      cerrarPantalla("/");
    } catch {
      setAviso("No se pudo guardar la jornada.");
    } finally {
      setGuardando(false);
    }
  };

  return (
    <Pantalla
      antetitulo="Ajustes"
      titulo="Jornada laboral"
      conTabs={false}
      accion={
        <BotonIcono
          icono={{ ios: "xmark", android: "close", web: "close" }}
          etiquetaAccesible="Cerrar"
          onPress={() => cerrarPantalla("/")}
        />
      }
    >
      <Text style={[tipo.secundario, styles.nota]}>
        Al guardar, las sesiones de mañana en adelante que queden fuera de este horario se mueven a
        otro día, dentro de la ventana de su empresa.
      </Text>

      <Selector<"fija" | "variable">
        opciones={[
          { valor: "fija", texto: "FIJA" },
          { valor: "variable", texto: "VARIABLE" },
        ]}
        valor={editable.tipo}
        onCambiar={cambiarTipo}
      />
      <View style={styles.espacio} />

      {editable.tipo === "fija" ? (
        <Tarjeta style={styles.tarjeta} estiloInterno={styles.tarjetaInterna}>
          <Text style={tipo.seccion}>Lunes a viernes</Text>
          <View style={styles.filaSelectores}>
            <SelectorHora
              etiqueta="INICIO"
              hora={editable.horarioFijo.horaInicio}
              onCambiar={(hora) => cambiarHorarioFijo("horaInicio", hora)}
            />
            <SelectorHora
              etiqueta="FIN"
              hora={editable.horarioFijo.horaFin}
              onCambiar={(hora) => cambiarHorarioFijo("horaFin", hora)}
            />
          </View>
        </Tarjeta>
      ) : (
        DIAS_ORDENADOS.map((dia) => {
          const { trabaja, rango } = editable.dias[dia];
          return (
            <Tarjeta
              key={dia}
              style={styles.tarjeta}
              estiloInterno={styles.tarjetaInterna}
              fondo={trabaja ? colores.superficie : colores.hundido}
              conSombra={trabaja}
            >
              <View style={styles.filaDia}>
                <Text style={tipo.seccion}>{NOMBRES_DIAS[dia]}</Text>
                <View style={styles.filaSwitch}>
                  <Text style={[tipo.etiqueta, !trabaja && styles.tenue]}>{trabaja ? "TRABAJO" : "LIBRE"}</Text>
                  <Switch
                    value={trabaja}
                    onValueChange={(valor) => cambiarDia(dia, { trabaja: valor })}
                    trackColor={{ false: colores.tintaTenue, true: colores.tinta }}
                    thumbColor={trabaja ? colores.acento : colores.superficie}
                    ios_backgroundColor={colores.tintaTenue}
                    accessibilityLabel={`Trabajo el ${NOMBRES_DIAS[dia]}`}
                  />
                </View>
              </View>
              {trabaja && (
                <View style={styles.filaSelectores}>
                  <SelectorHora
                    etiqueta="INICIO"
                    hora={rango.horaInicio}
                    onCambiar={(hora) => cambiarDia(dia, { rango: { ...rango, horaInicio: hora } })}
                  />
                  <SelectorHora
                    etiqueta="FIN"
                    hora={rango.horaFin}
                    onCambiar={(hora) => cambiarDia(dia, { rango: { ...rango, horaFin: hora } })}
                  />
                </View>
              )}
            </Tarjeta>
          );
        })
      )}

      {aviso && <Aviso texto={aviso} tipoAviso="error" />}

      <View style={styles.botones}>
        <Boton texto={guardando ? "Guardando..." : "Guardar jornada"} onPress={guardar} disabled={guardando} />
        <Boton texto="Cancelar" variante="secundario" onPress={() => cerrarPantalla("/")} disabled={guardando} />
      </View>
    </Pantalla>
  );
};

const styles = StyleSheet.create({
  cargando: {
    flex: 1,
    backgroundColor: colores.fondo,
  },
  nota: {
    marginBottom: espacio.l,
  },
  espacio: {
    height: espacio.l,
  },
  tenue: {
    color: colores.tintaSuave,
  },
  tarjeta: {
    marginBottom: espacio.m,
  },
  tarjetaInterna: {
    padding: espacio.l,
  },
  filaDia: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  filaSwitch: {
    flexDirection: "row",
    alignItems: "center",
    gap: espacio.s,
  },
  filaSelectores: {
    flexDirection: "row",
    gap: espacio.m,
    marginTop: espacio.m,
  },
  selectorHora: {
    flex: 1,
  },
  selectorEtiqueta: {
    color: colores.tintaSuave,
    marginBottom: 6,
  },
  selectorFila: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: borde.ancho,
    borderColor: colores.tinta,
    borderRadius: borde.radio,
    overflow: "hidden",
    backgroundColor: colores.fondo,
  },
  selectorBoton: {
    width: 40,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colores.tinta,
  },
  selectorBotonApretado: {
    backgroundColor: colores.tintaSuave,
  },
  selectorTextoHora: {
    flex: 1,
    textAlign: "center",
    fontFamily: fuentes.monoNegrita,
    fontSize: 16,
    color: colores.tinta,
  },
  botones: {
    gap: espacio.m,
    marginTop: espacio.l,
  },
});

export default Jornada;
