const allowedCategories = [
  'Food & Drinks',
  'Transport',
  'Shopping',
  'Housing',
  'Health',
  'Education',
  'Other'
]

function isRealDate(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false
  }

  const [year, month, day] = value.split('-').map(Number)
  const leapYear = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0)
  const daysInMonth = [31, leapYear ? 29 : 28, 31, 30, 31, 31, 30, 31, 30, 31, 30, 31]
  return month >= 1 && month <= 12 && day >= 1 && day <= daysInMonth[month - 1]
}

function localTodayISO() {
  const today = new Date()
  return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`
}

export default function validateExpense(req, res, next) {
  const { title, amount, category, date } = req.body ?? {}
  const errors = {}

  if (typeof title !== 'string' || !title.trim()) {
    errors.title = 'Expense name is required.'
  } else if (title.trim().length < 2) {
    errors.title = 'Name must contain at least 2 characters.'
  } else if (title.trim().length > 60) {
    errors.title = 'Name cannot exceed 60 characters.'
  }

  const numericAmount = Number(amount)
  if (amount === undefined || amount === null || amount === '') {
    errors.amount = 'Amount is required.'
  } else if (!Number.isFinite(numericAmount) || numericAmount <= 0) {
    errors.amount = 'Enter an amount greater than zero.'
  } else if (numericAmount > 10000000) {
    errors.amount = 'Amount cannot exceed â‚¹1,00,00,000.'
  }

  if (typeof category !== 'string' || !allowedCategories.includes(category)) {
    errors.category = 'Select a valid expense category.'
  }

  if (!isRealDate(date)) {
    errors.date = 'Enter a valid date in YYYY-MM-DD format.'
  } else if (date > localTodayISO()) {
    errors.date = 'Future dates are not allowed.'
  }

  if (Object.keys(errors).length > 0) {
    return res.status(400).json({
      success: false,
      message: 'Please correct the invalid expense details.',
      errors
    })
  }

  req.validatedExpense = {
    title: title.trim(),
    amount: Number(numericAmount.toFixed(2)),
    category,
    date
  }

  next()
}

