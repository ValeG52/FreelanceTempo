# Contexto del proyecto — FreelanceTempo

Resumen del trabajo hecho hasta ahora: cómo está organizado el código, qué
decisiones se tomaron, qué funciona y qué falta. Las reglas de negocio
completas están en `CLAUDE.md`; acá va lo que se implementó y por qué.

Última actualización: 2026-10-08.

---

## Estructura

```
src/
├── app/                        # pantallas (Expo Router)
│   ├── _layout.tsx             # raíz: carga fuentes, Stack con (tabs), modales y jornada
│   ├── (tabs)/                 # barra de pestañas de abajo
│   │   ├── _layout.tsx         # Hoy · Calendario · Empresas · Paquetes
│   │   ├── index.tsx           # Hoy: resumen y sesiones del día (+ chequeo diario)
│   │   ├── calendario.tsx      # vista semana / mes del cronograma completo
│   │   ├── mis-empresas.tsx    # lista + progreso + switch de prioridad alta + eliminar
│   │   └── mis-paquetes.tsx    # lista + eliminar
│   ├── ajustes.tsx             # ajustes (⚙ de Hoy): jornada laboral y respaldo
│   ├── jornada.tsx             # jornada laboral (se abre desde Ajustes)
│   └── (modals)/
│       ├── AgregarEmpresa.tsx  # crea la empresa y genera su cronograma
│       ├── AgregarPaquete.tsx
│       └── NotaSesion.tsx      # escribir la nota de una sesión (desde Hoy)
├── components/
│   ├── kit/                    # sistema de diseño "brutalista refinado"
│   │   ├── tema.ts             # colores, fuentes, espaciados, color por empresa
│   │   └── index.tsx           # Pantalla, Tarjeta, Boton, Etiqueta, Aviso, Selector, Campo...
│   ├── tarjeta-sesion.tsx      # tarjeta de una sesión (Hoy y Calendario)
│   ├── formato.ts              # fechas y duraciones en español
│   └── boton-eliminar.tsx      # botón con confirmación en dos toques
├── sistema/                    # lógica de negocio pura (sin React ni storage)
│   ├── cronograma.ts           # algoritmo: generación normal, x4, recálculo, agenda del día
│   ├── prioridad.ts            # prender/apagar el switch de prioridad alta, chequeo diario
│   ├── eliminacion.ts          # borrar empresas, validar borrado de paquetes
│   ├── jornada.ts              # validar y convertir la jornada laboral
│   ├── renovacion.ts           # renovar el paquete al terminar la ventana
│   ├── notas.ts                # poner / borrar la nota de una sesión
│   ├── respaldo.ts             # armar y validar el archivo de respaldo
│   └── calendario.ts           # fechas de semana/mes y agenda de varios días
├── storage/
│   └── index.ts                # AsyncStorage: paquetes, empresas, bloques, jornada
└── type/
    └── index.ts                # Paquete, Empresa, BloqueHorario, JornadaLaboral...
```

### Cómo se conectan las capas

`sistema/` no importa nada de React ni de `storage/`. Cada pantalla hace
siempre lo mismo:

1. **Lee** del storage todo lo que necesita (empresas, paquetes, bloques, jornada).
2. **Llama** a una función de `sistema/`, que devuelve las listas completas ya actualizadas.
3. **Guarda** el resultado y actualiza el state.

Así la pantalla no tiene reglas de negocio y el algoritmo se puede probar
sin el celular.

### Qué se guarda en AsyncStorage

| Clave | Contenido |
|---|---|
| `paquetes` | `Paquete[]` |
| `empresas` | `Empresa[]` |
| `bloques` | `BloqueHorario[]`: el cronograma ya generado, completo |
| `jornada` | `JornadaLaboral`, o nada si el usuario todavía no la configuró |

Empresas y bloques se guardan juntos con `guardarEmpresasYBloques` (un solo
`multiSet`), para que no quede guardada una cosa sin la otra si la app se
cierra en el medio.

---

## Qué se hizo

