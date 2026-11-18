#!/bin/zsh
set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

if [ -f "$SCRIPT_DIR/package.json" ]; then
  PROJECT_DIR="$SCRIPT_DIR"
elif [ -f "$SCRIPT_DIR/effecto-ips/package.json" ]; then
  PROJECT_DIR="$SCRIPT_DIR/effecto-ips"
else
  printf 'No encuentro package.json en la carpeta del lanzador ni en effecto-ips.\n'
  read -r _
  exit 1
fi

cd "$PROJECT_DIR"

if [ ! -x "$PROJECT_DIR/node_modules/.bin/vite" ]; then
  printf 'Faltan las dependencias del juego. Ejecuta npm install una vez en esta carpeta.\n'
  read -r _
  exit 1
fi

npm run dev -- --open
