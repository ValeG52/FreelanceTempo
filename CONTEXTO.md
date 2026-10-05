# Contexto del proyecto — FreelanceTempo

Resumen del trabajo hecho hasta ahora: cómo está organizado el código, qué
decisiones se tomaron, qué funciona y qué falta. Las reglas de negocio
completas están en `CLAUDE.md`; acá va lo que se implementó y por qué.

Última actualización: 2026-10-05.

---

## Estructura

```
src/
├── app/                        # pantallas (Expo Router)
│   ├── index.tsx               # Cronograma (inicio): los bloques de hoy
│   ├── mis-empresas.tsx        # lista + switch de prioridad alta + eliminar
│   ├── mis-paquetes.tsx        # lista + eliminar
│   └── (modals)/
│       ├── AgregarEmpresa.tsx  # crea la empresa y genera su cronograma
│       └── AgregarPaquete.tsx
├── components/
│   └── boton-eliminar.tsx      # botón con confirmación en dos toques
├── sistema/                    # lógica de negocio pura (sin React ni storage)
│   ├── cronograma.ts           # algoritmo: generación normal, x4, recálculo, agenda del día
│   ├── prioridad.ts            # prender/apagar el switch de prioridad alta, chequeo diario
│   └── eliminacion.ts          # borrar empresas, validar borrado de paquetes
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

### 7. Cambios en el modelo de datos
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

- **Jornada provisoria de 09:00 a 18:00** (`JORNADA_POR_DEFECTO`) mientras no
  exista la pantalla de jornada.
- **Horas consumidas** = la duración de todos los bloques de la empresa de
  hoy para atrás, incluido el de hoy. No se lleva un registro aparte.
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

- `npx expo lint` (2026-10-03): 1 error y 5 advertencias, ninguno en
  código nuestro de `sistema/` ni en la pantalla de inicio:
  - error en `src/hooks/use-color-scheme.web.ts` (archivo de la plantilla
    de Expo, `setState` dentro de un `useEffect`);
  - advertencias en los modales: `react` importado dos veces y un
    `useEffect` sin usar en `AgregarPaquete`.

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

### Entorno de desarrollo (esta PC)
- Node.js 24 LTS instalado con `winget`; dependencias con `npm ci`.
- `expo-env.d.ts` no está en git (lo genera `npx expo start`). Sin ese
  archivo `tsc` falla con errores de los `.css` de la plantilla; si pasa
  en una compu nueva, correr `npx expo start` una vez antes de `tsc`.

---

## Qué falta

### Para que el cronograma funcione de punta a punta
- [ ] **Pantalla de jornada laboral** (fija o variable), que usa
      `guardarJornada`.

### Limitaciones conocidas
- **Horarios ya pasados:** el bloque de hoy puede quedar en un horario que
  ya pasó (por ejemplo, si se prende el switch a las 15 h, el bloque puede
  quedar a las 10 h). Lo mismo al crear una empresa a la tarde.
- **Empresas viejas:** las creadas antes de estos cambios no tienen bloques,
  y algunas tienen `fechaAlta` con formato ISO completo. Conviene borrarlas
  y volver a crearlas.
- **Sesiones perdidas:** si un bloque desplazado no entra en la ventana de su
  empresa, se saca del cronograma y se muestra un aviso. Las reglas de
  negocio asumen que las urgencias duran poco y no definen qué hacer en ese
  caso.

### Pendientes de producto (de `CLAUDE.md`)
- [ ] Confirmar la tabla de tamaño de bloque con datos reales.
- [ ] Vista de calendario semana/mes.
- [ ] Vinculación con el calendario nativo.
- [ ] Decidir si se suma backend y cuentas de usuario.
- [ ] (Futuro) Versión de escritorio sincronizada.

### Detalles menores
- `AgregarEmpresa` recibe una prop `onClose` que Expo Router nunca le pasa.
  No rompe nada, pero se puede borrar.
- `actualizarEmpresa` en `storage/` quedó sin uso.
