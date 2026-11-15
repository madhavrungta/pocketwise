import { randomUUID } from 'node:crypto'
import { readExpenses, writeExpenses } from '../utils/expenseStore.js'

export async function getExpenses(req, res, next) {
  try {
    const expenses = await readExpenses()
    return res.status(200).json({
      success: true,
      count: expenses.length,
      data: expenses
    })
  } catch (error) {
    next(error)
  }
}

export async function createExpense(req, res, next) {
  try {
    const expenses = await readExpenses()
    const newExpense = {
      id: randomUUID(),
      ...req.validatedExpense,
      createdAt: new Date().toISOString()
    }

    expenses.unshift(newExpense)
    await writeExpenses(expenses)

    return res.status(201).json({
      success: true,
      message: 'Expense added successfully!',
      data: newExpense
    })
  } catch (error) {
    next(error)
  }
}

export async function removeExpense(req, res, next) {
  try {
    const expenses = await readExpenses()
    const updatedExpenses = expenses.filter(
      (expense) => expense.id !== req.params.id
    )

    if (updatedExpenses.length === expenses.length) {
      return res.status(404).json({
        success: false,
        message: 'Expense not found.'
      })
    }

    await writeExpenses(updatedExpenses)
    return res.status(200).json({
      success: true,
      message: 'Expense deleted successfully!'
    })
  } catch (error) {
    next(error)
  }
}