### 1. Cronograma al crear una empresa
- `AgregarEmpresa` llama a `crearEmpresaConCronograma`, que arma todas las
  sesiones del paquete dentro de la ventana de la empresa.
- Si no entran todas: aparece "No hay cupos" y **no se guarda nada**, ni
  siquiera la empresa (regla de negocio: sin asignaciones parciales).
- `fechaAlta` se guarda como `"YYYY-MM-DD"` en hora local.

### 2. Switch de prioridad alta (Mis Empresas)
- **Al prender** (`aplicarActivacionAlta`):
  - se guarda `fechaActivacionPrioridad` con fecha y hora, que define el orden FIFO;
  - se borran los bloques normales de la empresa de mañana en adelante;
  - se genera el bloque x4 de hoy, corriendo a las empresas que estorban.
- **Al apagar** (`aplicarDesactivacionAlta`):
  - la empresa vuelve a `"media"`;
  - se calculan las horas consumidas y se reparten las restantes con bloque
    normal en lo que queda de su ventana original;
  - las empresas que había desplazado se recalculan para volver a su patrón
    habitual.
- Si algo no entra, se muestra un aviso en la pantalla.
- Mientras se guarda, todos los switches y botones quedan deshabilitados.

### 3. Eliminar empresas y paquetes
- **Empresa:** se borran ella y todos sus bloques (libera su espacio). A las
  demás no se las reordena.
- **Paquete:** solo se puede borrar si ninguna empresa lo usa. Si alguna lo
  usa, se muestra un aviso con los nombres.
- La confirmación es en dos toques (ELIMINAR → ¿SEGURO? SÍ / NO). No se usa
  `Alert` porque en web no muestra botones.

### 4. Correcciones al algoritmo (`cronograma.ts`, antes `.tsx`)
| Problema | Solución |
|---|---|
| Las sesiones se ponían en días seguidos | Se reparten espaciadas en la ventana (10 sesiones en 30 días = una cada 3 días) |
| En Argentina la fecha podía correrse un día de noche | Las fechas se manejan siempre en UTC; "hoy" se calcula con hora local (`fechaLocalISO`) |
| La ventana tenía un día de más | Ahora es de 30/7 días contando el día de alta |
| El bloque x4 siempre iba al inicio de la jornada y podía pisar a otra empresa en alta | Respeta FIFO (no pisa a las que activaron antes) y elige la posición que menos minutos de otras empresas obliga a mover |
| Los bloques desplazados tenían un tope fijo de 30 días | Solo se mueven dentro de la ventana de su propia empresa |
| La última sesión siempre era de tamaño completo | Puede ser más corta (15 h en bloques de 2 h → la última dura 1 h) |

### 5. Pantalla de inicio (cronograma del día)
- Muestra los bloques de hoy ordenados por hora, como tarjetas: horario
  de inicio y fin, nombre de la empresa, duración y una etiqueta **ALTA**
  si la empresa está en prioridad alta. Si no hay bloques, muestra "Sin
  sesiones hoy".
- No calcula nada: lee bloques y empresas del storage y llama a
  `armarAgendaDelDia` (en `cronograma.ts`), que filtra por fecha y ordena.
- Se recarga cada vez que la pantalla vuelve a estar visible
  (`useFocusEffect`), así se ven enseguida los cambios hechos en los
  modales o en Mis Empresas.
- Cambio de día automático: un timer a la medianoche y, además, un
  chequeo de la fecha cada vez que la app vuelve del segundo plano (en el
  celular los timers se pausan con la app cerrada).

### 6. Chequeo diario de prioridad alta
- Mientras el switch está prendido, cada día la empresa recibe su bloque
  x4 (`aplicarChequeoDiario` en `prioridad.ts`).
- Lo llama la pantalla de inicio cada vez que carga la agenda: al abrir la
  app, al volver a la pantalla y a la medianoche. Si ese día ya se generó,
  no hace nada y no guarda.
- Las empresas en alta van en orden FIFO, y las que se corren se suman a
  `empresasDesplazadas`.
