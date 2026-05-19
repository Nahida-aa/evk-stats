import { LANGUAGE_COLORS } from './colors'

const GITHUB_API = 'https://api.github.com'

interface Repo {
  name: string
  full_name: string
  fork: boolean
}

interface LanguagesMap {
  [language: string]: number
}

interface LanguageStat {
  name: string
  bytes: number
  percent: number
  color: string
}

interface AggregatedResult {
  total_bytes: number
  languages: LanguageStat[]
}

interface RepoLanguageDetail {
  name: string
  full_name: string
  total_bytes: number
  languages: LanguageStat[]
}

const headers = (token?: string): Record<string, string> => ({
  Accept: 'application/vnd.github+json',
  'User-Agent': 'evk-stats',
  ...(token ? { Authorization: `Bearer ${token}` } : {}),
})

function parseLinkHeader(link: string | null): Record<string, string> {
  if (!link) return {}
  const entries: Record<string, string> = {}
  for (const part of link.split(',')) {
    const match = part.match(/<([^>]+)>;\s*rel="([^"]+)"/)
    if (match) entries[match[2]] = match[1]
  }
  return entries
}

export async function getUserRepos(username: string, token?: string): Promise<Repo[]> {
  const repos: Repo[] = []
  let page = 1

  while (true) {
    const url = `${GITHUB_API}/users/${username}/repos?per_page=100&page=${page}&type=owner&sort=pushed`
    const res = await fetch(url, { headers: headers(token) })

    if (!res.ok) {
      throw new Error(`GitHub API ${res.status}: ${res.statusText}`)
    }

    const data= (await res.json() )as Repo[]
    repos.push(...data.filter(r => !r.fork))

    const links = parseLinkHeader(res.headers.get('Link'))
    if (!links.next) break
    page++
  }

  return repos
}

export async function getRepoLanguages(fullName: string, token?: string) {
  const url = `${GITHUB_API}/repos/${fullName}/languages`
  const res = await fetch(url, { headers: headers(token) })

  if (!res.ok) {
    throw new Error(`GitHub API ${res.status}: ${res.statusText}`)
  }

  return res.json() as Promise<LanguagesMap>
}

export async function getAllLanguages(
  repos: Repo[],
  token?: string,
): Promise<Map<string, LanguagesMap>> {
  const results = new Map<string, LanguagesMap>()
  const errors: string[] = []

  const entries = await Promise.allSettled(
    repos.map(repo =>
      getRepoLanguages(repo.full_name, token).then(langs => ({
        name: repo.full_name,
        langs,
      })),
    ),
  )

  for (const entry of entries) {
    if (entry.status === 'fulfilled') {
      results.set(entry.value.name, entry.value.langs)
    } else {
      errors.push(entry.reason?.message ?? 'unknown error')
    }
  }

  if (errors.length > 0) {
    console.warn(`[evk-stats] getAllLanguages: ${errors.length}/${repos.length} failed`, errors)
  }

  return results
}

export function aggregateLanguages(languagesMap: Map<string, LanguagesMap>): AggregatedResult {
  const total = new Map<string, number>()

  for (const langs of languagesMap.values()) {
    for (const [lang, bytes] of Object.entries(langs)) {
      total.set(lang, (total.get(lang) ?? 0) + bytes)
    }
  }

  const totalBytes = Array.from(total.values()).reduce((a, b) => a + b, 0)

  const languages: LanguageStat[] = Array.from(total.entries())
    .map(([name, bytes]) => ({
      name,
      bytes,
      percent: totalBytes > 0 ? Math.round((bytes / totalBytes) * 1000) / 10 : 0,
      color: LANGUAGE_COLORS[name] ?? '#ccc',
    }))
    .sort((a, b) => b.bytes - a.bytes)

  return { total_bytes: totalBytes, languages }
}

export function detailLanguages(
  repos: Repo[],
  languagesMap: Map<string, LanguagesMap>,
): RepoLanguageDetail[] {
  return repos
    .map(repo => {
      const langs = languagesMap.get(repo.full_name)
      if (!langs) return null

      const totalBytes = Object.values(langs).reduce((a, b) => a + b, 0)
      const languages: LanguageStat[] = Object.entries(langs)
        .map(([name, bytes]) => ({
          name,
          bytes,
          percent: totalBytes > 0 ? Math.round((bytes / totalBytes) * 1000) / 10 : 0,
          color: LANGUAGE_COLORS[name] ?? '#ccc',
        }))
        .sort((a, b) => b.bytes - a.bytes)

      return { name: repo.name, full_name: repo.full_name, total_bytes: totalBytes, languages }
    })
    .filter((r): r is RepoLanguageDetail => r !== null)
}

export async function fetchUserLanguages(username: string, token?: string) {
  const repos = await getUserRepos(username, token)
  const languagesMap = await getAllLanguages(repos, token)
  return { repos, languagesMap }
}

