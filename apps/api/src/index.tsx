import { Hono } from 'hono'
import { renderer } from './renderer'
import github from './base/github/api'

const app = new Hono()

app.use(renderer)

app.get('/', (c) => {
  return c.render(<h1>Hello!</h1>)
})

app.route('/api/base/github', github)

export default app