- **Excedente acumulado** (decisión del dueño, 2026-10-05): lo que no entra
  en la jornada pasa al día siguiente y se suma al x4 de ese día, y así
  sucesivamente, hasta que se apague el switch o se agoten las horas. El
  x4 de cada día nunca pide más de lo que le queda del paquete (horas del
  paquete menos todo lo ya agendado), así que el total nunca pasa del
  paquete.
- **Paquete agotado** (decisión del dueño, 2026-10-05): cuando la empresa
  consumió todas sus horas, el chequeo diario le apaga el switch solo
  (igual que apagarlo a mano: vuelve a media y las desplazadas vuelven a
  su patrón habitual) y la pantalla de inicio muestra un aviso.

### 7. Pantalla de jornada laboral
- Se entra desde MENU → "Jornada Laboral" en la pantalla de inicio.
- Selector FIJA / VARIABLE. Fija: un horario de inicio y fin para todos
  los días. Variable: los 7 días, cada uno con un switch TRABAJO / LIBRE y
  su horario.
- Las horas se cambian con botones − / + de a 30 minutos.
- Antes de guardar se valida (`validarJornada`): inicio antes que fin, y al
  menos un día de trabajo si es variable. Si algo está mal, se muestra el
  aviso y no se guarda.
- Al guardar, el cronograma se acomoda a la jornada nueva (ver
  "Decisiones tomadas") y la jornada y los bloques se guardan juntos con
  `guardarJornadaYBloques` (un solo `multiSet`).
- La lógica está en `sistema/jornada.ts`; la pantalla solo muestra y guarda.

### 8. Navegación con pestañas
- Barra fija abajo: **Hoy · Calendario · Empresas · Paquetes**. Desde
  cualquier pestaña se vuelve al cronograma con un toque. Reemplaza el
  menú MENU que tenía la pantalla de inicio.
- Jornada laboral se abre con el botón ⚙ de Hoy. Agregar Empresa y
  Agregar Paquete se abren con el botón + de su pestaña, como modal.
- Los modales y la jornada se cierran con `cerrarPantalla(alternativa)`
  (`components/kit`): vuelve atrás si hay historial y, si no, va a la
  ruta indicada. Reemplaza el `router.replace()` directo de antes, que
  con pestañas apilaba una copia de las pestañas.
- Todas las pestañas recargan sus datos al entrar (`useFocusEffect`).

### 9. Calendario (semana / mes)
- **Semana:** los 7 días (lunes a domingo), cada uno con su número, el
  total de horas y sus sesiones.
- **Mes:** grilla de lunes a domingo con hasta 3 puntos de color por día
  (uno por empresa). Al tocar un día se ven sus sesiones debajo.
- Flechas ‹ › para moverse, "Ir a hoy" para volver.
- Solo muestra el cronograma ya guardado; los cálculos de fechas están en
  `sistema/calendario.ts`.

### 10. Rediseño visual: "brutalista refinado" (elegido por el dueño)
- Se mantiene la identidad (bordes negros, amarillo, sombras duras) pero
  más prolija: tipografías **Space Grotesk** (texto) y **Space Mono**
  (horas y números), esquinas apenas redondeadas, escala de espaciados.
- Todo sale de `components/kit/tema.ts`: cambiar un color ahí lo cambia
  en toda la app.
- La sombra dura es una capa negra detrás de cada tarjeta/botón (no
  `elevation`), así se ve igual en iPhone y Android. Los botones "se
  hunden" al tocarlos.
- **Color por empresa** (`colorDeEmpresa`): sale del id, así cada empresa
  tiene siempre el mismo color sin guardarlo.
- Hoy muestra un resumen (sesiones, horas, empresas); Mis Empresas, una
  barra de horas consumidas y hasta cuándo dura la ventana; Mis Paquetes,
  el tamaño de sesión y cuántas empresas lo usan; Agregar Paquete, una
  vista previa del tamaño de sesión.
- Agregar Empresa y Agregar Paquete no dejan guardar con el nombre vacío
  (y Agregar Paquete, con horas que no sean un número mayor a 0).

