import { youtube_v3 } from "@googleapis/youtube";
import { parse, toSeconds } from "iso8601-duration";
import assert from "node:assert";
import { MediaObjectDBO } from "../data/model";

assert(process.env.YOUTUBE_API_KEY, "Must specify YOUTUBE_API_KEY");

const youtube = new youtube_v3.Youtube({
  auth: process.env.YOUTUBE_API_KEY,
});

const YOUTUBE_URL_REGEX =
  /(?:https?:\/\/)?(?:www\.)?(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|watch\?.+&v=))((\w|-){11})(?:\S+)?/;
const YOUTUBE_PLAYLIST_REGEX = /.*(?:youtube.be\/|list=)([^#\&\?<]*)/;

export function getIdFromYoutubeURL(url: string) {
  return url.match(
    /^.*(?:(?:youtu\.be\/|v\/|vi\/|u\/\w\/|embed\/)|(?:(?:watch)?\?v(?:i)?=|\&v(?:i)?=))([^#\&\?]*).*/
  )![1];
}

type MediaObject = Partial<MediaObjectDBO> & { url: string };

function mapYoutubeDataToMediaObject(
  url: string,
  start_time: number,
  video: youtube_v3.Schema$Video | youtube_v3.Schema$PlaylistItem
): MediaObject {
  let duration_ms: number | null = null;
  let title: string | null = null;
  let image_url: string | null = null;
  if (video.contentDetails && "duration" in video.contentDetails) {
    const durationString = video.contentDetails.duration;
    if (durationString) {
      duration_ms = toSeconds(parse(durationString)) * 1000;
    }
  }
  title = video.snippet?.title ?? null;
  const thumbnails = video.snippet?.thumbnails;
  if (thumbnails) {
    const thumbnailToUse =
      thumbnails.high ||
      thumbnails.standard ||
      thumbnails.medium ||
      thumbnails.default;
    image_url = thumbnailToUse?.url ?? null;
  }

  return {
    url,
    playback_position_ms: start_time,
    duration_ms,
    title,
    image_url,
  } as const;
}

export async function getMediaObjectsFromYoutubeURL(url: string) {
  if (url.match(YOUTUBE_URL_REGEX)) {
    const parsedUrl = URL.parse(url);
    let start_time = 0;
    if (parsedUrl?.search) {
      const params = parsedUrl.searchParams;
      const t = params.get("t");
      if (t) {
        const hoursMatch = t.match(/(\d*)h/);
        if (hoursMatch) {
          start_time += parseInt(hoursMatch[1]) * 60 * 60;
        }
        const minutesMatch = t.match(/(\d*)m/);
        if (minutesMatch) {
          start_time += parseInt(minutesMatch[1]) * 60;
        }
        const secondsMatch = t.match(/(\d*)s/);
        if (secondsMatch) {
          start_time += parseInt(secondsMatch[1]);
        }
        if (!(hoursMatch || minutesMatch || secondsMatch)) {
          // none of the previous matched so this must just be a number of seconds
          start_time = parseInt(t);
        }
      }
    }
    const id = getIdFromYoutubeURL(url);
    const youtubeMetadata = await youtube.videos.list({
      id: [id],
      part: ["snippet", "contentDetails"],
    });
    const items = youtubeMetadata.data.items;
    if (items && items.length > 0) {
      return items.map((item) =>
        mapYoutubeDataToMediaObject(
          `https://www.youtube.com/watch?v=${id}`,
          start_time,
          item
        )
      );
    }
  } else {
    const playlistMatch = url.match(YOUTUBE_PLAYLIST_REGEX);
    if (playlistMatch) {
      const playlistId = playlistMatch[1];
      if (playlistId) {
        const items: MediaObject[] = [];
        let nextPageToken: string | undefined;
        do {
          const page = await youtube.playlistItems.list({
            part: ["snippet", "contentDetails"],
            maxResults: 50,
            playlistId,
            pageToken: nextPageToken,
          });
          nextPageToken = page.data.nextPageToken || undefined;
          page.data.items?.forEach((video) => {
            if (video.contentDetails?.videoId) {
              items.push(
                mapYoutubeDataToMediaObject(
                  `https://www.youtube.com/watch?v=${video.contentDetails.videoId}`,
                  0,
                  video
                )
              );
            }
          });
        } while (nextPageToken);

        return items;
      }
    }
  }
  return [];
}
