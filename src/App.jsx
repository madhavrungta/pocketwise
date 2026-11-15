import { useEffect, useState } from "react";

const categories = [
  "Food & Drinks",
  "Transport",
  "Shopping",
  "Housing",
  "Health",
  "Education",
  "Other"
];

const API_URL = `${import.meta.env.VITE_API_BASE_URL || ""}/api/expenses`;

function getToday() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

// Convert an ISO date (YYYY-MM-DD) to the form shown in the input (DD-MM-YYYY).
function formatDateForInput(isoDate) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(isoDate || "")) return "";
  const [year, month, day] = isoDate.split("-");
  return `${day}-${month}-${year}`;
}

// Validate DD-MM-YYYY and convert it to YYYY-MM-DD for the Node.js API.
function parseDisplayDate(value) {
  const match = /^(\d{2})-(\d{2})-(\d{4})$/.exec(value.trim());
  if (!match) return null;

  const [, dayText, monthText, yearText] = match;
  const day = Number(dayText);
  const month = Number(monthText);
  const year = Number(yearText);

  const isLeapYear = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  const daysInMonth = [31, isLeapYear ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  const isRealDate = month >= 1 && month <= 12 && day >= 1 && day <= (daysInMonth[month - 1] || 0);

  if (!isRealDate) return null;

  return `${yearText}-${monthText}-${dayText}`;
}

// Display saved API dates in DD-MM-YYYY format in the transaction list.
function formatSavedDate(isoDate) {
  return formatDateForInput(isoDate) || isoDate;
}

function App() {
  const [expenses, setExpenses] = useState([]);
  const [title, setTitle] = useState("");
  const [amount, setAmount] = useState("");
  const [category, setCategory] = useState("");
  const [date, setDate] = useState(formatDateForInput(getToday()));
  const [errors, setErrors] = useState({});
  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState("error");
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("All");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // GET request: fetch expense records from the Node.js server.
  useEffect(() => {
    async function loadExpenses() {
      try {
        const response = await fetch(API_URL);
        const result = await response.json();

        if (!response.ok) {
          throw new Error(result.message || "Could not load expenses.");
        }

        let serverExpenses = result.data || [];

        // One-time migration: copy existing Practical 03 LocalStorage records
        // to the backend only when the server has no records yet.
        let migrationComplete = localStorage.getItem("pocketwise-migration-complete") === "true";
        if (!migrationComplete && serverExpenses.length === 0) {
          let oldExpenses = [];
          try {
            oldExpenses = JSON.parse(localStorage.getItem("expenses") || "[]");
          } catch {
            oldExpenses = [];
          }

          for (const oldExpense of oldExpenses) {
            const migrationResponse = await fetch(API_URL, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                title: oldExpense.title,
                amount: oldExpense.amount,
                category: oldExpense.category,
                date: oldExpense.date
              })
            });

            if (migrationResponse.ok) {
              const migrationResult = await migrationResponse.json();
              serverExpenses = [migrationResult.data, ...serverExpenses];
            }
          }
          // Preserve old browser data if migration did not complete fully.
          if (oldExpenses.length === 0 || serverExpenses.length >= oldExpenses.length) {
            localStorage.setItem("pocketwise-migration-complete", "true");
          }
        }

        setExpenses(serverExpenses);
      } catch (error) {
        setMessage(
          "Unable to connect to the Node.js server. Start the backend and refresh this page."
        );
        setMessageType("error");
      } finally {
        setLoading(false);
      }
    }

    loadExpenses();
  }, []);

  const total = expenses.reduce(
    (sum, expense) => sum + Number(expense.amount),
    0
  );

  const average = expenses.length ? total / expenses.length : 0;

  function validateClientSide() {
    const newErrors = {};

    if (!title.trim()) {
      newErrors.title = "Expense name is required.";
    } else if (title.trim().length < 2) {
      newErrors.title = "Name must contain at least 2 characters.";
    }

    if (amount.trim() === "") {
      newErrors.amount = "Amount is required.";
    } else if (!Number.isFinite(Number(amount)) || Number(amount) <= 0) {
      newErrors.amount = "Enter an amount greater than zero.";
    } else if (Number(amount) > 10000000) {
      newErrors.amount = "Amount is too large.";
    }

    if (!category) {
      newErrors.category = "Select a category.";
    }

    const isoDate = parseDisplayDate(date);

    if (!date.trim()) {
      newErrors.date = "Enter a date.";
    } else if (!isoDate) {
      newErrors.date = "Enter a valid date in DD-MM-YYYY format.";
    } else if (isoDate > getToday()) {
      newErrors.date = "Future dates are not allowed.";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }

  // POST request: submit data to Node.js, where it is validated again.
  async function handleSubmit(event) {
    event.preventDefault();
    setMessage("");

    if (!validateClientSide()) {
      setMessage("Please correct the errors below.");
      setMessageType("error");
      return;
    }

    setSaving(true);
    try {
      const response = await fetch(API_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim(),
          amount: Number(amount),
          category,
          date: parseDisplayDate(date)
        })
      });

      const result = await response.json();

      if (!response.ok) {
        setErrors(result.errors || {});
        throw new Error(result.message || "The server rejected this expense.");
      }

      setExpenses((current) => [result.data, ...current]);

      setTitle("");
      setAmount("");
      setCategory("");
      setDate(formatDateForInput(getToday()));
      setErrors({});
      setMessage(result.message || "Expense added successfully!");
      setMessageType("success");
    } catch (error) {
      setMessage(error.message || "Could not save the expense.");
      setMessageType("error");
    } finally {
      setSaving(false);
    }
  }

  // DELETE request: remove the selected record from the server.
  async function deleteExpense(id) {
    try {
      const response = await fetch(`${API_URL}/${encodeURIComponent(id)}`, {
        method: "DELETE"
      });
      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.message || "Could not delete expense.");
      }

      setExpenses((current) => current.filter((expense) => expense.id !== id));
      setMessage(result.message || "Expense deleted successfully!");
      setMessageType("success");
    } catch (error) {
      setMessage(error.message || "Could not delete the expense.");
      setMessageType("error");
    }
  }

  const filteredExpenses = expenses.filter((expense) => {
    const matchesSearch = expense.title
      .toLowerCase()
      .includes(search.toLowerCase());

    const matchesCategory =
      filter === "All" || expense.category === filter;

    return matchesSearch && matchesCategory;
  });

  const formatMoney = (value) =>
    new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      maximumFractionDigits: 2
    }).format(value);

  return (
    <div className="app">
      <header className="header">
        <div className="brand">
          <span className="brand-icon">â‚¹</span>
          <div>
            <h2>PocketWise</h2>
            <p>PERSONAL FINANCE</p>
          </div>
        </div>
        <span className="status">â— Expense dashboard</span>
      </header>

      <main>
        <section className="welcome">
          <div>
            <p className="eyebrow">YOUR MONEY, MADE CLEAR</p>
            <h1>Smart Expense Tracker</h1>
            <p className="subtitle">
              Track your spending and manage your money wisely.
            </p>
          </div>
        </section>

        <section className="stats">
          <article className="stat-card">
            <span className="stat-icon">â‚¹</span>
            <p>Total Expenses</p>
            <h2>{formatMoney(total)}</h2>
          </article>
          <article className="stat-card">
            <span className="stat-icon">â†—</span>
            <p>Average Expense</p>
            <h2>{formatMoney(average)}</h2>
          </article>
          <article className="stat-card">
            <span className="stat-icon">â–¤</span>
            <p>Transactions</p>
            <h2>{expenses.length}</h2>
          </article>
        </section>

        <section className="content">
          <section className="panel">
            <h2>Add an Expense</h2>
            <p className="panel-description">
              Enter the transaction details below.
            </p>

            {message && (
              <div
                className={messageType === "success" ? "message success" : "message error"}
                role="status"
              >
                {message}
              </div>
            )}

            <form onSubmit={handleSubmit} noValidate>
              <div className="field">
                <label htmlFor="title">Expense Name *</label>
                <input
                  id="title"
                  type="text"
                  placeholder="e.g. Groceries"
                  maxLength="60"
                  value={title}
                  onChange={(e) => {
                    setTitle(e.target.value);
                    setErrors((old) => ({ ...old, title: "" }));
                  }}
                  aria-invalid={!!errors.title}
                />
                {errors.title && <small className="field-error">{errors.title}</small>}
              </div>

              <div className="field">
                <label htmlFor="amount">Amount (â‚¹) *</label>
                <input
                  id="amount"
                  type="number"
                  min="0.01"
                  max="10000000"
                  step="0.01"
                  placeholder="Enter amount"
                  value={amount}
                  onChange={(e) => {
                    setAmount(e.target.value);
                    setErrors((old) => ({ ...old, amount: "" }));
                  }}
                  aria-invalid={!!errors.amount}
                />
                {errors.amount && <small className="field-error">{errors.amount}</small>}
              </div>

              <div className="field">
                <label htmlFor="category">Category *</label>
                <select
                  id="category"
                  value={category}
                  onChange={(e) => {
                    setCategory(e.target.value);
                    setErrors((old) => ({ ...old, category: "" }));
                  }}
                  aria-invalid={!!errors.category}
                >
                  <option value="">Choose category</option>
                  {categories.map((item) => (
                    <option key={item} value={item}>{item}</option>
                  ))}
                </select>
                {errors.category && <small className="field-error">{errors.category}</small>}
              </div>

              <div className="field">
                <label htmlFor="date">Date (DD-MM-YYYY) *</label>
                <input
                  id="date"
                  type="text"
                  placeholder="DD-MM-YYYY"
                  inputMode="numeric"
                  maxLength={10}
                  value={date}
                  onChange={(e) => {
                    // Keep the input in DD-MM-YYYY format.
                    const value = e.target.value.replace(/[^0-9-]/g, "");
                    setDate(value);
                    setErrors((old) => ({ ...old, date: "" }));
                  }}
                  aria-invalid={!!errors.date}
                  aria-describedby="date-help"
                />
                <small id="date-help">Enter the date as DD-MM-YYYY, for example 13-11-2026.</small>
                {errors.date && <small className="field-error">{errors.date}</small>}
              </div>

              <button className="primary-button" type="submit" disabled={saving || loading}>
                {saving ? "Saving..." : "+ Save Expense"}
              </button>
            </form>

            <p className="privacy-note">
              Expenses are validated and stored by the Node.js server.
            </p>
          </section>

          <section className="panel">
            <h2>Recent Transactions</h2>
            <p className="panel-description">
              Search, filter or remove your expenses.
            </p>

            <div className="filters">
              <input
                type="search"
                placeholder="Search expenses..."
                aria-label="Search expenses"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
              <select
                aria-label="Filter by category"
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
              >
                <option value="All">All categories</option>
                {categories.map((item) => (
                  <option key={item} value={item}>{item}</option>
                ))}
              </select>
            </div>

            <div className="expense-list">
              {loading ? (
                <div className="empty">
                  <h3>Loading expenses...</h3>
                  <p>Contacting the Node.js server.</p>
                </div>
              ) : filteredExpenses.length === 0 ? (
                <div className="empty">
                  <div className="empty-icon">â–¤</div>
                  <h3>No expenses found</h3>
                  <p>Add an expense or change your search.</p>
                </div>
              ) : (
                filteredExpenses.map((expense) => (
                  <article className="expense-item" key={expense.id}>
                    <div className="expense-symbol">
                      {expense.category === "Food & Drinks" ? "â˜•"
                        : expense.category === "Transport" ? "ðŸš—"
                        : expense.category === "Shopping" ? "ðŸ›"
                        : expense.category === "Education" ? "ðŸ“š" : "â‚¹"}
                    </div>
                    <div className="expense-info">
                      <strong>{expense.title}</strong>
                      <span>{expense.category} Â· {formatSavedDate(expense.date)}</span>
                    </div>
                    <div className="expense-actions">
                      <strong>{formatMoney(expense.amount)}</strong>
                      <button
                        className="delete-button"
                        type="button"
                        onClick={() => deleteExpense(expense.id)}
                        aria-label={`Delete ${expense.title}`}
                      >
                        Delete
                      </button>
                    </div>
                  </article>
                ))
              )}
            </div>

            <p className="list-footer">
              Showing {filteredExpenses.length} of {expenses.length} transactions
            </p>
          </section>
        </section>

        <footer>PocketWise Â· ReactJS + Node.js + Express</footer>
      </main>
    </div>
  );
}

export default App;

