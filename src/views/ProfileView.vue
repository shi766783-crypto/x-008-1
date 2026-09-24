<template>
  <div class="page">
    <div class="page-head">
      <div>
        <h2>个人中心</h2>
        <p class="page-sub">{{ store.user.name || '我的家庭' }} 的财务总览</p>
      </div>
    </div>

    <div class="profile-top card">
      <div class="avatar">{{ (store.user.name || '家').slice(0, 1) }}</div>
      <div class="profile-meta">
        <div class="profile-name">{{ store.user.name || '我的家庭' }}</div>
        <div class="profile-sub">成员：{{ memberCount }} 人 · 加入于 {{ joinDate }}</div>
      </div>
      <div class="profile-stat">
        <span>累计积分</span>
        <b>{{ store.points }}</b>
      </div>
    </div>

    <section v-if="store.accounts.length">
      <h3 class="block-title">我的账户</h3>
      <div class="section-grid">
        <div v-for="a in store.accounts" :key="a.id" class="mini-card card">
          <span>{{ a.name }}</span>
          <b>¥{{ money(a.balance) }}</b>
        </div>
      </div>
    </section>

    <section v-if="recentList.length">
      <h3 class="block-title">最近记账</h3>
      <div class="card list">
        <div v-for="t in recentList" :key="t.id" class="list-row">
          <span class="row-type" :class="t.type">{{ t.type === 'income' ? '收' : t.type === 'expense' ? '支' : '转' }}</span>
          <span class="row-main">
            <b>{{ rowTitle(t) }}</b>
            <em>{{ t.date }} · {{ accountName(t.accountId || t.fromAccountId) }}</em>
          </span>
          <span class="row-amount" :class="t.type">{{ amtText(t) }}</span>
        </div>
      </div>
    </section>

    <section v-if="budgetRows.length">
      <h3 class="block-title">预算执行情况（本月）</h3>
      <div class="card list">
        <div v-for="b in budgetRows" :key="b.id" class="list-row">
          <span class="row-main">
            <b>{{ b.category }}</b>
            <em>已用 ¥{{ money(b.used) }} / ¥{{ money(b.limit) }}</em>
          </span>
          <span class="badge" :class="b.status">{{ b.status === 'danger' ? '超支' : b.status === 'warn' ? '预警' : '正常' }}</span>
        </div>
      </div>
    </section>

    <section v-if="goalRows.length">
      <h3 class="block-title">储蓄目标进度</h3>
      <div class="section-grid">
        <div v-for="g in goalRows" :key="g.id" class="mini-card card goal-mini">
          <span>{{ g.name }}</span>
          <b>{{ g.percent }}%</b>
          <em>¥{{ money(g.savedAmount) }} / ¥{{ money(g.targetAmount) }}</em>
        </div>
      </div>
    </section>

    <section>
      <h3 class="block-title">成就徽章（{{ store.achievements.length }}/{{ totalBadges }}）</h3>
      <div class="badges-row">
        <div v-for="a in allBadges" :key="a.id" class="mini-badge" :class="{ locked: !owned(a.id) }" :title="a.desc">
          <span class="mini-badge-icon">{{ a.icon }}</span>
          <span>{{ a.name }}</span>
        </div>
      </div>
    </section>

    <section>
      <h3 class="block-title">数据备份</h3>
      <div class="card export-card">
        <div class="export-info">
          <b>导出账本数据</b>
          <p>数据仅保存在本浏览器，换设备或清理缓存前请先导出备份。导出为 JSON 文件，过程不会修改现有数据。</p>
        </div>
        <button class="btn btn-primary" @click="openExport">导出数据</button>
      </div>
    </section>

    <Modal title="导出账本数据" v-if="exportOpen" @close="exportOpen = false">
      <div v-if="ledgerEmpty" class="export-empty">
        当前账本还没有任何数据，暂无可导出内容。请先创建账户或记一笔账，之后再导出备份。
      </div>
      <template v-else>
        <div class="field">
          <span>导出范围</span>
          <div class="seg">
            <button type="button" class="seg-btn" :class="{ active: exportMode === 'all' }" @click="exportMode = 'all'">全部数据</button>
            <button type="button" class="seg-btn" :class="{ active: exportMode === 'range' }" @click="exportMode = 'range'">按月份范围</button>
          </div>
        </div>
        <div v-if="exportMode === 'range'" class="range-row">
          <label class="field">
            <span>开始月份</span>
            <input type="month" v-model="startMonth" />
          </label>
          <label class="field">
            <span>结束月份</span>
            <input type="month" v-model="endMonth" />
          </label>
        </div>
        <p class="muted range-hint" v-if="exportMode === 'range'">流水与预算按所选月份过滤；账户、储蓄目标与成就为当前状态，会完整包含。</p>
        <p class="range-error" v-if="rangeInvalid">开始月份不能晚于结束月份。</p>

        <div class="export-summary" v-if="previewSummary">
          <div class="summary-title">导出内容核对（与文件中的 summary 一致）</div>
          <div class="summary-grid">
            <div><span>账户</span><b>{{ previewSummary.accounts }}</b></div>
            <div><span>流水</span><b>{{ previewSummary.transactions }}</b></div>
            <div><span>预算</span><b>{{ previewSummary.budgets }}</b></div>
            <div><span>目标</span><b>{{ previewSummary.goals }}</b></div>
            <div><span>成就</span><b>{{ previewSummary.achievements }}</b></div>
          </div>
          <div class="summary-amounts">
            <span>收入合计 <b class="income-text">¥{{ money(previewSummary.incomeTotal) }}</b></span>
            <span>支出合计 <b class="neg">¥{{ money(previewSummary.expenseTotal) }}</b></span>
            <span>转账合计 <b>¥{{ money(previewSummary.transferTotal) }}</b></span>
          </div>
        </div>
        <p class="export-done" v-if="exportedFile">✅ 已导出「{{ exportedFile }}」，可打开文件核对 summary 中的条数与金额。</p>
      </template>

      <template #footer>
        <button type="button" class="btn" @click="exportOpen = false">关闭</button>
        <button v-if="!ledgerEmpty" type="button" class="btn btn-primary" :disabled="rangeInvalid" @click="doExport">导出下载</button>
      </template>
    </Modal>
  </div>
