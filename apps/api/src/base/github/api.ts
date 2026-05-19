import { z } from 'zod'
import { zValidator } from '@hono/zod-validator'
import { Hono } from 'hono'
import { fetchUserLanguages, aggregateLanguages, detailLanguages } from './server'

interface Bindings {
  GITHUB_TOKEN?: string
}

const app = new Hono<{ Bindings: Bindings }>()

const querySchema = z.object({
  username: z.string().min(1, 'username is required'),
  mode: z.enum(['aggregated', 'detailed']).default('aggregated'),
})

app.get('/languages', zValidator('query', querySchema), async (c) => {
  if (!c.env.GITHUB_TOKEN) {
    return c.json({ error: 'GITHUB_TOKEN is not configured on the server' }, 500)
  }

  const { username, mode } = c.req.valid('query')
  const { repos, languagesMap } = await fetchUserLanguages(username, c.env.GITHUB_TOKEN)

  if (mode === 'detailed') {
    return c.json({
      username,
      mode,
      repository_count: repos.length,
      repositories: detailLanguages(repos, languagesMap),
    })
  }

  return c.json({
    username,
    mode,
    repository_count: repos.length,
    ...aggregateLanguages(languagesMap),
  })
})

app.onError((err, c) => {
  const message = err instanceof Error ? err.message : 'Unknown error'
  return c.json({ error: message }, 502)
})

export default app
