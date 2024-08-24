import { request } from 'undici'

const KITSU_BASE_URL = 'https://kitsu.app/api/edge'

type Base = {
  data: Data[]
}

type Data = {
  id: string
  type: string
  attributes: Attr
}

type Attr = {
  slug: string
  titles: {
    en?: string
    en_jp?: string
  }
  posterImage?: {
    large?: string
  }
}

export const fetchKitsu = async (name: string): Promise<Attr | undefined> => {
  let anime: Attr
  try {
    const { statusCode, body } = await request(
      `${KITSU_BASE_URL}/anime?filter[text]=${name}`
    )

    if (statusCode !== 200) {
      return
    }

    const base = (await body.json()) as Base
    const data = base.data[0].attributes

    anime = {
      slug: data.slug,
      titles: {
        en: data.titles.en,
        en_jp: data.titles.en_jp,
      },
      posterImage: {
        large: data.posterImage?.large,
      },
    }
  } catch (err) {
    throw new Error(`Failed to fetch resources from Kitsu: ${err}`)
  }

  if (!anime) {
    return
  }

  return anime
}