</template>

<script setup>
import { computed, ref } from 'vue'
import { useStore, controllersApi } from '../data/store.js'
import { money } from '../core/utils.js'
import { BUDGET_WARN_RATIO, TRANSACTION_TYPES } from '../core/constants.js'
import Modal from '../components/Modal.vue'

const store = useStore()
const { achievement, exporter } = controllersApi

const allBadges = computed(() => achievement.ACHIEVEMENTS)
const totalBadges = computed(() => allBadges.value.length)
const owned = (id) => store.achievements.some((a) => a.id === id)

const memberCount = 4
const joinDate = store.user.createdAt ? new Date(store.user.createdAt).toLocaleDateString('zh-CN') : '—'
const recentList = computed(() =>
  [...store.transactions].sort((a, b) => (a.date === b.date ? b.createdAt - a.createdAt : a.date < b.date ? 1 : -1)).slice(0, 8)
)
const accountName = (id) => store.accounts.find((a) => a.id === id)?.name || '未知账户'
const rowTitle = (t) => (t.type === 'transfer' ? `转账 ${accountName(t.toAccountId)}` : t.category)
const amtText = (t) =>
  t.type === TRANSACTION_TYPES.INCOME ? `+¥${money(t.amount)}` : t.type === TRANSACTION_TYPES.EXPENSE ? `-¥${money(t.amount)}` : `¥${money(t.amount)}`

const currentMonth = computed(() => new Date().toISOString().slice(0, 7))
const budgetRows = computed(() => {
  const month = currentMonth.value
  return store.budgets
    .filter((b) => b.month === month)
    .map((b) => {
      const used = store.transactions
        .filter((t) => t.type === 'expense' && t.category === b.category && t.date.startsWith(month))
        .reduce((s, t) => s + t.amount, 0)
      const percent = b.limit > 0 ? used / b.limit : 0
      return { ...b, used, status: percent > 1 ? 'danger' : percent >= BUDGET_WARN_RATIO ? 'warn' : 'ok' }
    })
})

const goalRows = computed(() =>
  store.goals.map((g) => ({
    ...g,
    percent: g.targetAmount > 0 ? Math.round((g.savedAmount / g.targetAmount) * 100) : 0
  }))
)

const exportOpen = ref(false)
const exportMode = ref('all')
const startMonth = ref('')
const endMonth = ref('')
const exportedFile = ref('')

const ledgerEmpty = computed(
  () =>
    store.accounts.length + store.transactions.length + store.budgets.length + store.goals.length + store.achievements.length === 0
)
const activeRange = computed(() =>
  exportMode.value === 'range' ? { startMonth: startMonth.value, endMonth: endMonth.value } : {}
)
const rangeInvalid = computed(
  () => exportMode.value === 'range' && startMonth.value && endMonth.value && startMonth.value > endMonth.value
)
const previewSummary = computed(() => {
  if (ledgerEmpty.value || rangeInvalid.value) return null
  return exporter.buildExportPayload(activeRange.value)?.summary || null
})

