import { TRANSACTION_TYPES } from '../../core/constants.js'
import { monthStrOf, todayStr } from '../../core/utils.js'
import { loadAccounts } from './accountController.js'
import { loadTransactions } from './transactionController.js'
import { loadBudgets } from './budgetController.js'
import { loadGoals } from './savingsGoalController.js'
import { loadAchievements } from './achievementController.js'
import { loadUser } from './userController.js'
import { getPoints, loadClaimed } from './challengeController.js'

export const EXPORT_VERSION = 1

const round2 = (n) => Math.round(n * 100) / 100

function inMonthRange(monthStr, startMonth, endMonth) {
  if (startMonth && monthStr < startMonth) return false
  if (endMonth && monthStr > endMonth) return false
  return true
}

export function isLedgerEmpty() {
  return (
    loadAccounts().length === 0 &&
    loadTransactions().length === 0 &&
    loadBudgets().length === 0 &&
    loadGoals().length === 0 &&
    loadAchievements().length === 0
  )
}

function summarizeTransactions(transactions) {
  const summary = {
    incomeCount: 0,
    expenseCount: 0,
    transferCount: 0,
    incomeTotal: 0,
    expenseTotal: 0,
    transferTotal: 0
  }
  for (const t of transactions) {
    if (t.type === TRANSACTION_TYPES.INCOME) {
      summary.incomeCount++
      summary.incomeTotal += t.amount
    } else if (t.type === TRANSACTION_TYPES.EXPENSE) {
      summary.expenseCount++
      summary.expenseTotal += t.amount
    } else if (t.type === TRANSACTION_TYPES.TRANSFER) {
      summary.transferCount++
      summary.transferTotal += t.amount
    }
  }
  summary.incomeTotal = round2(summary.incomeTotal)
  summary.expenseTotal = round2(summary.expenseTotal)
  summary.transferTotal = round2(summary.transferTotal)
  return summary
}

// 只读取本地数据并打包，不写入任何存储，导出不改变现有数据。
// 账户、储蓄目标、成就等为当前状态，始终完整包含；
// 流水与预算带有月份字段，指定范围时按月份过滤。
export function buildExportPayload({ startMonth = '', endMonth = '' } = {}) {
  if (isLedgerEmpty()) return null
  const ranged = Boolean(startMonth || endMonth)

  const accounts = loadAccounts()
  const allTransactions = loadTransactions()
  const allBudgets = loadBudgets()
  const goals = loadGoals()
  const achievements = loadAchievements()

  const transactions = ranged
    ? allTransactions.filter((t) => inMonthRange(monthStrOf(t.date), startMonth, endMonth))
    : allTransactions
  const budgets = ranged
    ? allBudgets.filter((b) => inMonthRange(b.month, startMonth, endMonth))
    : allBudgets

  const summary = {
    accounts: accounts.length,
    transactions: transactions.length,
    budgets: budgets.length,
    goals: goals.length,
    achievements: achievements.length,
    ...summarizeTransactions(transactions)
  }

  const payload = {
    app: '家庭财务管家',
    version: EXPORT_VERSION,
    exportedAt: new Date().toISOString(),
    range: ranged ? { startMonth: startMonth || null, endMonth: endMonth || null } : null,
    summary,
    data: {
      accounts,
      transactions,
      budgets,
      goals,
      achievements,
      user: loadUser(),
      points: getPoints(),
      claimedChallenges: loadClaimed()
    }
  }
  return { payload, summary }
}

export function exportFileName({ startMonth = '', endMonth = '' } = {}) {
  const range = startMonth || endMonth ? `_${startMonth || '最早'}至${endMonth || '最新'}` : '_全部'
  return `家庭财务备份${range}_${todayStr()}.json`
}

function downloadJson(payload, filename) {
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

// 空账本返回 null，由界面给出提示；成功时返回文件名与核对摘要
export function runExport(range = {}) {
  const built = buildExportPayload(range)
  if (!built) return null
  const filename = exportFileName(range)
  downloadJson(built.payload, filename)
  return { filename, summary: built.summary }
}