### 11. Limpieza
- Se borraron los archivos de la plantilla de Expo que no se usaban
  (`explore.tsx`, `layout.tsx`, `components/app-tabs`, `themed-*`,
  `hooks/`, `constants/theme.ts`, etc.). Con eso desapareció el error de
  lint que venía de la plantilla.
- Se sacó la prop `onClose` de los modales y el import interno de
  `expo-router/build/...` en Agregar Paquete.

### 12. Renovación, tamaño de sesión y horarios pasados (decisiones del dueño, 2026-10-06)
- **Renovación automática** (`sistema/renovacion.ts`): cuando termina la
  ventana de una empresa, el chequeo diario le abre una nueva desde el día
  siguiente al fin de la anterior (respeta el ciclo), con el paquete
  completo. Si la app no se abrió durante varios períodos, salta directo a
  la ventana que contiene a hoy, y solo agenda desde hoy en adelante.
  - Prioridad media: se genera el cronograma completo de la ventana nueva.
    Si no entra, no se renueva, se avisa y se reintenta al día siguiente.
  - Prioridad alta: solo se renueva la ventana (horas completas otra vez);
    sigue con su x4 diario.
  - Van por antigüedad (la empresa más vieja elige lugar primero).
  - Hoy muestra el aviso "Se renovó el paquete de X". Mis Empresas muestra
    "Se renueva el ..." en cada empresa.
- **Sábados y domingos nunca hay sesiones** (decisión del dueño,
  2026-10-06): ni normales, ni x4, ni excedente (el del viernes pasa al
  lunes). La jornada laboral solo se configura de lunes a viernes. Si el
  switch se prende un fin de semana, el primer x4 es el lunes. El chequeo
  diario mueve solas las sesiones de mañana en adelante que hayan quedado
  en fin de semana o fuera de la jornada (datos viejos); si alguna no
  entra, avisa.
- **Tamaño de sesión = horas del paquete ÷ días hábiles** (decisión del
  dueño, 2026-10-06): ÷ 5 si es semanal; si es mensual, ÷ los días de
  lunes a viernes de los 30 días de SU ventana (20 a 22 según el día en
  que arranque). Redondeado hacia arriba a múltiplos de 5 minutos
  (`tamanoBloqueMinutos`). Ej: 10 h/semana → 2 h; 8 h/semana → 1 h 40 min;
  30 h/mes con 22 hábiles → 1 h 25 min. El x4 de prioridad alta es 4 veces
  eso. En Mis Paquetes se muestra con "≈" para los mensuales (calculado
  como si la ventana arrancara hoy). Reemplaza la tabla vieja (1/2/3/4 h).
- **Hoy no se agenda en horarios que ya pasaron**: al crear una empresa,
  renovar o generar el x4, para el día de hoy se busca lugar desde la hora
  actual redondeada al próximo cuarto de hora (15:07 → 15:15). Si la
  jornada de hoy ya terminó, arranca mañana.
- **Las sesiones se dan por hechas** (no se marcan): todo lo agendado de
  hoy para atrás cuenta como consumido.
- **Sesiones perdidas por una urgencia** (no entran en la ventana de su
  empresa): se borran y se avisa, como ya estaba.

### 13. Notas de las sesiones (pedido del dueño, 2026-10-06)
- En Hoy, cada sesión tiene un botón "Agregar nota" / "Editar nota" que
  abre el modal NotaSesion: muestra empresa y horario y un campo de texto
  (hasta 500 caracteres) para anotar lo que se hizo. Guardar con el texto
  vacío borra la nota.
- La nota se ve en la tarjeta de la sesión, en Hoy y en el Calendario
  (en el Calendario solo se lee).
- Se guarda en el propio bloque (`BloqueHorario.nota`), con
  `ponerNota` de `sistema/notas.ts`. Como todos los recálculos mueven
  solo sesiones de mañana en adelante, las notas de hoy no se pierden.
  Si se borra una empresa, sus notas se van con sus bloques.

### 15. Nombre, ícono y pantalla de carga (2026-10-08)
- La app se llama **Tempomanager** (`app.json` → `name`; el `slug` sigue
  siendo FreelanceTempo, se usa solo internamente para EAS).
