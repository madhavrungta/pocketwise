import { Router } from 'express'
import {
  getExpenses,
  createExpense,
  removeExpense
} from '../controllers/expenseController.js'
import validateExpense from '../middleware/validateExpense.js'

const router = Router()

// GET /api/expenses â€” return all saved expenses.
router.get('/', getExpenses)

// POST /api/expenses â€” validate and create a new expense.
router.post('/', validateExpense, createExpense)

// DELETE /api/expenses/:id â€” remove an expense by its ID.
router.delete('/:id', removeExpense)

export default router
