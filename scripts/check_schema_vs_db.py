#!/usr/bin/env python3
"""Independent static reconciliation: schema.prisma  vs  a live PostgreSQL catalog after applying the migrations.
Fallback for environments where `prisma migrate diff` cannot run. NOT a replacement for it.
Usage: PGURL=postgresql://user@host:port/db python3 scripts/check_schema_vs_db.py"""
import os, re, subprocess, sys, json
url = os.environ['PGURL']
def q(sql):
    r = subprocess.run(['psql', url, '-At', '-F', '\t', '-c', sql], capture_output=True, text=True, check=True); return [l.split('\t') for l in r.stdout.splitlines() if l]
schema = open(os.path.join(os.path.dirname(__file__), '..', 'prisma', 'schema.prisma')).read()
enums = {m[0]: m[1].split() for m in re.findall(r'enum (\w+) \{ ([^}]*) \}', schema)}
models = dict(re.findall(r'model (\w+) \{(.*?)\n\}', schema, re.S))
TYPES = {'String': 'text', 'Int': 'integer', 'Boolean': 'boolean', 'DateTime': 'timestamp without time zone', 'Json': 'jsonb'}
errs = []
cols = {(t, c): (n, d, u) for t, c, n, d, u in q("select table_name,column_name,is_nullable,data_type,udt_name from information_schema.columns where table_schema='public'")}
tables = {t for t, _ in cols}
if tables != set(models): errs.append(f'table set differs: schema-only={set(models)-tables} db-only={tables-set(models)}')
fk_db = {(t, c, rt, rule) for t, c, rt, rule in q("""select kcu.table_name,kcu.column_name,ccu.table_name,rc.delete_rule from information_schema.referential_constraints rc
 join information_schema.key_column_usage kcu on kcu.constraint_name=rc.constraint_name
 join information_schema.constraint_column_usage ccu on ccu.constraint_name=rc.constraint_name where kcu.table_schema='public'""")}
idx_db = {(t, i, ('u' if 'UNIQUE' in d else 'i')) for t, i, d in q("select tablename,indexname,indexdef from pg_indexes where schemaname='public' and indexname not like '%_pkey'")}
fk_sc, idx_sc = set(), set()
for m, body in models.items():
    pk = None
    for line in body.split('\n'):
        line = line.split('//')[0].strip()
        if not line: continue
        if line.startswith('@@id'): pk = re.search(r'\[(.*?)\]', line).group(1).split(', '); continue
        if line.startswith('@@unique'): idx_sc.add((m, f'{m}_' + '_'.join(re.search(r'\[(.*?)\]', line).group(1).split(', ')) + '_key', 'u')); continue
        if line.startswith('@@index'): idx_sc.add((m, f'{m}_' + '_'.join(re.search(r'\[(.*?)\]', line).group(1).split(', ')) + '_idx', 'i')); continue
        p = line.split(); f, t = p[0], p[1]; rest = ' '.join(p[2:]); opt = t.endswith('?'); arr = t.endswith('[]'); b = t.rstrip('?').replace('[]', '')
        if b in models:
            r = re.search(r'fields: \[(\w+)\], references: \[(\w+)\](?:, onDelete: (\w+))?', rest)
            if r and not arr:
                rule = {'Cascade': 'CASCADE', 'SetNull': 'SET NULL'}.get(r.group(3)) or ('SET NULL' if opt else 'RESTRICT')
                if r.group(3) is None and opt: rule = 'SET NULL'
                fk_sc.add((m, r.group(1), b, rule))
            continue
        if '@unique' in rest: idx_sc.add((m, f'{m}_{f}_key', 'u'))
        got = cols.get((m, f))
        if not got: errs.append(f'{m}.{f}: column missing in DB'); continue
        want_null = 'YES' if (opt and not arr) else 'NO'
        if got[0] != want_null: errs.append(f'{m}.{f}: nullable {got[0]} != {want_null}')
        want_t = 'ARRAY' if arr else ('USER-DEFINED' if b in enums else TYPES[b])
        if got[1] != want_t: errs.append(f'{m}.{f}: type {got[1]} != {want_t}')
        if b in enums and got[2] != b: errs.append(f'{m}.{f}: enum {got[2]} != {b}')
    want_cols = {l.split('//')[0].split()[0] for l in body.split('\n') if l.split('//')[0].strip() and not l.strip().startswith('@@') and l.split()[0] and not any(l.split()[1].rstrip('?[]') == n for n in models)}
    have_cols = {c for (t, c) in cols if t == m}
    if want_cols != have_cols: errs.append(f'{m}: column set differs schema-only={want_cols-have_cols} db-only={have_cols-want_cols}')
if fk_sc != fk_db: errs.append(f'FK differ: schema-only={sorted(fk_sc-fk_db)} db-only={sorted(fk_db-fk_sc)}')
if idx_sc != idx_db: errs.append(f'index differ: schema-only={sorted(idx_sc-idx_db)} db-only={sorted(idx_db-idx_sc)}')
db_enums = {t: [v for (v,) in q(f"select enumlabel from pg_enum e join pg_type t on t.oid=e.enumtypid where t.typname='{t}' order by enumsortorder")] for t in enums}
for e, v in enums.items():
    if db_enums[e] != v: errs.append(f'enum {e}: {db_enums[e]} != {v}')
print(json.dumps({'tables': len(tables), 'fks': len(fk_db), 'indexes': len(idx_db), 'enums': len(enums), 'errors': errs}, indent=1, ensure_ascii=False))
sys.exit(1 if errs else 0)