- Ícono "bloques de agenda": tres barras de colores (celeste, coral,
  verde) con borde negro y sombra dura sobre amarillo `#FFD23F`. Están
  todas las variantes: `icon.png` (iOS y general), ícono adaptable de
  Android (frente, fondo y monocromático), pantalla de carga y favicon.
  Se generaron con un script (SVG → PNG con sharp) que no forma parte del
  proyecto.
- Pantalla de carga: las barras sobre fondo amarillo.
- `userInterfaceStyle: "light"`: la app es solo en modo claro.
- **No se ven en Expo Go** (que muestra sus propios ícono y nombre): recién
  aparecen al compilar la app con EAS.
- Se borraron las imágenes de la plantilla que no se usaban.

### 16. Respaldo de datos (2026-10-08, elegido por el dueño: archivo)
- Pantalla **Ajustes** (⚙ de Hoy): acceso a Jornada laboral y respaldo.
- **Exportar respaldo**: arma un archivo `tempomanager-respaldo-AAAA-MM-DD.json`
  con todos los datos (paquetes, empresas, sesiones con sus notas y
  jornada) y abre el menú de compartir del celular para guardarlo en
  Drive, Archivos, WhatsApp, mail, etc.
- **Restaurar desde archivo**: se elige el archivo, se valida
  (`leerRespaldo` en `sistema/respaldo.ts`: que sea de esta app, que no
  sea de una versión más nueva, que no falten datos y que no haya
  sesiones o empresas apuntando a cosas que no existen), se muestra un
  resumen y se pide confirmar, porque **reemplaza todos los datos**. Si
  el archivo no sirve, no se toca nada.
- Paquetes nuevos (instalados con `npx expo install`, incluidos en Expo
  Go): `expo-file-system`, `expo-sharing`, `expo-document-picker`.

### 17. Cambios en el modelo de datos
- `DatosApp` (en `type/`): todos los datos juntos, lo que va en un respaldo.
- `BloqueHorario.nota?: string`: lo que el usuario anotó que hizo en esa
  sesión.
- `Empresa.inicioVentana?: string`: inicio de la ventana ACTUAL; cambia en
  cada renovación. Si no está, es `fechaAlta` (que ahora es solo la fecha
  en que se creó la empresa). Las horas consumidas, el x4 y el "paquete
  agotado" cuentan solo los bloques de la ventana actual.
- `Empresa.empresasDesplazadas?: string[]`: ids de las empresas que corrió
  mientras estuvo en alta, para saber a quién recalcular al apagar.
- `Empresa.ultimoDiaUrgente?: string`: último día para el que ya se generó
  el bloque x4. Se usa este campo, y no "tiene un bloque hoy", porque el
  excedente del día anterior también cae en el día de hoy. Se borra al
  apagar el switch. Las empresas en alta que no lo tienen usan el día en
  que activaron el switch.

---

## Decisiones tomadas

Son decisiones que no estaban definidas en las reglas de negocio. Se pueden
cambiar.

- **Jornada por defecto de 09:00 a 18:00** (`JORNADA_POR_DEFECTO`) mientras
  el usuario no guarde la suya en la pantalla de jornada.
- **El cronograma siempre queda dentro de la jornada** (decisión del dueño,
  2026-10-06). Al guardar una jornada nueva, las sesiones de mañana en
  adelante que quedan fuera (día libre u horario fuera de rango) se mueven
  (`ajustarCronogramaAJornada`):
  - las normales, enteras y dentro de la ventana de su empresa; primero
    desde su día original hacia adelante y, si no, desde mañana;
  - las x4 de prioridad alta van primero (FIFO), hasta 30 días adelante, y
    se parten si no entran enteras (igual que el excedente);
  - si alguna no entra en ningún lado, **no se guarda la jornada** y se
    avisa qué empresas no entran (misma regla "no hay cupos": nada a medias).
- **Lo de hoy no se mueve al cambiar la jornada**, solo de mañana en
  adelante (igual que los demás recálculos): una sesión de hoy puede ya
  estar hecha y cuenta como consumida.
