import { pool } from '../config/database';

export abstract class BaseRepository {
  protected db = pool;

  protected withTenantWhere(sql: string) {
    if (!sql.toLowerCase().includes('where')) return `${sql} WHERE loja_id = $1`;
    return `${sql} AND loja_id = $1`;
  }
}