const openExport = () => {
  exportedFile.value = ''
  exportOpen.value = true
}

const doExport = () => {
  const result = exporter.runExport(activeRange.value)
  if (result) exportedFile.value = result.filename
}
</script>

<style scoped>
.profile-top {
  display: flex;
  align-items: center;
  gap: 16px;
  margin-bottom: 20px;
}
.avatar {
  width: 56px;
  height: 56px;
  border-radius: 18px;
  background: linear-gradient(135deg, #4f8df9, #936df0);
  color: #fff;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 24px;
  font-weight: 800;
}
.profile-meta {
  flex: 1;
}
.profile-name {
  font-size: 18px;
  font-weight: 800;
}
.profile-sub {
  font-size: 12px;
  color: var(--text-secondary);
  margin-top: 4px;
}
.profile-stat {
  text-align: right;
  display: flex;
  flex-direction: column;
}
.profile-stat span {
  font-size: 12px;
  color: var(--text-secondary);
}
.profile-stat b {
  font-size: 24px;
  color: var(--accent);
}
.block-title {
  font-size: 15px;
  margin: 22px 0 10px;
}
.section-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
  gap: 10px;
}
.mini-card {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 12px 14px;
  font-size: 13px;
  color: var(--text-secondary);
}
.mini-card b {
  color: var(--text-primary);
  font-size: 17px;
}
.card.list {
  display: flex;
  flex-direction: column;
  padding: 6px 16px;
}
.list-row {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 0;
  border-bottom: 1px solid var(--border-color);
}
.list-row:last-child { border-bottom: none; }
.row-type {
  width: 28px;
  height: 28px;
  border-radius: 9px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 12px;
  font-weight: 800;
  color: #fff;
  flex-shrink: 0;
}
.row-type.income { background: var(--income); }
.row-type.expense { background: var(--expense); }
.row-type.transfer { background: var(--accent); }
.row-main {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-width: 0;
}
.row-main b { font-size: 14px; }
.row-main em {
  font-style: normal;
  font-size: 12px;
  color: var(--text-secondary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.row-amount { font-weight: 800; }
.row-amount.income { color: var(--income); }
.row-amount.expense { color: var(--expense); }
.row-amount.transfer { color: var(--accent); }
.badge { font-size: 12px; }
.goal-mini em {
  font-style: normal;
  font-size: 12px;
}
.badges-row {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
}
.mini-badge {
  display: flex;
  align-items: center;
  gap: 6px;
  background: var(--bg-elevated);
  border: 1px solid var(--border-color);
  border-radius: 999px;
  padding: 6px 12px;
  font-size: 12px;
}
.mini-badge-icon { font-size: 16px; }
.mini-badge.locked {
  filter: grayscale(1);
  opacity: 0.5;
}
.export-card {
  display: flex;
  align-items: center;
  gap: 16px;
}
.export-info {
  flex: 1;
  min-width: 0;
}
.export-info p {
  margin: 4px 0 0;
  font-size: 12px;
  color: var(--text-secondary);
}
.export-empty {
  padding: 18px 14px;
  border-radius: 10px;
  background: var(--bg-elevated);
  color: var(--text-secondary);
  font-size: 13px;
  text-align: center;
}
.range-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
}
.range-hint {
  font-size: 12px;
  margin: -4px 0 12px;
}
.range-error {
  font-size: 12px;
  color: var(--expense);
  margin: -4px 0 12px;
}
.export-summary {
  background: var(--bg-elevated);
  border-radius: 12px;
  padding: 12px 14px;
}
.summary-title {
  font-size: 12px;
  font-weight: 700;
  color: var(--text-secondary);
  margin-bottom: 10px;
}
.summary-grid {
  display: grid;
  grid-template-columns: repeat(5, 1fr);
  gap: 8px;
  text-align: center;
}
.summary-grid span {
  display: block;
  font-size: 12px;
  color: var(--text-secondary);
}
.summary-grid b {
  font-size: 16px;
}
.summary-amounts {
  display: flex;
  flex-wrap: wrap;
  gap: 6px 16px;
  margin-top: 10px;
  padding-top: 10px;
  border-top: 1px dashed var(--border-color);
  font-size: 12px;
  color: var(--text-secondary);
}
.summary-amounts b {
  color: var(--text-primary);
}
.summary-amounts .income-text {
  color: var(--income);
}
.summary-amounts .neg {
  color: var(--expense);
}
.export-done {
  margin: 12px 0 0;
  font-size: 13px;
  color: var(--income);
}
</style>
