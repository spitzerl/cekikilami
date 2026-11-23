import { query } from '../config/database.js';
import { generateAvatarSeed } from '../security/tokens.js';

const SAFE_COLUMNS = `id, session_id, name, score, is_bot, is_connected, is_observer, avatar_seed, created_at`;

export default class Player {
  static async create({ sessionId, name, isBot = false, tokenHash = null, avatarSeed = null }) {
    const seed = avatarSeed || generateAvatarSeed();
    const result = await query(
      `INSERT INTO players (session_id, name, score, is_bot, is_connected, is_observer, avatar_seed, token_hash)
       VALUES ($1, $2, 0, $3, TRUE, FALSE, $4, $5)
       RETURNING ${SAFE_COLUMNS}`,
      [sessionId, name, isBot, seed, tokenHash]
    );
    return result.rows[0];
  }

  static async findBySession(sessionId) {
    const result = await query(
      `SELECT ${SAFE_COLUMNS} FROM players WHERE session_id = $1 ORDER BY created_at ASC`,
      [sessionId]
    );
    return result.rows;
  }

  static async findById(playerId, sessionId = null) {
    const result = sessionId === null
      ? await query(`SELECT ${SAFE_COLUMNS} FROM players WHERE id = $1`, [playerId])
      : await query(`SELECT ${SAFE_COLUMNS} FROM players WHERE id = $1 AND session_id = $2`, [playerId, sessionId]);
    return result.rows[0] || null;
  }

  static async findByTokenHash(tokenHash) {
    const result = await query(
      `SELECT ${SAFE_COLUMNS} FROM players WHERE token_hash = $1`,
      [tokenHash]
    );
    return result.rows[0] || null;
  }

  static async findBySessionAndNameWithToken(sessionId, name) {
    const result = await query(
      `SELECT ${SAFE_COLUMNS}, token_hash
       FROM players
       WHERE session_id = $1 AND LOWER(name) = LOWER($2)
       ORDER BY created_at ASC
       LIMIT 1`,
      [sessionId, name]
    );
    return result.rows[0] || null;
  }

  static async setTokenHash(playerId, tokenHash, sessionId = null) {
    const result = sessionId === null
      ? await query('UPDATE players SET token_hash = $1 WHERE id = $2 RETURNING id', [tokenHash, playerId])
      : await query('UPDATE players SET token_hash = $1 WHERE id = $2 AND session_id = $3 RETURNING id', [tokenHash, playerId, sessionId]);
    return result.rows[0] || null;
  }

  static async incrementScore(playerId, delta) {
    const result = await query(
      `UPDATE players SET score = score + $1 WHERE id = $2 RETURNING ${SAFE_COLUMNS}`,
      [delta, playerId]
    );
    return result.rows[0] || null;
  }

  static async updateConnectionStatus(playerId, isConnected, sessionId = null) {
    const result = sessionId === null
      ? await query(
        `UPDATE players SET is_connected = $1 WHERE id = $2 RETURNING ${SAFE_COLUMNS}`,
        [isConnected, playerId]
      )
      : await query(
        `UPDATE players SET is_connected = $1 WHERE id = $2 AND session_id = $3 RETURNING ${SAFE_COLUMNS}`,
        [isConnected, playerId, sessionId]
      );
    return result.rows[0] || null;
  }

  static async setObserver(playerId, isObserver, sessionId = null) {
    const result = sessionId === null
      ? await query(
        `UPDATE players SET is_observer = $1 WHERE id = $2 RETURNING ${SAFE_COLUMNS}`,
        [isObserver, playerId]
      )
      : await query(
        `UPDATE players SET is_observer = $1 WHERE id = $2 AND session_id = $3 RETURNING ${SAFE_COLUMNS}`,
        [isObserver, playerId, sessionId]
      );
    return result.rows[0] || null;
  }

  static async resetScoresAndStatusBySession(sessionId) {
    const result = await query(
      `UPDATE players
       SET score = 0, is_observer = FALSE
       WHERE session_id = $1 RETURNING ${SAFE_COLUMNS}`,
      [sessionId]
    );
    return result.rows;
  }

  static async updateAvatarSeed(playerId, seed, sessionId = null) {
    const result = sessionId === null
      ? await query(
        `UPDATE players SET avatar_seed = $1 WHERE id = $2 RETURNING ${SAFE_COLUMNS}`,
        [seed, playerId]
      )
      : await query(
        `UPDATE players SET avatar_seed = $1 WHERE id = $2 AND session_id = $3 RETURNING ${SAFE_COLUMNS}`,
        [seed, playerId, sessionId]
      );
    return result.rows[0] || null;
  }

  static async deletePlayer(playerId, sessionId = null) {
    const result = sessionId === null
      ? await query(`DELETE FROM players WHERE id = $1 RETURNING ${SAFE_COLUMNS}`, [playerId])
      : await query(`DELETE FROM players WHERE id = $1 AND session_id = $2 RETURNING ${SAFE_COLUMNS}`, [playerId, sessionId]);
    return result.rows[0] || null;
  }

  static async markAllDisconnected() {
    await query('UPDATE players SET is_connected = FALSE WHERE is_connected = TRUE');
  }

  static async countBySession(sessionId) {
    const result = await query(
      'SELECT COUNT(*)::INTEGER AS count FROM players WHERE session_id = $1',
      [sessionId]
    );
    return result.rows[0].count;
  }
}
