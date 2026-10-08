# Qué hace cada archivo — Tempomanager

Guía rápida para ubicarse en el código. Para las decisiones y el estado del
proyecto, ver `CONTEXTO.md`.

**Regla de capas:** las pantallas (`app/`) leen del `storage/`, le pasan los
datos a `sistema/` (que hace todos los cálculos) y guardan lo que devuelve.
`sistema/` nunca toca React ni el storage.

---

## `src/app/` — Pantallas

En Expo Router cada archivo de esta carpeta es una pantalla, y la ruta sale
del nombre del archivo. Las carpetas entre paréntesis, como `(tabs)`, agrupan
pantallas sin aparecer en la ruta. Los `_layout.tsx` definen la navegación.

| Archivo | Qué hace |
|---|---|
| `_layout.tsx` | Raíz de la app: carga las fuentes y arma la navegación principal (pestañas, modales, Ajustes y Jornada). |
| `+html.tsx` | Solo web: esqueleto HTML. Enlaza el manifest, que permite instalarla en la compu, y el service worker, que permite abrirla sin internet. |
| `ajustes.tsx` | **Ajustes** (botón ⚙ de Hoy): acceso a la jornada laboral, y exportar o restaurar el respaldo de datos. |
| `jornada.tsx` | **Jornada laboral**: horario fijo o por día (lunes a viernes). Al guardar, acomoda el cronograma a la jornada nueva. |

### `src/app/(tabs)/` — Pestañas de abajo

| Archivo | Qué hace |
|---|---|
| `_layout.tsx` | La barra de pestañas: Hoy · Calendario · Empresas · Paquetes. |
| `index.tsx` | **Hoy**: resumen y sesiones del día. Además, cada vez que se abre corre el chequeo diario: x4 de prioridad alta, renovaciones y apagado automático. |
| `calendario.tsx` | **Calendario**: el cronograma completo en vista semana o mes. Solo muestra; no calcula. |
| `mis-empresas.tsx` | **Empresas**: lista con el progreso de horas, el switch de prioridad alta y el botón de eliminar. |
| `mis-paquetes.tsx` | **Paquetes**: lista con el tamaño de sesión y cuántas empresas usan cada uno. Solo deja borrar los que no usa nadie. |

### `src/app/(modals)/` — Ventanas que se abren encima

| Archivo | Qué hace |
|---|---|
| `AgregarEmpresa.tsx` | Alta de una empresa. Genera todo su cronograma; si no entra, avisa "no hay cupos" y no guarda nada. |
| `AgregarPaquete.tsx` | Alta de un paquete de horas (nombre, horas, semanal o mensual). Muestra una vista previa del tamaño de sesión. |
| `NotaSesion.tsx` | Escribir o borrar la nota de una sesión (lo que hiciste en ese horario). Se abre desde Hoy. |

---

## `src/sistema/` — Lógica de negocio

Funciones puras: reciben datos y devuelven datos nuevos. Es la parte que
conviene probar cuando se cambia una regla.

| Archivo | Qué hace |
|---|---|
| `cronograma.ts` | **El algoritmo principal.** Calcula el tamaño de sesión, la ventana y los días hábiles. Arma el cronograma de una empresa, genera el bloque x4 de prioridad alta y recalcula lo que le queda a una empresa. También arma la agenda del día y acomoda el cronograma cuando cambia la jornada. Incluye las funciones de fechas y horas. |
| `prioridad.ts` | Switch de prioridad alta: prenderlo, apagarlo (con recálculo de las empresas desplazadas) y el **chequeo diario** (`aplicarChequeoDiario`). El chequeo genera el x4 de cada día en orden FIFO y apaga el switch cuando se agota el paquete. |
| `renovacion.ts` | Cuando termina la ventana de una empresa, abre una nueva con el paquete completo. |
| `jornada.ts` | Edita, valida y convierte la jornada laboral (por ejemplo, que el inicio sea antes que el fin). |
| `calendario.ts` | Fechas para la vista de calendario: semana de lunes a domingo, grilla del mes y avanzar o retroceder. |
| `eliminacion.ts` | Borra una empresa con todos sus bloques y dice qué empresas usan un paquete. |
| `notas.ts` | Pone o borra la nota de una sesión (máximo 500 caracteres). |
| `respaldo.ts` | Arma el archivo de respaldo y valida uno antes de restaurarlo. |

---

## `src/storage/`, `src/type/` y `src/components/`

| Archivo | Qué hace |
|---|---|
| `storage/index.ts` | Guarda y lee los datos con AsyncStorage: paquetes, empresas, bloques y jornada. En la compu usa el almacenamiento del navegador. No tiene reglas de negocio. |
| `type/index.ts` | Los tipos de datos de toda la app: `Paquete`, `Empresa`, `BloqueHorario`, `JornadaLaboral`, etc. Son como los modelos en C#. |
| `components/kit/tema.ts` | Colores, tipografías, espaciados y bordes. Cambiar algo acá cambia el look de toda la app. |
| `components/kit/index.tsx` | Piezas visuales reutilizables: `Pantalla`, `Tarjeta`, `Boton`, `Aviso`, `Selector`, `Campo`, `Icono`, etc. |
| `components/tarjeta-sesion.tsx` | La tarjeta de una sesión (color de la empresa, horario, etiqueta ALTA y nota). La usan Hoy y Calendario. |
| `components/boton-eliminar.tsx` | Botón de eliminar con confirmación en dos toques. |
| `components/formato.ts` | Cómo se muestran fechas y duraciones en español (por ejemplo, "jueves 8 de octubre" o "1 h 30 min"). |

---

## Archivos de la raíz y otras carpetas

| Archivo | Qué hace |
|---|---|
| `app.json` | Configuración de la app: nombre, ícono, identificadores, pantalla de carga, y los ajustes de EAS y de las actualizaciones. |
| `eas.json` | Perfiles de compilación de EAS (`preview` para el `.apk`, `production` para las tiendas). |
| `package.json` | Dependencias y comandos (`npm start`, etc.). |
| `public/manifest.json` | Solo web: nombre, colores e íconos para instalarla en la compu. |
| `public/sw.js` | Solo web: service worker que guarda una copia para abrir sin internet. |
| `public/*.png` | Íconos de la versión web. |
| `assets/images/` | Íconos y pantalla de carga del celular. |
| `docs/qr-expo-go.png` | QR para abrir la app en Expo Go sin la compu. |
| `CONTEXTO.md` | Estado del proyecto: qué se hizo, decisiones y qué falta. |
| `ARCHIVOS.md` / `docs/archivos.pdf` | Esta guía (la misma, en Markdown y en PDF). |
| `AGENTS.md` | Instrucciones de Expo para asistentes de IA. |
