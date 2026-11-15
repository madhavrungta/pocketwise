import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { once } from 'node:events'
import { mkdtemp, rm } from 'node:fs/promises'
import { createServer } from 'node:net'
import os from 'node:os'
import { join, resolve } from 'node:path'
import test from 'node:test'

const projectDirectory = process.cwd()
const serverFile = resolve(projectDirectory, 'server.js')
let temporaryDirectory
let dataFile
let port
let baseUrl
let serverProcess

async function getAvailablePort() {
  const probe = createServer()
  probe.listen(0, '127.0.0.1')
  await once(probe, 'listening')
  const { port: availablePort } = probe.address()
  await new Promise((resolveClose, reject) =>
    probe.close((error) => error ? reject(error) : resolveClose())
  )
  return availablePort
}

async function startServer() {
  serverProcess = spawn(process.execPath, [serverFile], {
    cwd: projectDirectory,
    env: { ...process.env, PORT: String(port), EXPENSES_FILE: dataFile },
    stdio: ['ignore', 'pipe', 'pipe']
  })

  let output = ''
  serverProcess.stdout.setEncoding('utf8').on('data', (chunk) => { output += chunk })
  serverProcess.stderr.setEncoding('utf8').on('data', (chunk) => { output += chunk })

  for (let attempt = 0; attempt < 50; attempt += 1) {
    if (serverProcess.exitCode !== null) {
      throw new Error(`PocketWise server exited during startup.\n${output}`)
    }
    try {
      const response = await fetch(`${baseUrl}/api/health`)
      if (response.ok) return
    } catch {
      // The server is not listening yet.
    }
    await new Promise((resolveDelay) => setTimeout(resolveDelay, 100))
  }

  await stopServer()
  throw new Error(`PocketWise server did not start.\n${output}`)
}

async function stopServer() {
  if (!serverProcess || serverProcess.exitCode !== null) return
  const processStopped = once(serverProcess, 'exit')
  serverProcess.kill()
  await processStopped
  serverProcess = undefined
}

async function postExpense(body) {
  return fetch(`${baseUrl}/api/expenses`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  })
}

const validExpense = {
  title: 'Practical API Test',
  amount: 125.5,
  category: 'Food & Drinks',
  date: '2024-02-29'
}

test('Express API validates requests, persists data, and handles CRUD routes', async (t) => {
  temporaryDirectory = await mkdtemp(join(os.tmpdir(), 'pocketwise-practical05-'))
  dataFile = join(temporaryDirectory, 'expenses.json')
  port = await getAvailablePort()
  baseUrl = `http://127.0.0.1:${port}`

  try {
    await startServer()

    await t.test('health and GET return structured responses', async () => {
      const healthResponse = await fetch(`${baseUrl}/api/health`)
      const health = await healthResponse.json()
      assert.equal(healthResponse.status, 200)
      assert.equal(health.success, true)

      const listResponse = await fetch(`${baseUrl}/api/expenses`)
      const list = await listResponse.json()
      assert.equal(listResponse.status, 200)
      assert.deepEqual(list.data, [])
      assert.equal(list.count, 0)
    })

    await t.test('valid POST trims title and returns 201', async () => {
      const response = await postExpense({ ...validExpense, title: '  Practical API Test  ' })
      const result = await response.json()
      assert.equal(response.status, 201)
      assert.equal(result.success, true)
      assert.equal(result.message, 'Expense added successfully!')
      assert.equal(result.data.title, 'Practical API Test')
      assert.equal(result.data.date, validExpense.date)
      assert.ok(result.data.id)
    })

    const invalidCases = [
      ['empty title', { ...validExpense, title: '   ' }, 'title'],
      ['missing amount', { title: validExpense.title, category: validExpense.category, date: validExpense.date }, 'amount'],
      ['zero amount', { ...validExpense, amount: 0 }, 'amount'],
      ['negative amount', { ...validExpense, amount: -5 }, 'amount'],
      ['alphabetic amount', { ...validExpense, amount: 'abc' }, 'amount'],
      ['missing category', { title: validExpense.title, amount: 5, date: validExpense.date }, 'category'],
      ['invalid category', { ...validExpense, category: 'Invalid' }, 'category'],
      ['invalid calendar date', { ...validExpense, date: '2025-02-29' }, 'date'],
      ['missing required fields', {}, 'title']
    ]

    for (const [name, input, expectedErrorField] of invalidCases) {
      await t.test(`POST rejects ${name}`, async () => {
        const response = await postExpense(input)
        const result = await response.json()
        assert.equal(response.status, 400)
        assert.equal(result.success, false)
        assert.ok(result.errors[expectedErrorField])
      })
    }

    await t.test('malformed JSON receives a 400 JSON error', async () => {
      const response = await fetch(`${baseUrl}/api/expenses`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: '{"title":'
      })
      const result = await response.json()
      assert.equal(response.status, 400)
      assert.equal(result.success, false)
      assert.equal(result.message, 'Invalid JSON request body.')
    })

    await t.test('expense remains available after server restart', async () => {
      await stopServer()
      await startServer()
      const response = await fetch(`${baseUrl}/api/expenses`)
      const result = await response.json()
      assert.equal(response.status, 200)
      assert.equal(result.count, 1)
      assert.equal(result.data[0].title, 'Practical API Test')
    })

    await t.test('DELETE returns success and then 404 for missing ID', async () => {
      const list = await (await fetch(`${baseUrl}/api/expenses`)).json()
      const expenseId = list.data[0].id
      const deletedResponse = await fetch(`${baseUrl}/api/expenses/${expenseId}`, { method: 'DELETE' })
      const deleted = await deletedResponse.json()
      assert.equal(deletedResponse.status, 200)
      assert.equal(deleted.success, true)
      assert.equal(deleted.message, 'Expense deleted successfully!')

      const missingResponse = await fetch(`${baseUrl}/api/expenses/not-a-real-id`, { method: 'DELETE' })
      const missing = await missingResponse.json()
      assert.equal(missingResponse.status, 404)
      assert.equal(missing.success, false)
      assert.equal(missing.message, 'Expense not found.')
    })
  } finally {
    await stopServer()
    await rm(temporaryDirectory, { recursive: true, force: true })
  }
})

