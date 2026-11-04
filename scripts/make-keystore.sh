#!/usr/bin/env bash
# Creates the Play Store upload key for Bazaar and prints the GitHub secrets CI needs.
#
#   bash scripts/make-keystore.sh            # writes android/bazaar-release.jks
#
# KEEP THE .jks FILE AND PASSWORD SAFE. If you lose them you can no longer
# publish updates under the same Play Store listing (unless you use Play App Signing,
# which is recommended — then this is only your *upload* key and can be reset).
set -euo pipefail

cd "$(dirname "$0")/.."
OUT="android/bazaar-release.jks"
ALIAS="${BAZAAR_KEY_ALIAS:-bazaar}"

if [ -e "$OUT" ]; then
  echo "✗ $OUT already exists — refusing to overwrite your signing key." >&2
  exit 1
fi
command -v keytool >/dev/null || { echo "✗ keytool not found — install a JDK (17+)." >&2; exit 1; }

if [ -z "${BAZAAR_KEYSTORE_PASSWORD:-}" ]; then
  read -r -s -p "Choose a keystore password (min 6 chars): " BAZAAR_KEYSTORE_PASSWORD; echo
  read -r -s -p "Repeat it: " CONFIRM; echo
  [ "$BAZAAR_KEYSTORE_PASSWORD" = "$CONFIRM" ] || { echo "✗ Passwords do not match." >&2; exit 1; }
fi
[ ${#BAZAAR_KEYSTORE_PASSWORD} -ge 6 ] || { echo "✗ Password must be at least 6 characters." >&2; exit 1; }

DNAME="${BAZAAR_DNAME:-CN=Bazaar, OU=Mobile, O=Bazaar Marketplace, L=Kolkata, ST=West Bengal, C=IN}"

keytool -genkeypair -v \
  -keystore "$OUT" -storetype PKCS12 \
  -alias "$ALIAS" -keyalg RSA -keysize 2048 -validity 10000 \
  -storepass "$BAZAAR_KEYSTORE_PASSWORD" -keypass "$BAZAAR_KEYSTORE_PASSWORD" \
  -dname "$DNAME" >/dev/null 2>&1

cat > android/keystore.properties <<EOF
storeFile=bazaar-release.jks
storePassword=$BAZAAR_KEYSTORE_PASSWORD
keyAlias=$ALIAS
keyPassword=$BAZAAR_KEYSTORE_PASSWORD
EOF
chmod 600 "$OUT" android/keystore.properties

B64="$(base64 < "$OUT" | tr -d '\n')"

echo "✓ Created $OUT and android/keystore.properties (both git-ignored)."
echo
echo "Local release build:   cd android && ./gradlew bundleRelease assembleRelease"
echo
echo "For CI, add these repository secrets (Settings → Secrets and variables → Actions):"
echo "  BAZAAR_KEYSTORE_BASE64   = (the long value below)"
echo "  BAZAAR_KEYSTORE_PASSWORD = (the password you chose)"
echo "  BAZAAR_KEY_ALIAS         = $ALIAS"
echo
if command -v gh >/dev/null && [ "${SKIP_GH:-}" != "1" ]; then
  echo "Or, with the GitHub CLI logged in, run:"
  echo "  gh secret set BAZAAR_KEYSTORE_BASE64 < <(base64 < $OUT | tr -d '\\n')"
  echo "  gh secret set BAZAAR_KEYSTORE_PASSWORD"
  echo "  gh secret set BAZAAR_KEY_ALIAS --body $ALIAS"
  echo
fi
echo "BAZAAR_KEYSTORE_BASE64 value (${#B64} chars):"
echo "$B64"
