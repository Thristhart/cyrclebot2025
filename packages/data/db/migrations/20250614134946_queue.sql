-- migrate:up
create table media_objects (
    id INTEGER UNIQUE NOT NULL PRIMARY KEY,
    url TEXT NOT NULL,
    title TEXT,
    image_url TEXT,
    playback_position_ms INTEGER,
    duration_ms INTEGER,
    sort_key TEXT,


    channel_id TEXT,
    server_id TEXT
);

-- migrate:down

drop table media_objects;