- **Las horas de la jornada se eligen con − / + de a 30 minutos**, no
  escribiéndolas, para que no se pueda cargar una hora inválida.
- **Horas consumidas** = la duración de los bloques de la empresa en su
  ventana actual, de hoy para atrás, incluido el de hoy. No se lleva un
  registro aparte (las sesiones se dan por hechas).
- **Al prender el switch** se borran los bloques normales de la empresa de
  mañana en adelante (los de hoy quedan). Si no, tendría a la vez los
  normales y los x4.
- **Si el bloque x4 no entra entero hoy**, el resto pasa a los días
  siguientes (hasta 30 días). Esto vale tanto si excede la jornada como si
  el lugar lo ocupan empresas en alta con prioridad FIFO.
- **Orden al apagar**: primero se recalcula la empresa que se apaga y
  después las desplazadas, por fecha de alta. Si alguna no entra, queda con
  su horario anterior y se avisa.
- **Las desplazadas que están en alta** no se recalculan al apagar otra
  empresa: las maneja su propio bloque x4.
- **No se puede borrar un paquete en uso.** La alternativa (borrarlo junto
  con sus empresas) se descartó por ser destructiva.
- **"Paquete agotado" usa la misma cuenta que las horas consumidas**
  (bloques de hoy para atrás, incluido el de hoy): el switch se apaga a la
  mañana del día de la última sesión, aunque esa sesión sea más tarde.
- **El aviso de paquete agotado se muestra una sola vez**, en la carga de
  la pantalla de inicio en que se apagó el switch.
- **El chequeo diario no rellena días pasados.** Si la app no se abrió
  durante algunos días, solo se genera el x4 de hoy: poner bloques en días
  que ya pasaron correría a otras empresas en el pasado.

---

## Qué funciona y cómo se verificó

- `npx tsc --noEmit` pasa sin errores.
- El algoritmo se probó fuera del celular con 3 empresas de ejemplo
  (10 h/mes, 30 h/mes y 8 h/semana):
  - las tres se crean bien, sin bloques superpuestos;
  - al prender la empresa de 30 h (x4 = 12 h, jornada de 9 h), se usa lo
    libre de hoy, el resto pasa a mañana y la empresa semanal se corre
    dentro de su semana;
  - al prender una segunda empresa, no pisa a la primera (FIFO);
  - al apagar la primera, se calculan 8 h consumidas y las 22 h restantes se
    reparten hasta el día 27, sin superposiciones.

- `npx expo lint` (2026-10-06): sin errores ni advertencias.
- Rediseño + pestañas + calendario (2026-10-06): `npx expo export` arma la
  app para iOS y Android sin errores (con las fuentes incluidas); las
  funciones de fechas del calendario se probaron fuera del celular
  (semanas de lunes a domingo, meses que empiezan en lunes, febrero de 4
  semanas, cambio de año). **Falta verlo en el celular.**

- La pantalla de inicio se probó en el celular (Expo Go) el 2026-10-05 y
  funciona bien.
- El chequeo diario se probó fuera del celular (2026-10-05) con las
  mismas 3 empresas: genera el x4 una vez por día, si se llama dos veces
  no repite, no rellena días salteados, respeta FIFO, no deja bloques
  superpuestos y al apagar el switch ya no genera más. Falta probarlo en
  el celular.
- Excedente y paquete agotado (2026-10-05): una empresa de 30 h en alta
  (x4 = 12 h, jornada de 9 h) agenda 8 h + 9 h + 9 h + 4 h, el total
  queda exactamente en 30 h y el switch se apaga solo el día de la última
  sesión, sin superposiciones.
- Jornada laboral (2026-10-06): se probaron fuera del celular la
  validación, el guardado de jornada fija y variable, y un cronograma
  con jornada variable (lun-vie 09-13, sábado 10-12, domingo libre): no
  hay sesiones en domingo ni fuera de horario. Falta probar la pantalla en
  el celular.
