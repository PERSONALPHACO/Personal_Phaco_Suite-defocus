#!/usr/bin/env bash
# Backup diário do DefocusApp: mysqldump → gzip → age (chave pública) → Cloudflare R2.
#
# O servidor só conhece a chave PÚBLICA (AGE_RECIPIENT). A chave privada fica
# com o dono; sem ela o arquivo no R2 é ilegível — para o Railway, para a
# Cloudflare e para quem obtiver as credenciais do bucket.
#
# Modo verificação: se AGE_IDENTITY estiver definida (só durante o teste de
# restauração), depois do upload o script baixa o arquivo, decifra, restaura
# num banco temporário e compara a contagem de linhas com a origem.
set -euo pipefail

need() { for v in "$@"; do [ -n "${!v:-}" ] || { echo "[backup] variável ausente: $v" >&2; exit 1; }; done; }
need MYSQLHOST MYSQLPORT MYSQLUSER MYSQLPASSWORD MYSQLDATABASE \
     AGE_RECIPIENT R2_ACCOUNT_ID R2_BUCKET R2_ACCESS_KEY_ID R2_SECRET_ACCESS_KEY

STAMP=$(date -u +%Y%m%dT%H%M%SZ)
NAME="defocusapp-${STAMP}.sql.gz.age"
TMP=$(mktemp -d)
trap 'rm -rf "$TMP"' EXIT
export MYSQL_PWD="$MYSQLPASSWORD"   # não aparece na lista de processos
ENDPOINT="${S3_ENDPOINT:-https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com}"   # S3_ENDPOINT só para teste local
S3AUTH=(--aws-sigv4 "aws:amz:${S3_REGION:-auto}:s3" --user "${R2_ACCESS_KEY_ID}:${R2_SECRET_ACCESS_KEY}")

echo "[backup] dump de ${MYSQLDATABASE}…"
mysqldump -h "$MYSQLHOST" -P "$MYSQLPORT" -u "$MYSQLUSER" \
  --single-transaction --quick --routines --triggers --events \
  --set-gtid-purged=OFF --no-tablespaces --default-character-set=utf8mb4 \
  "$MYSQLDATABASE" | gzip -9 | age -r "$AGE_RECIPIENT" -o "$TMP/$NAME"

SIZE=$(stat -c %s "$TMP/$NAME")
[ "$SIZE" -gt 200 ] || { echo "[backup] arquivo suspeito (${SIZE} bytes)" >&2; exit 1; }

echo "[backup] enviando ${NAME} (${SIZE} bytes) para R2…"
curl -sS --fail-with-body "${S3AUTH[@]}" -T "$TMP/$NAME" \
  -H "Content-Type: application/octet-stream" \
  "${ENDPOINT}/${R2_BUCKET}/${NAME}" -o /dev/null
echo "[backup] OK ${NAME}"

# ── Verificação de restauração (opcional) ──────────────────────────────────
if [ -n "${AGE_IDENTITY:-}" ]; then
  echo "[verify] baixando de volta e restaurando em banco temporário…"
  printf '%s\n' "$AGE_IDENTITY" > "$TMP/id.txt"; chmod 600 "$TMP/id.txt"
  curl -sS --fail-with-body "${S3AUTH[@]}" "${ENDPOINT}/${R2_BUCKET}/${NAME}" -o "$TMP/back.age"
  cmp -s "$TMP/back.age" "$TMP/$NAME" || { echo "[verify] arquivo baixado difere do enviado" >&2; exit 1; }
  RT="restore_test_$$"
  mysql -h "$MYSQLHOST" -P "$MYSQLPORT" -u "$MYSQLUSER" -e "CREATE DATABASE \`$RT\`"
  age -d -i "$TMP/id.txt" "$TMP/back.age" | gunzip | \
    mysql -h "$MYSQLHOST" -P "$MYSQLPORT" -u "$MYSQLUSER" "$RT"
  FAIL=0
  for T in users manufacturers iols patients patient_iols measurements measurement_points password_reset_tokens __drizzle_migrations; do
    A=$(mysql -N -h "$MYSQLHOST" -P "$MYSQLPORT" -u "$MYSQLUSER" -e "SELECT COUNT(*) FROM \`$MYSQLDATABASE\`.\`$T\`")
    B=$(mysql -N -h "$MYSQLHOST" -P "$MYSQLPORT" -u "$MYSQLUSER" -e "SELECT COUNT(*) FROM \`$RT\`.\`$T\`")
    echo "[verify] $T: origem=$A restaurado=$B"
    [ "$A" = "$B" ] || FAIL=1
  done
  mysql -h "$MYSQLHOST" -P "$MYSQLPORT" -u "$MYSQLUSER" -e "DROP DATABASE \`$RT\`"
  [ "$FAIL" = 0 ] && echo "[verify] RESTAURAÇÃO OK" || { echo "[verify] DIVERGÊNCIA" >&2; exit 1; }
fi
