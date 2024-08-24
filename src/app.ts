import { request } from 'undici'
import { fetchKitsu } from '@/utils'

const JIKAN_BASE_URL = 'https://api.jikan.moe/v4'

export type Anime = {
  slug: string
  name: string
  image: string
}

type Base = {
  data: Data
}

type Data = {
  title: string
  images: {
    jpg: {
      large_image_url: string
    }
  }
}

export const getRandomAnime = async (): Promise<Anime | undefined> => {
  let anime: Anime
  try {
    const { statusCode, body } = await request(`${JIKAN_BASE_URL}/random/anime`)

    if (statusCode !== 200) {
      return
    }

    const base = (await body.json()) as Base
    const data = base.data

    const kitsu = await fetchKitsu(data.title)

    if (!kitsu) {
      return
    }

    anime = {
      slug: kitsu.slug,
      name: kitsu.titles.en
        ? kitsu.titles.en
        : kitsu.titles.en_jp
        ? kitsu.titles.en_jp
        : data.title,
      image: kitsu.posterImage
        ? kitsu.posterImage.large
          ? kitsu.posterImage.large
          : data.images.jpg.large_image_url
        : data.images.jpg.large_image_url,
    }
  } catch (err) {
    throw new Error(`Resource couldn't be fetched: ${err}`)
  }

  if (!anime) {
    return
  }

  return anime
}