- Cambio de jornada (2026-10-06), con 3 empresas armadas en 09-18:
  - pasar a lun-vie 10-16 mueve 15 sesiones; ninguna queda fuera de la
    jornada ni de la ventana de su empresa, cada empresa conserva sus horas
    totales, sin superposiciones, y lo de hoy no se toca;
  - una jornada sin lugar (solo domingo 1 h) no se guarda;
  - guardar la misma jornada no mueve nada;
  - con una empresa en alta y la jornada achicada a 09-14, el excedente
    x4 también queda dentro (partido), sin superposiciones.

- Renovación, tamaño de sesión y horarios pasados (2026-10-06), fuera del
  celular:
  - tamaño (con la regla anterior, ÷ 7 / ÷ 30; reemplazada después por
    días hábiles): 30 h/mes → 60 min, 8 h/semana → 70 min;
  - crear una empresa a las 15:07: hoy nada antes de las 15:15, igual
    entran las 30 h (30 sesiones de 1 h, una por día); a las 18:30 arranca
    mañana; el x4 de hoy también arranca después de las 15:15;
  - renovación: la mensual se renueva el día siguiente al fin con sus 30 h
    completas, las horas consumidas arrancan de cero y una segunda llamada
    no cambia nada; si la app no se abre por semanas, salta a la ventana
    que contiene a hoy y agenda solo desde hoy; si no hay cupo, no se
    renueva y lo logra al día siguiente; una empresa en alta renueva su
    ventana y sigue con su x4 sin sesiones normales;
  - sin superposiciones en ningún caso; las pruebas anteriores de jornada
    y calendario siguen pasando.

- Fines de semana y tamaño ÷ días hábiles (2026-10-06), fuera del
  celular: ninguna sesión en sábado o domingo al crear empresas, con
  prioridad alta (el excedente del viernes pasa al lunes) ni al prender el
  switch un sábado (el lunes recibe un solo x4); la mensual tiene una
  sesión por día hábil y la semanal 5; datos viejos con sesiones en fin de
  semana se mueven solos sin perder horas; una jornada vieja con sábado
  guardado no agenda nada el sábado.

- Notas (2026-10-06), fuera del celular: se guardan sin espacios de más,
  se cortan en 500 caracteres, el texto vacío las borra, y las notas de
  hoy siguen ahí después de prender/apagar la prioridad alta y del
  chequeo diario. La app empaqueta para iOS y Android. Falta probar el
  modal en el celular.

### Entorno de desarrollo (esta PC)
- Node.js 24 LTS instalado con `winget`; dependencias con `npm ci`.
- `expo-env.d.ts` no está en git (lo genera `npx expo start`). Sin ese
  archivo `tsc` falla con errores de los `.css` de la plantilla; si pasa
  en una compu nueva, correr `npx expo start` una vez antes de `tsc`.

---

## Qué falta

### Limitaciones conocidas
- **Empresas viejas:** las creadas antes de estos cambios no tienen bloques,
  y algunas tienen `fechaAlta` con formato ISO completo. Conviene borrarlas
  y volver a crearlas. Las creadas con la tabla vieja de tamaño de bloque
  conservan sus sesiones hasta que se renueven (ahí toman el tamaño nuevo).

### Para publicar (se ven más adelante)
- [x] Respaldo (exportar y restaurar): probado en el celular el
      2026-10-08, funciona.
- [ ] Probar en el celular: renovación, días hábiles y notas.
- [ ] Ver el ícono y la pantalla de carga en una compilación de prueba (EAS).
- [ ] (Más adelante) backend con cuentas de usuario, si se quiere
      sincronizar o hacer la versión de escritorio.
- [ ] Distribución: TestFlight (Apple Developer, 99 USD/año) y/o Google
      Play (25 USD, pago único).

### Pendientes de producto (de `CLAUDE.md`)
- [ ] Vinculación con el calendario nativo.
- [ ] Decidir si se suma backend y cuentas de usuario.
- [ ] (Futuro) Versión de escritorio sincronizada.

### Detalles menores
- `actualizarEmpresa` en `storage/` quedó sin uso.
