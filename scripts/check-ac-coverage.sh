#!/usr/bin/env bash
# scripts/check-ac-coverage.sh — el gate definitivo (Módulo Construcción, vídeo 7):
# "Si un AC no tiene un test que lo verifique, no se considera implementado."
# Extrae los AC-XXX-NNN declarados en specs/ y los compara con los referenciados
# en tests/. Si alguno se queda sin test: exit code 1 y el pipeline bloquea.
set -e

# Extrae los AC declarados en specs/*.md
declared=$(grep -rohE 'AC-[A-Z]+-[0-9]+' specs/ | sort -u)
# Extrae los AC referenciados en tests
covered=$(grep -rohE 'AC-[A-Z]+-[0-9]+' tests/ | sort -u)

missing=$(comm -23 <(echo "$declared") <(echo "$covered"))

if [ -n "$missing" ]; then
  echo "❌ AC sin test asociado:"
  echo "$missing"
  exit 1
fi

echo "✓ $(echo "$declared" | wc -l | tr -d ' ') AC declarados en specs/ — todos con test en tests/"
