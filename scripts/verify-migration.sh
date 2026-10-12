#!/usr/bin/env bash
# Applies the migration to a throw-away local PostgreSQL DB and checks integrity constraints. Needs psql + a reachable server.
# Usage: PSQL_URL=postgresql://postgres@localhost:5432 bash scripts/verify-migration.sh
set -euo pipefail
URL="${PSQL_URL:?set PSQL_URL to a server URL without database name}"; DB="devx_verify_$$"
psql "$URL/postgres" -qc "create database $DB"; trap 'psql "$URL/postgres" -qc "drop database $DB"' EXIT
psql "$URL/$DB" -v ON_ERROR_STOP=1 -q -f "$(dirname "$0")/../prisma/migrations/20261010000000_init/migration.sql"
fail() { echo "FAIL: $1"; exit 1; }
psql "$URL/$DB" -q -c "insert into \"Category\"(id,name) values('books','b'); insert into \"Product\"(id,\"categoryId\",name,price,\"updatedAt\") values('p1','books','x',1000,now()); insert into \"ProductVariant\"(id,\"productId\",stock) values('v1','p1',1);"
psql "$URL/$DB" -q -c "update \"ProductVariant\" set stock=-1" 2>/dev/null && fail "negative stock accepted" || echo "PASS negative stock rejected"
psql "$URL/$DB" -q -c "insert into \"ProductVariant\"(id,\"productId\",stock) values('v2','p1',1)" 2>/dev/null && fail "duplicate variant accepted" || echo "PASS duplicate variant rejected"
psql "$URL/$DB" -q -c "update \"Product\" set \"salePrice\"=1000" 2>/dev/null && fail "sale>=price accepted" || echo "PASS sale price must be < price"
echo "ALL PASS"
