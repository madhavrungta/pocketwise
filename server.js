import express from 'express'
import cors from 'cors'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import expenseRoutes from './routes/expenseRoutes.js'

const app = express()
const PORT = process.env.PORT || 5000

// Allow the React development server and the deployed frontend to call this API.
const allowedOrigin = process.env.FRONTEND_URL || '*'
app.use(cors({ origin: allowedOrigin }))
app.use(express.json({ limit: '10kb' }))

app.get('/api/health', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'PocketWise Node.js API is running.'
  })
})

app.use('/api/expenses', expenseRoutes)

// In production, serve the Vite build from the same origin as the API.
if (process.env.NODE_ENV === 'production') {
  const projectDirectory = dirname(fileURLToPath(import.meta.url))
  const frontendDirectory = resolve(projectDirectory, 'dist')
  app.use(express.static(frontendDirectory))
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api/')) return next()
    return res.sendFile(resolve(frontendDirectory, 'index.html'))
  })
}

// Return a consistent response for unknown routes.
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: `Route not found: ${req.method} ${req.originalUrl}`
  })
})

// Handle malformed JSON and unexpected server errors.
app.use((err, req, res, next) => {
  if (err instanceof SyntaxError && 'body' in err) {
    return res.status(400).json({
      success: false,
      message: 'Invalid JSON request body.'
    })
  }

  console.error(err)
  return res.status(500).json({
    success: false,
    message: 'An unexpected server error occurred.'
  })
})

app.listen(PORT, () => {
  console.log(`PocketWise API running at http://localhost:${PORT}`)
})

