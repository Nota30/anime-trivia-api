import { serve } from '@hono/node-server'
import { prettyJSON } from 'hono/pretty-json'
import { Hono } from 'hono'
import { getRandomAnime } from '@/app'
import { createErrorMessage } from '@/error'

const PORT = 3000

const app = new Hono()

app.use('*', prettyJSON())

app.get('/', (c) => {
  return c.json({
    message:
      'Welcome to the Anime Trivia API. <https://github.com/Nota30/anime-trivia-api>',
  })
})

app.get('/random', async (c) => {
  const anime = await getRandomAnime()

  if (!anime) {
    return c.json(createErrorMessage('Anime could not be fetched'), 404)
  }

  return c.json({ data: anime })
})

app.notFound((c) => {
  return c.json(createErrorMessage('Not Found'), 404)
})

app.onError((e, c) => {
  console.log(`${e}`)
  return c.json(createErrorMessage('Internal Server Error'), 500)
})

console.log(`API is running on port ${PORT}`)

serve({
  fetch: app.fetch,
  port: PORT,
})
