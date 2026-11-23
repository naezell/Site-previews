import { DatabaseSync } from 'node:sqlite';
import { readdirSync, readFileSync } from 'node:fs';

export function sqlite() {
  const db = new DatabaseSync(':memory:');
  const migrations = new URL('../migrations/',import.meta.url);
  for (const file of readdirSync(migrations).filter(name => name.endsWith('.sql')).sort()) {
    db.exec(readFileSync(new URL(file,migrations),'utf8'));
  }
  const bind = value => value instanceof ArrayBuffer ? new Uint8Array(value) : value;
  const prepare = sql => ({
    bind: (...raw) => {
      const values = raw.map(bind);
      const statement = db.prepare(sql);
      return {
        first: async () => statement.get(...values) || null,
        all: async () => ({ results:statement.all(...values) }),
        run: async () => ({ meta:statement.run(...values) })
      };
    }
  });
  return { db, binding:{ prepare, async batch(list) {
    db.exec('BEGIN');
    try {
      const results = [];
      for (const statement of list) results.push(await statement.run());
      db.exec('COMMIT');
      return results;
    } catch (error) {
      db.exec('ROLLBACK');
      throw error;
    }
  } } };
}
