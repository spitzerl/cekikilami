export async function initSchema(pool) {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS sessions (
      id SERIAL PRIMARY KEY,
      code VARCHAR(6) UNIQUE NOT NULL,
      host_name VARCHAR(100) NOT NULL,
      host_player_id INTEGER,
      phase VARCHAR(20) NOT NULL DEFAULT 'waiting',
      current_music_index INTEGER DEFAULT -1,
      voting_status VARCHAR(20) DEFAULT 'idle',
      timer_ends_at TIMESTAMP,
      expires_at TIMESTAMP,
      max_musics_per_player INTEGER DEFAULT 3,
      selection_duration INTEGER DEFAULT 120,
      extract_duration INTEGER DEFAULT 20,
      voting_duration INTEGER DEFAULT 30,
      show_answers BOOLEAN DEFAULT TRUE,
      max_players INTEGER DEFAULT 12,
      auto_advance BOOLEAN DEFAULT FALSE,
      show_vote_count BOOLEAN DEFAULT TRUE,
      enable_blind_test BOOLEAN DEFAULT FALSE,
      created_at TIMESTAMP NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMP NOT NULL DEFAULT NOW()
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS players (
      id SERIAL PRIMARY KEY,
      session_id INTEGER NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
      name VARCHAR(100) NOT NULL,
      score INTEGER NOT NULL DEFAULT 0,
      is_connected BOOLEAN NOT NULL DEFAULT TRUE,
      is_bot BOOLEAN NOT NULL DEFAULT FALSE,
      is_observer BOOLEAN NOT NULL DEFAULT FALSE,
      avatar_seed VARCHAR(255),
      token_hash VARCHAR(64),
      created_at TIMESTAMP NOT NULL DEFAULT NOW()
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS musics (
      id SERIAL PRIMARY KEY,
      session_id INTEGER NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
      player_id INTEGER NOT NULL REFERENCES players(id) ON DELETE CASCADE,
      title VARCHAR(255) NOT NULL,
      artist VARCHAR(255) NOT NULL,
      file_path TEXT NOT NULL,
      file_size BIGINT NOT NULL DEFAULT 0,
      cover_url TEXT,
      play_order INTEGER DEFAULT -1,
      blind_test_options JSONB,
      created_at TIMESTAMP NOT NULL DEFAULT NOW()
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS votes (
      id SERIAL PRIMARY KEY,
      session_id INTEGER NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
      voter_id INTEGER NOT NULL REFERENCES players(id) ON DELETE CASCADE,
      music_id INTEGER NOT NULL REFERENCES musics(id) ON DELETE CASCADE,
      guessed_player_id INTEGER NOT NULL REFERENCES players(id) ON DELETE CASCADE,
      created_at TIMESTAMP NOT NULL DEFAULT NOW(),
      UNIQUE (session_id, voter_id, music_id)
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS blind_test_answers (
      id SERIAL PRIMARY KEY,
      session_id INTEGER NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
      player_id INTEGER NOT NULL REFERENCES players(id) ON DELETE CASCADE,
      music_id INTEGER NOT NULL REFERENCES musics(id) ON DELETE CASCADE,
      answer_title VARCHAR(255) NOT NULL,
      answer_artist VARCHAR(255) NOT NULL,
      is_correct BOOLEAN NOT NULL DEFAULT FALSE,
      created_at TIMESTAMP NOT NULL DEFAULT NOW(),
      UNIQUE (session_id, player_id, music_id)
    )
  `);

  // These ALTER statements keep existing development volumes usable.
  await pool.query(`
    ALTER TABLE sessions
    ADD COLUMN IF NOT EXISTS max_musics_per_player INTEGER DEFAULT 3,
    ADD COLUMN IF NOT EXISTS selection_duration INTEGER DEFAULT 120,
    ADD COLUMN IF NOT EXISTS extract_duration INTEGER DEFAULT 20,
    ADD COLUMN IF NOT EXISTS voting_duration INTEGER DEFAULT 30,
    ADD COLUMN IF NOT EXISTS show_answers BOOLEAN DEFAULT TRUE,
    ADD COLUMN IF NOT EXISTS max_players INTEGER DEFAULT 12,
    ADD COLUMN IF NOT EXISTS current_music_index INTEGER DEFAULT -1,
    ADD COLUMN IF NOT EXISTS voting_status VARCHAR(20) DEFAULT 'idle',
    ADD COLUMN IF NOT EXISTS timer_ends_at TIMESTAMP,
    ADD COLUMN IF NOT EXISTS auto_advance BOOLEAN DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS show_vote_count BOOLEAN DEFAULT TRUE,
    ADD COLUMN IF NOT EXISTS enable_blind_test BOOLEAN DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS host_player_id INTEGER,
    ADD COLUMN IF NOT EXISTS expires_at TIMESTAMP
  `);

  await pool.query(`
    ALTER TABLE players
    ADD COLUMN IF NOT EXISTS is_connected BOOLEAN DEFAULT TRUE,
    ADD COLUMN IF NOT EXISTS is_bot BOOLEAN DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS is_observer BOOLEAN DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS avatar_seed VARCHAR(255),
    ADD COLUMN IF NOT EXISTS token_hash VARCHAR(64)
  `);

  await pool.query(`
    ALTER TABLE musics
    ADD COLUMN IF NOT EXISTS play_order INTEGER DEFAULT -1,
    ADD COLUMN IF NOT EXISTS cover_url TEXT,
    ADD COLUMN IF NOT EXISTS blind_test_options JSONB,
    ADD COLUMN IF NOT EXISTS file_size BIGINT DEFAULT 0
  `);

  await pool.query(`
    UPDATE sessions
    SET expires_at = COALESCE(expires_at, updated_at + INTERVAL '24 hours')
    WHERE expires_at IS NULL
  `);

  await pool.query(`
    UPDATE sessions s
    SET host_player_id = p.id
    FROM players p
    WHERE p.session_id = s.id
      AND p.name = s.host_name
      AND s.host_player_id IS NULL
  `);

  // Clamp configuration left behind by older, less strict versions.
  await pool.query(`
    UPDATE sessions
    SET max_players = LEAST(GREATEST(COALESCE(max_players, 12), 4), 16),
        max_musics_per_player = LEAST(GREATEST(COALESCE(max_musics_per_player, 3), 1), 5),
        selection_duration = LEAST(GREATEST(COALESCE(selection_duration, 120), 30), 300),
        extract_duration = LEAST(GREATEST(COALESCE(extract_duration, 20), 10), 30),
        voting_duration = LEAST(GREATEST(COALESCE(voting_duration, 30), 20), 60)
  `);

  await pool.query('CREATE INDEX IF NOT EXISTS sessions_phase_timer_idx ON sessions (phase, timer_ends_at)');
  await pool.query('CREATE INDEX IF NOT EXISTS sessions_expires_at_idx ON sessions (expires_at)');
  await pool.query('CREATE INDEX IF NOT EXISTS players_session_id_idx ON players (session_id)');
  await pool.query('CREATE INDEX IF NOT EXISTS players_token_hash_idx ON players (token_hash)');
  await pool.query(
    'CREATE UNIQUE INDEX IF NOT EXISTS players_token_hash_unique ON players (token_hash) WHERE token_hash IS NOT NULL'
  );
  await pool.query('CREATE INDEX IF NOT EXISTS musics_session_id_idx ON musics (session_id)');
  await pool.query('CREATE INDEX IF NOT EXISTS votes_session_id_idx ON votes (session_id)');
  await pool.query('CREATE INDEX IF NOT EXISTS blind_test_answers_session_id_idx ON blind_test_answers (session_id)');

  try {
    await pool.query(
      'CREATE UNIQUE INDEX IF NOT EXISTS players_session_name_unique ON players (session_id, LOWER(name))'
    );
  } catch (error) {
    if (error.code !== '23505') throw error;
    console.warn('Duplicate player names exist; the per-session unique name index was not created.');
  }
}
