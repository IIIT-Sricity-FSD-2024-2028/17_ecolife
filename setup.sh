#!/usr/bin/env bash
# One-time setup. Needs: Node 20+, PostgreSQL 14+ running locally, and a postgres superuser.
# Usage: PGPASSWORD=<postgres password> bash setup.sh      (defaults: user postgres, db tropos)
set -e
cd "$(dirname "$0")"
SU=${PGUSER:-postgres}; PW=${PGPASSWORD:-postgres}; DB=${DB_NAME:-tropos}; HOST=${PGHOST:-localhost}; PORT=${PGPORT:-5432}
APPPW=$(node -e "console.log(require('crypto').randomBytes(12).toString('hex'))")
export PGPASSWORD=$PW
psql -h $HOST -p $PORT -U $SU -tc "SELECT 1 FROM pg_database WHERE datname='$DB'" | grep -q 1 || psql -h $HOST -p $PORT -U $SU -c "CREATE DATABASE $DB"
cd backend
if [ ! -f .env ]; then
  cp .env.example .env
  sed -i "s|^MIGRATE_DATABASE_URL=.*|MIGRATE_DATABASE_URL=\"postgresql://$SU:$PW@$HOST:$PORT/$DB\"|" .env
  sed -i "s|^DATABASE_URL=.*|DATABASE_URL=\"postgresql://tropos_app:$APPPW@$HOST:$PORT/$DB\"|" .env
  sed -i "s|^APP_DB_PASSWORD=.*|APP_DB_PASSWORD=$APPPW|" .env
  # Demo-only billing identity (a made-up supplier) so invoices can be issued while you test. Real values come from the CA.
  sed -i 's|^BILLING_SUPPLIER_GSTIN=.*|BILLING_SUPPLIER_GSTIN="27AAPFU0939F1ZV"|;s|^BILLING_SUPPLIER_NAME=.*|BILLING_SUPPLIER_NAME="Tropos Demo Pvt Ltd (test)"|;s|^BILLING_SUPPLIER_ADDRESS=.*|BILLING_SUPPLIER_ADDRESS="1 Demo Road, Mumbai"|;s|^BILLING_SAC_CODE=.*|BILLING_SAC_CODE="998314"|;s|^BILLING_GST_RATE_PCT=.*|BILLING_GST_RATE_PCT="18"|' .env
  sed -i "s|^JWT_SECRET=.*|JWT_SECRET=$(node -e "console.log(require('crypto').randomBytes(48).toString('hex'))")|" .env
  sed -i "s|^DATA_ENCRYPTION_KEY=.*|DATA_ENCRYPTION_KEY=$(node -e "console.log(require('crypto').randomBytes(32).toString('hex'))")|" .env
fi
npm install
npm run db:setup
npm run build
node dist/main.js > ../api-setup.log 2>&1 &
API=$!
for i in $(seq 1 40); do curl -s -o /dev/null http://localhost:${PORT_API:-4000}/health && break; sleep 1; done
npm run db:seed-demo
npm run db:seed-history
kill $API 2>/dev/null || true
cd ../frontend-redux && npm install
echo; echo "Setup done. Now run the backend (npm run start:dev in backend/) and the frontend (npm run dev in frontend-redux/)."
