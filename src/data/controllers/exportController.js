import { TRANSACTION_TYPES } from '../../core/constants.js'
import { todayStr } from '../../core/utils.js'
import { loadAccounts } from './accountController.js'
import { loadTransactions } from './transactionController.js'
import { loadBudgets } from './budgetController.js'
import { loadGoals } from './savingsGoalController.js'
import { loadAchievements } from './achievementController.js'
import { loadUser } from './userController.js'
import { getPoints, loadClaimed } from './challengeController.js'

export const EXPORT_VERSION = 1

const round2 = (n) => Math.round((Number(n) || 0) * 100) / 100

function inMonthRange(monthStr, fromMonth, toMonth) {
  if (fromMonth && monthStr < fromMonth) return false
  if (toMonth && monthStr > toMonth) return false
  return true
}

function summarize(transactions) {
  const summary = {
    incomeCount: 0,
    expenseCount: 0,
    transferCount: 0,
    totalIncome: 0,
    totalExpense: 0,
    totalTransfer: 0
  }
  for (const t of transactions) {
    if (t.type === TRANSACTION_TYPES.INCOME) {
      summary.incomeCount++
      summary.totalIncome += t.amount
    } else if (t.type === TRANSACTION_TYPES.EXPENSE) {
      summary.expenseCount++
      summary.totalExpense += t.amount
    } else if (t.type === TRANSACTION_TYPES.TRANSFER) {
      summary.transferCount++
      summary.totalTransfer += t.amount
    }
  }
  summary.totalIncome = round2(summary.totalIncome)
  summary.totalExpense = round2(summary.totalExpense)
  summary.totalTransfer = round2(summary.totalTransfer)
  summary.net = round2(summary.totalIncome - summary.totalExpense)
  return summary
}

// 只读取本地数据组装导出内容，不写回任何存储，导出不改变现有数据。
// 月份范围仅筛选流水与预算；账户、目标、成就属于状态数据，始终完整导出。
export function buildExportPayload({ fromMonth = '', toMonth = '' } = {}) {
  const scoped = Boolean(fromMonth || toMonth)
  const transactions = loadTransactions().filter((t) => inMonthRange(t.date.slice(0, 7), fromMonth, toMonth))
  const budgets = loadBudgets().filter((b) => inMonthRange(b.month, fromMonth, toMonth))
  const accounts = loadAccounts()
  const goals = loadGoals()
  const achievements = loadAchievements()

  return {
    app: '家庭财务管家',
    version: EXPORT_VERSION,
    exportedAt: new Date().toISOString(),
    range: scoped ? { type: 'month', from: fromMonth, to: toMonth } : { type: 'all' },
    summary: {
      accounts: accounts.length,
      transactions: transactions.length,
      budgets: budgets.length,
      goals: goals.length,
      achievements: achievements.length,
      ...summarize(transactions)
    },
    data: {
      user: loadUser(),
      accounts,
      transactions,
      budgets,
      goals,
      achievements,
      points: getPoints(),
      claimedChallenges: loadClaimed()
    }
  }
}

export function isPayloadEmpty(payload) {
  const s = payload.summary
  return s.accounts + s.transactions + s.budgets + s.goals + s.achievements === 0
}

export function exportFileName(range) {
  const scope = range.type === 'all' ? '全部' : `${range.from}至${range.to}`
  return `家庭财务备份_${scope}_${todayStr()}.json`
}

function downloadJson(filename, payload) {
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}

export function exportLedger(options = {}) {
  const payload = buildExportPayload(options)
  if (isPayloadEmpty(payload)) return { ok: false, reason: 'empty', payload }
  const filename = exportFileName(payload.range)
  downloadJson(filename, payload)
  return { ok: true, filename, payload }
}
