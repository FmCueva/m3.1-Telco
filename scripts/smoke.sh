#!/usr/bin/env bash
# scripts/smoke.sh — prueba de humo del API en marcha (sin IA): recorre el ciclo de vida completo
# por HTTP y verifica cada respuesta. Sale con código 1 si alguna comprobación falla.
#
# Uso:
#   docker compose up -d --build && bash scripts/smoke.sh
#   BASE=http://localhost:8080 WEBHOOK_SECRET=demo bash scripts/smoke.sh
#
# Variables (todas opcionales):
#   BASE            URL del API                      (por defecto http://localhost:8080)
#   WEBHOOK_SECRET  secreto HMAC de los webhooks     (por defecto el de .env: dummy-demo-webhook-secret)
#   API_CONTAINER   si se indica, reinicia ese contenedor y comprueba que los datos persisten
set -u

BASE="${BASE:-http://localhost:8080}"
SECRET="${WEBHOOK_SECRET:-dummy-demo-webhook-secret}"
JSON='content-type: application/json'
fails=0
body=''
code=''

# req MÉTODO RUTA [CUERPO] [FIRMA] → deja la respuesta en $body y el estado HTTP en $code
req() {
  local method="$1" path="$2" data="${3:-}" sig="${4:-}"
  # Fastify rechaza (400) un POST con content-type JSON y cuerpo vacío.
  [ "$method" = POST ] && [ -z "$data" ] && data='{}'
  local args=(-s -X "$method" "$BASE$path" -H "$JSON" -w '\n%{http_code}')
  [ -n "$data" ] && args+=(-d "$data")
  [ -n "$sig" ] && args+=(-H "x-signature: $sig")
  local out
  out="$(curl "${args[@]}")"
  code="${out##*$'\n'}"
  body="${out%$'\n'*}"
}

# check DESCRIPCIÓN ESPERADO REAL
check() {
  if [ "$2" = "$3" ]; then
    echo "  ✓ $1"
  else
    echo "  ✗ $1 (esperado $2, obtenido $3)"
    fails=$((fails + 1))
  fi
}

json_field() { printf '%s' "$body" | sed -n "s/.*\"$1\":\"\([^\"]*\)\".*/\1/p"; }
sign() { printf '%s' "$1" | openssl dgst -sha256 -hmac "$SECRET" | sed 's/.* //'; }

echo "Prueba de humo contra $BASE"

echo "• Salud"
req GET /healthz
check 'GET /healthz → 200' 200 "$code"

echo "• Cliente y contratación (INV-4)"
req POST /customers
check 'POST /customers → 201' 201 "$code"
customer="$(json_field id)"
req POST /contracts "{\"customerId\":\"$customer\",\"type\":\"FIBER\"}"
check 'contratar con KYC pendiente → 403' 403 "$code"
req POST "/customers/$customer/kyc" '{"result":"VERIFIED"}'
check 'verificar KYC → 200' 200 "$code"
req POST /contracts "{\"customerId\":\"$customer\",\"type\":\"TELEFONO\"}"
check 'tipo de servicio inválido → 400' 400 "$code"
req POST /contracts "{\"customerId\":\"$customer\",\"type\":\"FIBER\"}"
check 'contratar con KYC verificado → 201' 201 "$code"
contract="$(json_field id)"

echo "• Máquina de estados (INV-2, INV-3)"
req POST "/contracts/$contract/events" '{"event":"confirm"}'
check 'confirmar → PENDING_INSTALLATION' PENDING_INSTALLATION "$(json_field status)"
req POST "/contracts/$contract/events" '{"event":"confirm"}'
check 'confirmar de nuevo (transición inválida) → 409' 409 "$code"

echo "• Webhooks firmados (NFR-SEC-001)"
payload="{\"contractId\":\"$contract\"}"
req POST /webhooks/installation "$payload"
check 'instalación sin firma → 401' 401 "$code"
req POST /webhooks/installation "$payload" 'deadbeef'
check 'instalación con firma inválida → 401' 401 "$code"
req POST /webhooks/installation "$payload" "$(sign "$payload")"
check 'instalación firmada → ACTIVE' ACTIVE "$(json_field status)"
payload="{\"contractId\":\"$contract\",\"event\":\"PAYMENT_DEFAULT\"}"
req POST /webhooks/billing "$payload" "$(sign "$payload")"
check 'impago firmado → SUSPENDED' SUSPENDED "$(json_field status)"
payload="{\"contractId\":\"$contract\",\"event\":\"PAYMENT_REGULARIZED\"}"
req POST /webhooks/billing "$payload" "$(sign "$payload")"
check 'pago regularizado firmado → ACTIVE' ACTIVE "$(json_field status)"

echo "• Incidencias (FR-DOM-013, FR-DOM-017)"
req POST /incidents '{"contractId":"no-existe","description":"x"}'
check 'incidencia sobre servicio inexistente → 404' 404 "$code"
req POST /incidents "{\"contractId\":\"$contract\",\"description\":\"Sin internet\"}"
check 'registrar incidencia → 201' 201 "$code"
incident="$(json_field id)"
req POST "/incidents/$incident/resolve" '{}'
check 'resolver sin technicianId → 400' 400 "$code"
req POST "/incidents/$incident/resolve" '{"technicianId":"t-17"}'
check 'resolver → RESOLVED' RESOLVED "$(json_field status)"
req POST "/incidents/$incident/resolve" '{"technicianId":"t-17"}'
check 'resolver otra vez (RESOLVED es terminal) → 409' 409 "$code"

echo "• Cancelación terminal (INV-3, INV-9)"
req POST "/contracts/$contract/events" '{"event":"cancel"}'
check 'cancelar → CANCELLED' CANCELLED "$(json_field status)"
req POST "/contracts/$contract/events" '{"event":"confirm"}'
check 'evento sobre CANCELLED → 409' 409 "$code"
req POST /incidents "{\"contractId\":\"$contract\",\"description\":\"x\"}"
check 'incidencia sobre servicio CANCELLED → 409' 409 "$code"

echo "• Métricas"
req GET /metrics
check 'GET /metrics → 200' 200 "$code"
for metric in incidents_manual_review_queue_size http_requests_total \
  http_request_duration_seconds_count incident_manual_review_resolution_seconds_count \
  audit_log_completeness; do
  if printf '%s' "$body" | grep -q "^$metric"; then
    echo "  ✓ expone $metric"
  else
    echo "  ✗ falta la métrica $metric"
    fails=$((fails + 1))
  fi
done

if [ -n "${API_CONTAINER:-}" ]; then
  echo "• Persistencia (reinicio de $API_CONTAINER)"
  docker restart "$API_CONTAINER" >/dev/null
  for _ in $(seq 1 30); do
    req GET /healthz
    [ "$code" = 200 ] && break
    sleep 1
  done
  req GET "/contracts/$contract"
  check 'el contrato sobrevive al reinicio' CANCELLED "$(json_field status)"
fi

echo
if [ "$fails" -eq 0 ]; then
  echo "✓ Prueba de humo superada"
else
  echo "✗ $fails comprobación(es) fallida(s)"
  exit 1
fi
