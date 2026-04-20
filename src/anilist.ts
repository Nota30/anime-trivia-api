import { request } from 'undici'

const ANILIST_URL = 'https://graphql.anilist.co'

// Keep this query tight. We only need the fields we actually use.
// idMal lets us join directly from Jikan's mal_id, so there's no
// fuzzy name matching like Kitsu needs.
const QUERY = `
  query ($malId: Int) {
    Media(idMal: $malId, type: ANIME) {
      title {
        english
        romaji
      }
      coverImage {
        extraLarge
        large
      }
    }
  }
`

export type AniListMedia = {
  title?: {
    english?: string | null
    romaji?: string | null
  }
  coverImage?: {
    extraLarge?: string | null
    large?: string | null
  }
}

type AniListResponse = {
  data?: {
    Media?: AniListMedia | null
  }
}

// Best-effort fetch. Returns undefined on any failure so it
// can fall back to other sources without throwing a 500 in your face.
export const fetchAniList = async (
  malId: number
): Promise<AniListMedia | undefined> => {
  try {
    const { statusCode, body } = await request(ANILIST_URL, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        accept: 'application/json',
      },
      body: JSON.stringify({
        query: QUERY,
        variables: { malId },
      }),
    })

    if (statusCode !== 200) {
      return
    }

    const json = (await body.json()) as AniListResponse
    return json.data?.Media ?? undefined
  } catch {
    return
  }
}