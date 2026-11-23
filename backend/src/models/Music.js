import { query } from '../config/database.js';

export default class Music {
  static async create({ sessionId, playerId, title, artist, filePath, coverUrl, fileSize = 0 }) {
    const result = await query(
      `INSERT INTO musics (session_id, player_id, title, artist, file_path, cover_url, file_size)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [sessionId, playerId, title, artist, filePath, coverUrl, fileSize]
    );
    return result.rows[0];
  }

  static async findBySession(sessionId) {
    const result = await query('SELECT * FROM musics WHERE session_id = $1 ORDER BY created_at ASC', [sessionId]);
    return result.rows;
  }

  static async findById(musicId, sessionId = null) {
    const result = sessionId === null
      ? await query('SELECT * FROM musics WHERE id = $1', [musicId])
      : await query('SELECT * FROM musics WHERE id = $1 AND session_id = $2', [musicId, sessionId]);
    return result.rows[0] || null;
  }

  static async findByPlayer(playerId, sessionId) {
    const result = await query(
      'SELECT * FROM musics WHERE player_id = $1 AND session_id = $2 ORDER BY created_at ASC',
      [playerId, sessionId]
    );
    return result.rows;
  }

  static async deleteMusic(musicId, sessionId, playerId) {
    const result = await query(
      'DELETE FROM musics WHERE id = $1 AND session_id = $2 AND player_id = $3 RETURNING *',
      [musicId, sessionId, playerId]
    );
    return result.rows[0] || null;
  }

  static async updatePlayOrder(musicId, playOrder) {
    const result = await query(
      'UPDATE musics SET play_order = $1 WHERE id = $2 RETURNING *',
      [playOrder, musicId]
    );
    return result.rows[0] || null;
  }

  static async deleteAllBySession(sessionId) {
    const result = await query('DELETE FROM musics WHERE session_id = $1 RETURNING *', [sessionId]);
    return result.rows;
  }

  static async sumFileSizeByPlayer(playerId, sessionId) {
    const result = await query(
      `SELECT COALESCE(SUM(file_size), 0)::BIGINT AS total
       FROM musics WHERE player_id = $1 AND session_id = $2`,
      [playerId, sessionId]
    );
    return Number(result.rows[0].total);
  }

  static async sumFileSizeBySession(sessionId) {
    const result = await query(
      'SELECT COALESCE(SUM(file_size), 0)::BIGINT AS total FROM musics WHERE session_id = $1',
      [sessionId]
    );
    return Number(result.rows[0].total);
  }

  static async sumFileSizeGlobal() {
    const result = await query('SELECT COALESCE(SUM(file_size), 0)::BIGINT AS total FROM musics');
    return Number(result.rows[0].total);
  }

  static async listLocalUploadPaths() {
    const result = await query("SELECT file_path FROM musics WHERE file_path LIKE '/uploads/%'");
    return result.rows.map((row) => row.file_path);
  }
}
