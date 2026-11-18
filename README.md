# Effecto IPS

Prototipo jugable de radionovela interactiva 3D.

## Requisitos

- Node.js 18 o superior
- Navegador de escritorio con WebGL

## Ejecutar

```bash
npm install
npm run dev
```

Abra la URL que indique Vite. Pulse el lienzo para capturar el ratón y use WASD para moverse.

Controles:

- W/A/S/D: movimiento
- Ratón: mirar
- E: interactuar con el objeto apuntado
- Clic en la habitación: capturar el ratón para mirar; con el ratón capturado, clic izquierdo también interactúa
- I: inventario
- Escape: salir del computador o menú de pausa del navegador

El cursor libre se usa para los botones del computador. En la habitación, apunta a los objetos y pulsa E; si Pointer Lock está disponible, también puedes interactuar con clic izquierdo mientras el ratón está capturado. Al completar el Capítulo 2, vuelve a la sala y abre los cajones de la cajonera junto al escritorio. Mantén E cinco segundos apuntando a la llave del cajón superior para recogerla; aparecerá en la barra inferior. Después apunta al compartimento superior con candado e interactúa para abrirlo. Mantén E cinco segundos apuntando al cassette de dentro para recogerlo y desbloquear el Capítulo 3.

## Compilación

```bash
npm run build
npm run preview
```

## Recursos

La configuración central de los cassettes está en `src/config/chapters.js`.
Los archivos proporcionados ya están copiados en `public/assets/audio` e `public/assets/images`.

Para reemplazar recursos definitivos:

- Sustituya los WAV o cambie `file` por rutas `.mp3/.ogg/.wav`.
- Reemplace las PNG y cambie `image`.
- Reemplace los VTT y cambie `subtitles`.
- Coloque archivos no narrativos, como efectos, en `public/assets/sfx`.
- Coloque fuentes adicionales en `public/assets/fonts`.
- Los cassettes de finales están configurados en `endingChapters`, en `src/config/chapters.js`, y sus audios están en `public/assets/audio/final1.wav`, `final2.wav` y `final3.wav`.

No agregue frases bíblicas a `src/config/quotes.js` sin obtenerlas del guion original.
Los subtítulos actuales son marcadores provisionales y no contienen diálogos inventados.

## Personalización

- Objetos y posiciones: `src/scene/RoomScene.js`
- Respuesta y desbloqueos: `src/core/ProgressionSystem.js`
- Contraseñas y finales: `src/main.js`
- Textos centrales de cassettes: `src/config/chapters.js`
- Volúmenes, sensibilidad y opciones: menú de configuración

## Guardado

El progreso usa `localStorage` bajo la clave `effecto-ips-save-v1`. Una partida nueva solicita confirmación cuando existe progreso previo.
