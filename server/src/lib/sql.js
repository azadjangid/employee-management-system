/**
 * Build "col1 = $1, col2 = $2" from an object of { column: value },
 * skipping undefined values. Returns { sets, values }.
 */
export function buildUpdate(fields, startIndex = 1) {
  const sets = [];
  const values = [];
  for (const [column, value] of Object.entries(fields)) {
    if (value === undefined) continue;
    values.push(value);
    sets.push(`${column} = $${startIndex + values.length - 1}`);
  }
  return { sets, values };
}

/** Tiny WHERE-clause builder: where.add("status = ?", value) */
export function whereBuilder() {
  const clauses = [];
  const values = [];
  return {
    values,
    add(clause, ...params) {
      let sql = clause;
      for (const p of params) {
        values.push(p);
        sql = sql.replace("?", `$${values.length}`);
      }
      clauses.push(sql);
      return this;
    },
    param(value) {
      values.push(value);
      return `$${values.length}`;
    },
    toString() {
      return clauses.length ? `WHERE ${clauses.join(" AND ")}` : "";
    },
  };
}

/** Turn rows selected with `count(*) OVER () AS total_count` into { data, meta }. */
export function paged(rows, page, limit) {
  const total = rows.length ? Number(rows[0].total_count) : 0;
  return {
    data: rows.map((row) => {
      const rest = { ...row };
      delete rest.total_count;
      return rest;
    }),
    meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
  };
}
