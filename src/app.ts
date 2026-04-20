/* eslint-disable curly */
import { request } from 'undici'
import { fetchKitsu } from './utils.js'
import { fetchAniList } from './anilist.js'

const JIKAN_BASE_URL = 'https://api.jikan.moe/v4'

export type Anime = {
  slug: string
  name: string
  image: string
}

type Base = {
  data: Data
}

type Genre = {
  name: string
}

type Data = {
  mal_id: number
  title: string
  title_english?: string | null
  title_japanese?: string | null
  title_synonyms?: string[] | null
  rating?: string | null
  genres?: Genre[]
  explicit_genres?: Genre[]
  images: {
    jpg: {
      large_image_url: string
    }
    webp?: {
      large_image_url?: string
    }
  }
}

// Skip anything hentai, ecchi, or R+ since the bot runs in a general server.
const BLOCKED_RATING_PREFIXES = ['Rx', 'R+']
const BLOCKED_GENRES = new Set(['Hentai', 'Erotica', 'Ecchi'])

const isNsfw = (data: Data): boolean => {
  if (data.rating) {
    for (const prefix of BLOCKED_RATING_PREFIXES) {
      if (data.rating.startsWith(prefix)) return true
    }
  }
  const all = [...(data.genres ?? []), ...(data.explicit_genres ?? [])]
  for (const g of all) {
    if (BLOCKED_GENRES.has(g.name)) return true
  }
  return false
}

// Junk at the end of titles that makes hints impossible to guess.
// "Mahou Shoujo ni Akogarete 2nd Season" becomes "Mahou Shoujo ni Akogarete".
// It's still the right show, just shorter.
const SUFFIX_PATTERNS: RegExp[] = [
  /\s+\d+(st|nd|rd|th)\s+Season\b.*$/i, // "2nd Season", "3rd Season"
  /\s+Season\s+\d+\b.*$/i,              // "Season 2"
  /\s+Part\s+(\d+|II|III|IV|V|VI)\b.*$/i, // "Part II", "Part 2"
  /\s+Final\s+Season\b.*$/i,
  /\s+Cour\s+\d+\b.*$/i,
  /\s*\((TV|ONA|OVA|\d{4})\)\s*$/i,     // "(TV)" or "(2024)"
]

const normalizeName = (name: string): string => {
  let out = name
  for (const pattern of SUFFIX_PATTERNS) {
    out = out.replace(pattern, '')
  }
  // After cutting the suffix, clean up anything weird hanging off the end
  // like a colon or "The". Example: "Attack on Titan: The Final Season"
  // loses "Final Season" and then loses ": The".
  out = out.replace(/[\s:;,\-–—]+(The|A|An)?\s*$/i, '')
  return out.replace(/\s+/g, ' ').trim()
}

// 40 characters is about as long as a guessable hint can be.
// If nothing fits, we use the shortest option anyway.
const MAX_NAME_LENGTH = 40

// Pick the best name from the options. English usually wins since it's
// shorter and more recognizable, but a 72-char English title loses to a
// 32-char romaji. If every option is too long, just grab the shortest.
const pickName = (candidates: (string | null | undefined)[]): string => {
  const normalized: string[] = []
  for (const c of candidates) {
    if (!c) continue
    const n = normalizeName(c)
    if (n) normalized.push(n)
  }

  if (normalized.length === 0) return 'Unknown'

  const fit = normalized.find((n) => n.length <= MAX_NAME_LENGTH)
  if (fit) return fit

  return normalized.reduce((a, b) => (a.length <= b.length ? a : b))
}

const pickImage = (
  ...urls: (string | null | undefined)[]
): string | undefined => {
  for (const u of urls) {
    if (u && u.trim()) return u
  }
  return
}

// Lowercase and drop anything that isn't a letter or number. Lets us
// compare names written slightly differently, like "Re:Zero" vs "Re Zero".
const normalizeForCompare = (s: string): string =>
  s.toLowerCase().replace(/[^a-z0-9]+/g, '')

// Kitsu's search is just a text search. If we ask for an obscure show
// it might send back a completely different anime that shares a word.
// Before trusting Kitsu's slug, make sure at least one of its titles
// actually matches what Jikan says the show is called.
const verifyKitsuMatch = (
  kitsuTitles: { en?: string; en_jp?: string } | undefined,
  jikanTitles: (string | null | undefined)[]
): boolean => {
  if (!kitsuTitles) return false

  const kitsu: string[] = []
  for (const t of [kitsuTitles.en, kitsuTitles.en_jp]) {
    if (!t) continue
    const n = normalizeForCompare(t)
    if (n) kitsu.push(n)
  }
  if (kitsu.length === 0) return false

  for (const jt of jikanTitles) {
    if (!jt) continue
    const jn = normalizeForCompare(jt)
    if (!jn) continue
    for (const kn of kitsu) {
      if (kn === jn) return true
      // Count it as a match if one title contains the other (covers cases
      // where one site has a shorter version). Needs to be at least 6
      // characters so tiny words like "no" or "the" don't trip it up.
      if (kn.length >= 6 && jn.includes(kn)) return true
      if (jn.length >= 6 && kn.includes(jn)) return true
    }
  }
  return false
}

// If Kitsu doesn't find the show, make our own slug from the name.
// Same shape as Kitsu's so the bot can't tell the difference.
const generateSlug = (name: string): string => {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

// Try up to 5 times if we keep getting NSFW results. Don't loop forever
// in case something's broken on Jikan's end.
const MAX_ROLL_ATTEMPTS = 5

export const getRandomAnime = async (): Promise<Anime | undefined> => {
  try {
    for (let attempt = 0; attempt < MAX_ROLL_ATTEMPTS; attempt++) {
      const { statusCode, body } = await request(`${JIKAN_BASE_URL}/random/anime`)

      if (statusCode !== 200) {
        return
      }

      const base = (await body.json()) as Base
      const data = base.data

      if (isNsfw(data)) continue

      // Hit AniList and Kitsu at the same time instead of one after the
      // other. If either one fails we can still work with what we have.
      const [anilist, kitsu] = await Promise.all([
        fetchAniList(data.mal_id),
        fetchKitsu(data.title).catch(() => undefined),
      ])

      const name = pickName([
        anilist?.title?.english,
        data.title_english,
        anilist?.title?.romaji,
        data.title,
      ])

      // Only use Kitsu's slug if its titles actually match Jikan's.
      // Otherwise make our own from the name we picked.
      const kitsuMatches = verifyKitsuMatch(kitsu?.titles, [
        data.title,
        data.title_english,
        data.title_japanese,
        ...(data.title_synonyms ?? []),
      ])

      // AniList and Jikan are both tied to the MAL entry we fetched,
      // so their images are guaranteed to be the right show. Kitsu's
      // fuzzy search means its image can belong to a different anime
      // even when the titles happen to line up, so we don't use it.
      const image = pickImage(
        anilist?.coverImage?.extraLarge,
        anilist?.coverImage?.large,
        data.images.webp?.large_image_url,
        data.images.jpg.large_image_url
      )

      if (!image) continue

      return {
        slug: kitsuMatches && kitsu?.slug ? kitsu.slug : generateSlug(name),
        name,
        image,
      }
    }

    // Hit the cap without finding anything safe. index.ts will 404.
    return
  } catch (err) {
    throw new Error(`Resource couldn't be fetched: ${err}`)
  }
}