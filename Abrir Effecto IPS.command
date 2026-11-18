#!/bin/zsh
set -e

PROJECT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$PROJECT_DIR"

if [ ! -x "$PROJECT_DIR/node_modules/.bin/vite" ]; then
  printf 'Faltan las dependencias del juego. Ejecuta npm install una vez en esta carpeta.\n'
  read -r _
  exit 1
fi

npm run dev -- --open
