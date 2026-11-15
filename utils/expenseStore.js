import { readFile, writeFile } from 'node:fs/promises'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { mkdir } from 'node:fs/promises'

const currentDirectory = dirname(fileURLToPath(import.meta.url))
const dataFile = process.env.EXPENSES_FILE
  ? resolve(process.env.EXPENSES_FILE)
  : join(currentDirectory, 'data', 'expenses.json')

export async function readExpenses() {
  try {
    const content = await readFile(dataFile, 'utf8')
    const parsed = JSON.parse(content)
    return Array.isArray(parsed) ? parsed : []
  } catch (error) {
    if (error.code === 'ENOENT') {
      await mkdir(dirname(dataFile), { recursive: true })
      await writeFile(dataFile, '[]', 'utf8')
      return []
    }
    if (error instanceof SyntaxError) {
      const corruptionError = new Error(`Expense data file contains invalid JSON: ${dataFile}`)
      corruptionError.cause = error
      throw corruptionError
    }
    throw error
  }
}

export async function writeExpenses(expenses) {
  await mkdir(dirname(dataFile), { recursive: true })
  await writeFile(dataFile, JSON.stringify(expenses, null, 2), 'utf8')
}

