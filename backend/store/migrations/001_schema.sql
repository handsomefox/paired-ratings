-- +goose Up
CREATE TABLE shows (
	id INTEGER PRIMARY KEY AUTOINCREMENT,
	tmdb_id INTEGER NOT NULL,
	media_type TEXT NOT NULL CHECK (media_type IN ('movie', 'tv')),
	title TEXT NOT NULL,
	year INTEGER,
	overview TEXT,
	poster_path TEXT,
	imdb_id TEXT,
	tmdb_rating REAL,
	tmdb_votes INTEGER,
	collection_id INTEGER,
	collection_name TEXT,
	status TEXT NOT NULL CHECK (status IN ('planned', 'watching', 'watched')),
	watch_priority INTEGER,
	bf_rating INTEGER CHECK (bf_rating BETWEEN 1 AND 10),
	gf_rating INTEGER CHECK (gf_rating BETWEEN 1 AND 10),
	bf_comment TEXT,
	gf_comment TEXT,
	created_at TEXT NOT NULL,
	-- updated_at moves when a person edits the show, never on a TMDB refresh.
	updated_at TEXT NOT NULL,
	-- tmdb_refreshed_at is when TMDB metadata was last pulled.
	tmdb_refreshed_at TEXT NOT NULL,
	UNIQUE (tmdb_id, media_type)
) STRICT;

CREATE INDEX shows_status ON shows (status);
CREATE INDEX shows_tmdb_refreshed_at ON shows (tmdb_refreshed_at);
CREATE INDEX shows_watch_priority ON shows (watch_priority) WHERE watch_priority IS NOT NULL;

-- position keeps the order TMDB lists the genres in.
CREATE TABLE show_genres (
	show_id INTEGER NOT NULL REFERENCES shows (id) ON DELETE CASCADE,
	position INTEGER NOT NULL,
	name TEXT NOT NULL,
	PRIMARY KEY (show_id, position),
	UNIQUE (show_id, name)
) STRICT, WITHOUT ROWID;

CREATE INDEX show_genres_name ON show_genres (name);

-- position keeps the order TMDB lists the countries in. The first is primary.
CREATE TABLE show_countries (
	show_id INTEGER NOT NULL REFERENCES shows (id) ON DELETE CASCADE,
	position INTEGER NOT NULL,
	code TEXT NOT NULL CHECK (length(code) = 2 AND code = upper(code)),
	PRIMARY KEY (show_id, position),
	UNIQUE (show_id, code)
) STRICT, WITHOUT ROWID;

CREATE INDEX show_countries_code ON show_countries (code);

CREATE TABLE episodes (
	id INTEGER PRIMARY KEY AUTOINCREMENT,
	show_id INTEGER NOT NULL REFERENCES shows (id) ON DELETE CASCADE,
	season_number INTEGER NOT NULL,
	episode_number INTEGER NOT NULL,
	title TEXT,
	air_date TEXT,
	runtime INTEGER,
	watched INTEGER NOT NULL DEFAULT 0 CHECK (watched IN (0, 1)),
	updated_at TEXT NOT NULL,
	UNIQUE (show_id, season_number, episode_number)
) STRICT;

-- +goose Down
DROP TABLE episodes;
DROP TABLE show_countries;
DROP TABLE show_genres;
DROP TABLE shows;
