import { generateKeyBetween } from "fractional-indexing";
import { database } from "./database";
import { MediaObjectDBO, WriteMediaObjectDBO } from "./model";

export function getQueue() {
  const statement = database.prepare("SELECT * FROM media_objects");
  return statement.all() as Array<MediaObjectDBO>;
}

export function getQueueForServer(server_id: string) {
  const statement = database.prepare(
    "SELECT * FROM media_objects WHERE server_id=?"
  );
  return statement.all(server_id) as Array<MediaObjectDBO>;
}
function getLastInQueue() {
  const statement = database.prepare(
    "SELECT * FROM media_objects ORDER BY sort_key DESC LIMIT 1"
  );
  return statement.get() as MediaObjectDBO | undefined;
}
function getLastInQueueForServer(server_id: string) {
  const statement = database.prepare(
    "SELECT * FROM media_objects WHERE server_id=? ORDER BY sort_key DESC LIMIT 1"
  );
  return statement.get(server_id) as MediaObjectDBO | undefined;
}
export function removeObjectFromQueue(id: number) {
  const statement = database.prepare("DELETE FROM media_objects WHERE id=?");
  return statement.run(id);
}
export function clearQueueForServer(server_id: string) {
  const statement = database.prepare(
    "DELETE FROM media_objects WHERE server_id=?"
  );
  return statement.run(server_id);
}
export function updateObjectPlaybackPosition(
  id: number,
  playback_position_ms: number
) {
  const statement = database.prepare<Partial<MediaObjectDBO>>(
    "UPDATE media_objects SET playback_position_ms=@playback_position_ms WHERE id=@id"
  );
  statement.run({
    id,
    playback_position_ms,
  });
}
export function addToEndOfQueue(mediaObject: WriteMediaObjectDBO) {
  const last = mediaObject.server_id
    ? getLastInQueueForServer(mediaObject.server_id)
    : getLastInQueue();
  const nextKey = generateKeyBetween(last?.sort_key, null);
  const statement = database.prepare<WriteMediaObjectDBO>(
    `INSERT into media_objects 
    (
        channel_id,
        duration_ms,
        id,
        image_url,
        playback_position_ms,
        server_id,
        sort_key,
        title,
        url
    )
    VALUES (
        @channel_id,
        @duration_ms,
        @id,
        @image_url,
        @playback_position_ms,
        @server_id,
        @sort_key,
        @title,
        @url
    )`
  );
  statement.run({
    channel_id: mediaObject.channel_id,
    duration_ms: mediaObject.duration_ms,
    id: mediaObject.id,
    image_url: mediaObject.image_url,
    playback_position_ms: mediaObject.playback_position_ms,
    server_id: mediaObject.server_id,
    sort_key: nextKey,
    title: mediaObject.title,
    url: mediaObject.url,
  });
}
