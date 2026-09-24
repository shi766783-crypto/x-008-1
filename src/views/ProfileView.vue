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
          <p class="muted">数据仅保存在本浏览器，换设备或清理缓存会全部丢失。可将账户、流水、预算、目标和成就打包成 JSON 文件下载，导出过程不改动任何现有数据。</p>
          <p v-if="lastExport" class="export-done">
            ✅ 已导出 {{ lastExport.filename }}（流水 {{ lastExport.summary.transactions }} 笔，收入 ¥{{ money(lastExport.summary.totalIncome) }}，支出 ¥{{ money(lastExport.summary.totalExpense) }}）
          </p>
        </div>
        <button class="btn btn-primary" @click="openExport">导出数据</button>
      </div>
    </section>

    <Modal title="导出数据备份" @close="exportOpen = false" v-if="exportOpen">
      <div class="seg">
        <button type="button" class="seg-btn" :class="{ active: exportScope === 'all' }" @click="exportScope = 'all'">全部数据</button>
        <button type="button" class="seg-btn" :class="{ active: exportScope === 'range' }" @click="exportScope = 'range'">按月份范围</button>
      </div>

      <template v-if="exportScope === 'range'">
        <div class="range-fields">
          <label class="field">
            <span>开始月份</span>
            <input type="month" v-model="fromMonth" />
          </label>
          <label class="field">
            <span>结束月份</span>
            <input type="month" v-model="toMonth" />
          </label>
        </div>
        <p class="muted range-hint">账户、储蓄目标与成就始终完整导出，月份范围仅筛选流水与预算。</p>
      </template>

      <p v-if="rangeInvalid" class="export-warn">开始月份不能晚于结束月份，请重新选择。</p>

      <template v-else-if="exportPreview">
        <p v-if="previewEmpty" class="export-empty">当前范围没有任何可导出的数据（账本为空），请先添加账户或记下第一笔收支。</p>
        <div v-else class="export-preview">
          <div class="preview-row">
            <span>账户 <b>{{ exportPreview.summary.accounts }}</b> 个</span>
            <span>流水 <b>{{ exportPreview.summary.transactions }}</b> 笔</span>
            <span>预算 <b>{{ exportPreview.summary.budgets }}</b> 条</span>
            <span>目标 <b>{{ exportPreview.summary.goals }}</b> 个</span>
            <span>成就 <b>{{ exportPreview.summary.achievements }}</b> 枚</span>
          </div>
          <div class="preview-row">
            <span>收入合计 <b class="income">+¥{{ money(exportPreview.summary.totalIncome) }}</b></span>
            <span>支出合计 <b class="expense">-¥{{ money(exportPreview.summary.totalExpense) }}</b></span>
            <span>转账合计 <b>¥{{ money(exportPreview.summary.totalTransfer) }}</b></span>
            <span>净结余 <b>¥{{ money(exportPreview.summary.net) }}</b></span>
          </div>
          <p class="muted preview-note">以上条数与金额会一并写入导出文件的 summary 中，下载后可直接打开文件核对。</p>
        </div>
      </template>

      <template #footer>
        <button type="button" class="btn" @click="exportOpen = false">取消</button>
        <button type="button" class="btn btn-primary" :disabled="exportDisabled" @click="doExport">导出备份文件</button>
      </template>
    </Modal>
  </div>
</template>

<script setup>
import { computed, ref } from 'vue'
import { useStore, controllersApi } from '../data/store.js'
import { money, todayStr } from '../core/utils.js'
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
const exportScope = ref('all')
const fromMonth = ref('')
const toMonth = ref('')
const lastExport = ref(null)

const thisMonth = todayStr().slice(0, 7)

const openExport = () => {
  exportScope.value = 'all'
  const months = store.transactions.map((t) => t.date.slice(0, 7)).sort()
  fromMonth.value = months[0] || thisMonth
  toMonth.value = thisMonth
  exportOpen.value = true
}

const exportPreview = computed(() => {
  // 访问响应式 store，保证其他页面改动数据后重新打开弹窗时预览会刷新
  void (store.accounts, store.transactions, store.budgets, store.goals, store.achievements)
  if (exportScope.value === 'range') {
    if (!fromMonth.value || !toMonth.value || fromMonth.value > toMonth.value) return null
    return exporter.buildExportPayload({ fromMonth: fromMonth.value, toMonth: toMonth.value })
  }
  return exporter.buildExportPayload()
})

const rangeInvalid = computed(
  () => exportScope.value === 'range' && fromMonth.value && toMonth.value && fromMonth.value > toMonth.value
)
const previewEmpty = computed(() => (exportPreview.value ? exporter.isPayloadEmpty(exportPreview.value) : false))
const exportDisabled = computed(() => !exportPreview.value || previewEmpty.value)

const doExport = () => {
  const options = exportScope.value === 'range' ? { fromMonth: fromMonth.value, toMonth: toMonth.value } : {}
  const result = exporter.exportLedger(options)
  if (!result.ok) return
  lastExport.value = { filename: result.filename, summary: result.payload.summary }
  exportOpen.value = false
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
  flex-wrap: wrap;
}
.export-info {
  flex: 1;
  min-width: 220px;
}
.export-info p {
  margin: 6px 0 0;
  font-size: 13px;
}
.export-done {
  color: var(--income);
  font-weight: 600;
  word-break: break-all;
}
.range-fields {
  display: flex;
  gap: 12px;
}
.range-fields .field {
  flex: 1;
}
.range-hint {
  font-size: 12px;
  margin: -4px 0 12px;
}
.export-warn {
  color: var(--expense);
  font-size: 13px;
  margin: 4px 0 8px;
}
.export-empty {
  background: rgba(240, 201, 87, 0.15);
  border: 1px solid rgba(224, 164, 31, 0.4);
  color: #b8860b;
  border-radius: 10px;
  padding: 12px 14px;
  font-size: 13px;
  margin: 4px 0 8px;
}
.export-preview {
  background: var(--bg-elevated);
  border-radius: 10px;
  padding: 12px 14px;
  margin: 4px 0 8px;
}
.preview-row {
  display: flex;
  flex-wrap: wrap;
  gap: 6px 16px;
  font-size: 13px;
  color: var(--text-secondary);
  padding: 3px 0;
}
.preview-row b {
  color: var(--text-primary);
}
.preview-row b.income {
  color: var(--income);
}
.preview-row b.expense {
  color: var(--expense);
}
.preview-note {
  font-size: 12px;
  margin: 8px 0 0;
}
.btn-primary:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
</style>
