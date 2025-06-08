-- migrate:up
create table users (
    id INTEGER UNIQUE NOT NULL PRIMARY KEY,
    discord_id TEXT UNIQUE NOT NULL,
    discord_username TEXT,
    avatar TEXT
);

-- migrate:down
drop table users;