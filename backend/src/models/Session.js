import { query } from '../config/database.js';
import { generateSessionCode } from '../security/tokens.js';
import { SESSION_TTLS } from '../config/game.js';

export default class Session {
  static async create({ code, hostName, ttlSeconds = SESSION_TTLS.waiting }) {
    const result = await query(
      `INSERT INTO sessions (code, host_name, phase, expires_at)
       VALUES ($1, $2, 'waiting', NOW() + ($3 * INTERVAL '1 second'))
       RETURNING *`,
      [code, hostName, ttlSeconds]
    );
    return result.rows[0];
  }

  static async findByCode(code) {
    const result = await query('SELECT * FROM sessions WHERE code = $1', [code]);
    return result.rows[0] || null;
  }

  static async findById(id) {
    const result = await query('SELECT * FROM sessions WHERE id = $1', [id]);
    return result.rows[0] || null;
  }

  static async setHost(code, playerId, hostName = null) {
    const result = await query(
      `UPDATE sessions
       SET host_player_id = $1,
           host_name = COALESCE($3, host_name),
           updated_at = NOW()
       WHERE code = $2
       RETURNING *`,
      [playerId, code, hostName]
    );
    return result.rows[0] || null;
  }

  static async updatePhase(code, phase, ttlSeconds = SESSION_TTLS.waiting) {
    const result = await query(
      `UPDATE sessions
       SET phase = $1,
           expires_at = NOW() + ($3 * INTERVAL '1 second'),
           updated_at = NOW()
       WHERE code = $2
       RETURNING *`,
      [phase, code, ttlSeconds]
    );
    return result.rows[0] || null;
  }

  static async updateConfig(code, { maxMusicsPerPlayer, selectionDuration, extractDuration, votingDuration, showAnswers, maxPlayers, autoAdvance, showVoteCount, enableBlindTest }) {
    const result = await query(
      `UPDATE sessions
       SET max_musics_per_player = COALESCE($1, max_musics_per_player),
           selection_duration = COALESCE($2, selection_duration),
           extract_duration = COALESCE($3, extract_duration),
           voting_duration = COALESCE($4, voting_duration),
           show_answers = COALESCE($5, show_answers),
           max_players = COALESCE($6, max_players),
           auto_advance = COALESCE($7, auto_advance),
           show_vote_count = COALESCE($8, show_vote_count),
           enable_blind_test = COALESCE($9, enable_blind_test),
           updated_at = NOW()
       WHERE code = $10 RETURNING *`,
      [maxMusicsPerPlayer, selectionDuration, extractDuration, votingDuration, showAnswers, maxPlayers, autoAdvance, showVoteCount, enableBlindTest, code]
    );
    return result.rows[0] || null;
  }

  static async updateVotingState(code, { currentMusicIndex, votingStatus, timerEndsAt }) {
    const result = await query(
      `UPDATE sessions
       SET current_music_index = COALESCE($1, current_music_index),
           voting_status = COALESCE($2, voting_status),
           timer_ends_at = $3,
           updated_at = NOW()
       WHERE code = $4 RETURNING *`,
      [currentMusicIndex, votingStatus, timerEndsAt, code]
    );
    return result.rows[0] || null;
  }

  static async extendExpiry(code, ttlSeconds) {
    await query(
      `UPDATE sessions
       SET expires_at = NOW() + ($2 * INTERVAL '1 second'), updated_at = NOW()
       WHERE code = $1`,
      [code, ttlSeconds]
    );
  }

  static async reset(code, ttlSeconds = SESSION_TTLS.waiting) {
    const result = await query(
      `UPDATE sessions
       SET phase = 'waiting',
           current_music_index = -1,
           voting_status = 'idle',
           timer_ends_at = NULL,
           expires_at = NOW() + ($2 * INTERVAL '1 second'),
           updated_at = NOW()
       WHERE code = $1 RETURNING *`,
      [code, ttlSeconds]
    );
    return result.rows[0] || null;
  }

  static async count() {
    const result = await query('SELECT COUNT(*)::INTEGER AS count FROM sessions');
    return result.rows[0].count;
  }

  static async findExpired(limit = 50) {
    const result = await query(
      `SELECT * FROM sessions
       WHERE expires_at IS NOT NULL AND expires_at < NOW()
       ORDER BY expires_at ASC
       LIMIT $1`,
      [limit]
    );
    return result.rows;
  }

  static async deleteByCode(code) {
    const result = await query('DELETE FROM sessions WHERE code = $1 RETURNING *', [code]);
    return result.rows[0] || null;
  }

  static async generateCode() {
    while (true) {
      const code = generateSessionCode();
      const existing = await Session.findByCode(code);
      if (!existing) {
        return code;
      }
    }
  }
}
