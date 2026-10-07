import { COL, APP_ID, PROCESS_ID, REPORT_ID, PAGE_SIZE, MAX_PAGES, EMPTY_FILTERS } from './constants.js'

export function toText(val) {
    if (val === null || val === undefined) return ''
    if (typeof val === 'string' || typeof val === 'number' || typeof val === 'boolean') {
        return String(val).trim()
    }
    if (Array.isArray(val)) {
        if (!val.length) return ''
        return val
            .map((x) => x?.Name || x?.name || x?.FileName || x?.filename || toText(x))
            .filter(Boolean)
            .join(', ')
    }
    if (typeof val === 'object') {
        return (
            val.Name ||
            val.name ||
            val.Email ||
            val.Email ||
            val.Value ||
            val.value ||
            val.Text ||
            val.text ||
            ''
        )
    }
    return String(val)
}

export function parseAmount(raw) {
    if (raw === null || raw === undefined || raw === '') return 0
    if (typeof raw === 'number') return Number.isFinite(raw) ? raw : 0
    if (typeof raw === 'string') {
        const m = raw.replace(/,/g, '').match(/-?\d+(\.\d+)?/)
        return m ? Number(m[0]) || 0 : 0
    }
    if (typeof raw === 'object') {
        return parseAmount(raw?.value ?? raw?.Value ?? raw?.amount ?? raw?.Amount)
    }
    return 0
}

export function parseCurrencyCode(raw, fallback = 'INR') {
    if (raw === null || raw === undefined || raw === '') return fallback
    if (typeof raw === 'string') {
        const m = raw.match(/\b([A-Z]{3})\b/)
        if (m) return m[1]
        const parts = raw.trim().split(/\s+/)
        const last = parts[parts.length - 1]
        if (/^[A-Z]{3}$/.test(last)) return last
        return raw.trim() || fallback
    }
    if (typeof raw === 'object') {
        return (
            toText(raw?.CurrencyCode || raw?.currencyCode || raw?.Code || raw?.code) ||
            fallback
        )
    }
    return fallback
}

export function formatINR(amount, currency = 'INR') {
    const n = Number(amount) || 0
    try {
        return new Intl.NumberFormat('en-IN', {
            style: 'currency',
            currency: currency || 'INR',
            maximumFractionDigits: 0,
        }).format(n)
    } catch {
        return `${currency || 'INR'} ${n.toLocaleString('en-IN')}`
    }
}

export function formatCompactINR(amount) {
    const n = Number(amount) || 0
    if (n >= 1e7) return `₹ ${(n / 1e7).toFixed(2)} Cr`
    if (n >= 1e5) return `₹ ${(n / 1e5).toFixed(2)} L`
    return formatINR(n)
}

export function formatDate(raw) {
    if (!raw) return '—'
    const d = new Date(raw)
    if (Number.isNaN(d.getTime())) return String(raw)
    return d.toLocaleDateString('en-IN', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
    })
}

export function toDateMs(raw) {
    if (!raw) return null
    const d = new Date(raw)
    return Number.isNaN(d.getTime()) ? null : d.getTime()
}

export function resolveStatus(row) {
    const statusRaw = toText(row?._status ?? row?.Status ?? row?.status).trim()
    const stepRaw = toText(
        row?._current_step ?? row?.Current_step ?? row?.current_step ?? row?.Current_Step,
    ).trim()
    const status = statusRaw.toLowerCase().replace(/[\s_-]+/g, '')
    const step = stepRaw.toLowerCase()

    if (status === 'draft' || (!status && step.includes('draft'))) {
        return { key: 'draft', label: 'Draft', kfStatus: 'Draft' }
    }
    if (status.includes('reject') || status.includes('cancel') || step.includes('reject')) {
        return { key: 'rejected', label: 'Rejected', kfStatus: 'Rejected' }
    }
    if (status.includes('withdraw')) {
        return { key: 'withdrawn', label: 'Withdrawn', kfStatus: 'Withdrawn' }
    }
    if (
        status === 'completed' ||
        status === 'complete' ||
        status.includes('closed') ||
        (!status && (step.includes('complete') || step.includes('paid') || step.includes('approved')))
    ) {
        return { key: 'completed', label: 'Completed', kfStatus: 'Completed' }
    }
    if (
        status === 'inprogress' ||
        status === 'pending' ||
        status.includes('progress')
    ) {
        return { key: 'pending', label: stepRaw || 'Pending', kfStatus: 'InProgress' }
    }

    if (step.includes('draft')) return { key: 'draft', label: 'Draft', kfStatus: 'Draft' }
    if (step) return { key: 'pending', label: stepRaw, kfStatus: 'InProgress' }
    return { key: 'pending', label: 'Pending', kfStatus: 'InProgress' }
}

/** First usable Kissflow id from string / array / `{ _id }` (admin APIs often return arrays). */
function firstIdValue(val, depth = 0) {
    if (val == null || val === '' || depth > 5) return ''
    if (Array.isArray(val)) {
        for (const item of val) {
            const id = firstIdValue(item, depth + 1)
            if (id) return id
        }
        return ''
    }
    if (typeof val === 'object') {
        return firstIdValue(
            val._activity_instance_id ??
                val._context_activity_instance_id ??
                val._activityInstanceId ??
                val.ActivityInstanceId ??
                val.activity_instance_id ??
                val.Activity_Instance_ID ??
                val.Activity_ID ??
                val._id ??
                val.Id ??
                val.id,
            depth + 1,
        )
    }
    const s = String(val).trim()
    if (!s || s === '[object Object]') return ''
    return s
}

function activityIdFromContext(ctx) {
    if (!ctx) return ''
    const first = Array.isArray(ctx) ? ctx[0] : ctx
    return firstIdValue(
        first?._context_activity_instance_id ??
            first?._activity_instance_id ??
            first?._context_activity_id ??
            first,
    )
}

/** Extract workflow activity instance id — report, myitems, admin, and progress payloads. */
export function extractActivityInstanceId(row) {
    if (!row || typeof row !== 'object') return ''
    const firstCtx =
        Array.isArray(row._current_context) && row._current_context.length
            ? row._current_context[0]
            : row._current_context && typeof row._current_context === 'object'
              ? row._current_context
              : null
    return (
        firstIdValue(row._activity_instance_id) ||
        firstIdValue(row._context_activity_instance_id) ||
        firstIdValue(row._current_activity_instance_id) ||
        firstIdValue(row._activityInstanceId) ||
        firstIdValue(row.ActivityInstanceId) ||
        firstIdValue(row.activity_instance_id) ||
        firstIdValue(row.Activity_Instance_ID) ||
        firstIdValue(row.Activity_ID) ||
        firstIdValue(row._activity_id) ||
        firstIdValue(row._context_activity_id) ||
        firstIdValue(row.ActivityID) ||
        firstIdValue(row.activity_id) ||
        activityIdFromContext(firstCtx) ||
        ''
    )
}

function extractActivityIdFromScan(row) {
    if (!row || typeof row !== 'object') return ''
    const keys = Object.keys(row)
    for (const key of keys) {
        if (/activity.*instance|instance.*activity/i.test(key)) {
            const id = firstIdValue(row[key])
            if (id) return id
        }
    }
    return ''
}

function extractActivityIdFromProgress(progress) {
    if (!progress || typeof progress !== 'object') return ''
    const direct = extractActivityInstanceId(progress)
    if (direct) return direct

    const buckets = [
        progress.Steps,
        progress.steps,
        progress.Activities,
        progress.activities,
        progress.Data,
        progress.data,
        progress.Process,
        progress.process,
    ]
    const walk = (node, depth = 0) => {
        if (!node || depth > 6) return ''
        if (Array.isArray(node)) {
            const inProgress = node.find((s) =>
                /inprogress|pending|current/i.test(String(s?._status || s?.Status || s?.status || '')),
            )
            const ordered = inProgress ? [inProgress, ...node] : [...node].reverse()
            for (const item of ordered) {
                const id = walk(item, depth + 1)
                if (id) return id
            }
            return ''
        }
        if (typeof node === 'object') {
            const id =
                extractActivityInstanceId(node) ||
                walk(node.Steps || node.steps, depth + 1) ||
                walk(node.Process || node.process, depth + 1) ||
                walk(node.Activities || node.activities, depth + 1)
            if (id) return id
        }
        return ''
    }
    for (const bucket of buckets) {
        const id = walk(bucket)
        if (id) return id
    }
    return ''
}

/** @deprecated Use extractActivityInstanceId — kept for wide compatibility checks. */
export function extractActivityId(row) {
    return extractActivityInstanceId(row)
}

function unwrapKfApiResponse(resp) {
    if (!resp || typeof resp !== 'object') return resp
    return resp.Data ?? resp.data ?? resp
}

function mergeInstanceActivityMap(map, rows) {
    if (!Array.isArray(rows)) return
    for (const row of rows) {
        const iId = row?._id ? String(row._id) : ''
        const aId = extractActivityInstanceId(row)
        if (iId && aId && !map[iId]) map[iId] = aId
    }
}

export function mapRow(row) {
    const valueRaw = row?.[COL.invoiceValue] ?? row?.[COL.invoiceValueAlt] ?? row?.Invoice_Value
    const currencyFromValue = parseCurrencyCode(valueRaw, '')
    const currency =
        toText(row?.[COL.currencyCode]) ||
        currencyFromValue ||
        toText(row?.[COL.currencyString]) ||
        'INR'
    const status = resolveStatus(row)
    const invoiceNumber =
        toText(row?.[COL.invoiceNumber]) ||
        toText(row?.Invoice_Number) ||
        toText(row?.Invoice_No) ||
        toText(row?.Name) ||
        '—'

    return {
        id: row?._id || '',
        activityId: extractActivityInstanceId(row),
        month: toText(row?.[COL.month] ?? row?.Month),
        advocate: toText(row?.[COL.advocate] ?? row?.Advocate ?? row?.Counsel),
        invoiceNumber,
        invoiceDate: row?.[COL.invoiceDate] ?? row?.Invoice_Date,
        invoiceDateLabel: formatDate(row?.[COL.invoiceDate] ?? row?.Invoice_Date),
        amount: parseAmount(valueRaw),
        currency,
        caseType: toText(row?.[COL.caseType] ?? row?.Case_Type) || '—',
        description: toText(row?.[COL.description] ?? row?.Description),
        company: toText(row?.[COL.company] ?? row?.Company) || '—',
        department: toText(row?.[COL.department] ?? row?.Department) || '—',
        gst: toText(row?.[COL.gst]),
        pan: toText(row?.[COL.pan]),
        bankDetails: toText(row?.[COL.bankDetails]),
        convertCurrency: toText(row?.[COL.convertCurrency]),
        uploads: Array.isArray(row?.[COL.uploadInvoice]) ? row[COL.uploadInvoice] : [],
        engagementLetter: row?.[COL.engagementLetter],
        termsOfEngagement: row?.[COL.termsOfEngagement],
        statusKey: status.key,
        statusLabel: status.label,
        kfStatus: status.kfStatus,
        currentStep: toText(row?._current_step),
        source: row?._source || 'report',
        taskStepId: row?._taskStepId ? String(row._taskStepId) : '',
        taskStepName: row?._taskStepName ? String(row._taskStepName) : '',
        raw: row,
    }
}

export function uniqueSorted(values) {
    return [...new Set(values.map((v) => String(v || '').trim()).filter(Boolean))].sort((a, b) =>
        a.localeCompare(b),
    )
}

/** Count applied filters that differ from the page defaults. */
export function countActiveFilters(filters) {
    if (!filters) return 0
    return Object.keys(EMPTY_FILTERS).reduce((n, key) => {
        const value = String(filters[key] ?? '').trim()
        const fallback = String(EMPTY_FILTERS[key] ?? '').trim()
        return value !== fallback ? n + 1 : n
    }, 0)
}

export function applyFilters(rows, filters) {
    let list = [...rows]

    if (filters.search) {
        const q = filters.search.toLowerCase()
        list = list.filter(
            (r) =>
                r.invoiceNumber.toLowerCase().includes(q) ||
                r.advocate.toLowerCase().includes(q) ||
                r.company.toLowerCase().includes(q) ||
                r.caseType.toLowerCase().includes(q) ||
                r.description.toLowerCase().includes(q),
        )
    }
    if (filters.company) list = list.filter((r) => r.company === filters.company)
    if (filters.advocate) list = list.filter((r) => r.advocate === filters.advocate)
    if (filters.caseType) list = list.filter((r) => r.caseType === filters.caseType)
    if (filters.department) list = list.filter((r) => r.department === filters.department)
    if (filters.month) list = list.filter((r) => r.month === filters.month)
    if (filters.currency) list = list.filter((r) => r.currency === filters.currency)
    if (filters.gst) list = list.filter((r) => r.gst === filters.gst)
    if (filters.status) {
        if (filters.status === 'paid') {
            list = list.filter((r) => r.statusKey === 'completed' || r.statusKey === 'paid')
        } else {
            list = list.filter((r) => r.statusKey === filters.status)
        }
    }

    if (filters.dateFrom) {
        const from = toDateMs(filters.dateFrom)
        if (from != null) {
            list = list.filter((r) => {
                const t = toDateMs(r.invoiceDate)
                return t == null || t >= from
            })
        }
    }
    if (filters.dateTo) {
        const to = toDateMs(filters.dateTo)
        if (to != null) {
            const end = to + 24 * 60 * 60 * 1000 - 1
            list = list.filter((r) => {
                const t = toDateMs(r.invoiceDate)
                return t == null || t <= end
            })
        }
    }

    const min = filters.valueMin !== '' ? Number(filters.valueMin) : null
    const max = filters.valueMax !== '' ? Number(filters.valueMax) : null
    if (min != null && Number.isFinite(min)) list = list.filter((r) => r.amount >= min)
    if (max != null && Number.isFinite(max)) list = list.filter((r) => r.amount <= max)

    if (filters.valueSort === 'high') {
        list.sort((a, b) => b.amount - a.amount)
    } else if (filters.valueSort === 'low') {
        list.sort((a, b) => a.amount - b.amount)
    } else {
        list.sort((a, b) => (toDateMs(b.invoiceDate) || 0) - (toDateMs(a.invoiceDate) || 0))
    }

    return list
}

export function buildKpis(rows) {
    const totalValue = rows.reduce((s, r) => s + r.amount, 0)
    const total = rows.length
    const completed = rows.filter(
        (r) => r.statusKey === 'completed' || r.statusKey === 'paid',
    ).length
    const pending = rows.filter((r) => r.statusKey === 'pending').length
    const draft = rows.filter((r) => r.statusKey === 'draft').length
    const rejected = rows.filter((r) => r.statusKey === 'rejected').length
    const openAmount = rows
        .filter((r) => r.statusKey === 'pending' || r.statusKey === 'draft')
        .reduce((s, r) => s + r.amount, 0)

    return {
        totalValue,
        total,
        paid: completed,
        completed,
        pending,
        draft,
        rejected,
        openAmount,
    }
}

export function buildTrend(rows) {
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
    const totals = Array(12).fill(0)
    for (const r of rows) {
        const d = new Date(r.invoiceDate)
        if (Number.isNaN(d.getTime())) continue
        totals[d.getMonth()] += r.amount
    }
    return months.map((m, i) => ({ month: m, value: Math.round(totals[i]) }))
}

export function buildGroupSum(rows, key, limit = 6) {
    const map = new Map()
    for (const r of rows) {
        const k = r[key] || 'Other'
        map.set(k, (map.get(k) || 0) + r.amount)
    }
    return [...map.entries()]
        .map(([name, value]) => ({ name, value: Math.round(value) }))
        .sort((a, b) => b.value - a.value)
        .slice(0, limit)
}

export function buildCurrencyBreakdown(rows) {
    const map = new Map()
    for (const r of rows) {
        const c = r.currency || 'INR'
        map.set(c, (map.get(c) || 0) + r.amount)
    }
    const total = [...map.values()].reduce((s, v) => s + v, 0) || 1
    return [...map.entries()]
        .map(([code, value]) => ({
            code,
            value: Math.round(value),
            pct: Math.round((value / total) * 1000) / 10,
        }))
        .sort((a, b) => b.value - a.value)
}

export async function fetchAllClaimRows(kfInstance, accountId) {
    const all = []
    const reportActivityMap = {}
    for (let page = 1; page <= MAX_PAGES; page++) {
        const url = `/process-report/2/${accountId}/${PROCESS_ID}/${REPORT_ID}?_application_id=${APP_ID}&page_number=${page}&page_size=${PAGE_SIZE}`
        const resp = await kfInstance.api(url)
        const rows = Array.isArray(resp?.Data) ? resp.Data : []
        if (!rows.length) break
        for (const row of rows) {
            const iId = row?._id ? String(row._id) : ''
            const aId = extractActivityInstanceId(row)
            if (iId && aId) reportActivityMap[iId] = aId
        }
        all.push(...rows)
        if (rows.length < PAGE_SIZE) break
    }
    return { rows: all.map(mapRow), reportActivityMap }
}

/** Build instance → activity map + fallback step id (employee-dashboard-v2 pattern). */
export async function fetchClaimActivityContext(kfInstance, accountId) {
    const instanceActivityMap = {}
    let fallbackActivityId = ''

    if (!accountId || !kfInstance?.api) {
        return { fallbackActivityId, instanceActivityMap }
    }

    const apiGet = (url) => kfInstance.api(url)

    try {
        const pendingUrl = `/process/2/${accountId}/${PROCESS_ID}/pending/activity/count?_application_id=${APP_ID}`
        const resp = await apiGet(pendingUrl)
        const list = Array.isArray(resp) ? resp : (resp?.Data ?? resp?.data ?? [])
        const first = Array.isArray(list) ? list.find((x) => x?._id) : null
        fallbackActivityId = first?._id ? String(first._id) : ''

        if (Array.isArray(list)) {
            await Promise.all(
                list.map(async (act) => {
                    const activityId = act?._id
                    if (!activityId) return
                    try {
                        for (let page = 1; page <= MAX_PAGES; page++) {
                            const pendingListUrl = `/process/2/${accountId}/${PROCESS_ID}/pending/${activityId}?_application_id=${APP_ID}&page_number=${page}&page_size=${PAGE_SIZE}`
                            const pendingResp = await apiGet(pendingListUrl)
                            const pendingRows = pendingResp?.Data || pendingResp?.data || []
                            if (!Array.isArray(pendingRows) || !pendingRows.length) break
                            mergeInstanceActivityMap(instanceActivityMap, pendingRows)
                            if (pendingRows.length < PAGE_SIZE) break
                        }
                    } catch {
                        // ignore per-activity failures
                    }
                }),
            )
        }

        for (let page = 1; page <= MAX_PAGES; page++) {
            const myItemsUrl = `/process/2/${accountId}/${PROCESS_ID}/myitems?apply_preference=true&skip_aggregation=true&_application_id=${APP_ID}&page_number=${page}&page_size=${PAGE_SIZE}`
            let myItemsResp
            try {
                myItemsResp = await apiGet(myItemsUrl)
            } catch {
                break
            }
            const myItemsRows = myItemsResp?.Data || myItemsResp?.data || []
            if (!Array.isArray(myItemsRows) || !myItemsRows.length) break
            mergeInstanceActivityMap(instanceActivityMap, myItemsRows)
            if (myItemsRows.length < PAGE_SIZE) break
        }

        // PWA lists (solar-expense-dashboard-v2) — often carry _activity_instance_id for report-only rows.
        for (let page = 1; page <= MAX_PAGES; page++) {
            const pwaMyUrl = `/process/2/${accountId}/pwa/${PROCESS_ID}/myitems?page_number=${page}&page_size=${PAGE_SIZE}`
            let pwaMyResp
            try {
                pwaMyResp = await apiGet(pwaMyUrl)
            } catch {
                break
            }
            const pwaMyRows = pwaMyResp?.Data || pwaMyResp?.data || []
            if (!Array.isArray(pwaMyRows) || !pwaMyRows.length) break
            mergeInstanceActivityMap(instanceActivityMap, pwaMyRows)
            if (pwaMyRows.length < PAGE_SIZE) break
        }

        for (let page = 1; page <= MAX_PAGES; page++) {
            const pwaPendingUrl = `/process/2/${accountId}/pwa/${PROCESS_ID}/pending?page_number=${page}&page_size=${PAGE_SIZE}`
            let pwaPendingResp
            try {
                pwaPendingResp = await apiGet(pwaPendingUrl)
            } catch {
                break
            }
            const pwaPendingRows = pwaPendingResp?.Data || pwaPendingResp?.data || []
            if (!Array.isArray(pwaPendingRows) || !pwaPendingRows.length) break
            mergeInstanceActivityMap(instanceActivityMap, pwaPendingRows)
            if (pwaPendingRows.length < PAGE_SIZE) break
        }

        // Submitted / completed items often only appear in participated + report.
        const participatedActs = Array.isArray(list) ? list : []
        const participatedListUrl = `/process/2/${accountId}/${PROCESS_ID}/participated/activity/count?_application_id=${APP_ID}`
        let participatedActsResp
        try {
            participatedActsResp = await apiGet(participatedListUrl)
        } catch {
            participatedActsResp = []
        }
        const participatedActsList = Array.isArray(participatedActsResp)
            ? participatedActsResp
            : (participatedActsResp?.Data ?? participatedActsResp?.data ?? [])
        const allActs = [...participatedActs, ...(Array.isArray(participatedActsList) ? participatedActsList : [])]

        await Promise.all(
            allActs.map(async (act) => {
                const activityId = act?._id
                if (!activityId) return
                try {
                    for (let page = 1; page <= MAX_PAGES; page++) {
                        const partUrl =
                            `/process/2/${accountId}/${PROCESS_ID}/participated/activity/${encodeURIComponent(String(activityId))}` +
                            `?_application_id=${APP_ID}&apply_preference=true&page_number=${page}&page_size=${PAGE_SIZE}&skip_aggregation=true`
                        const partResp = await apiGet(partUrl)
                        const partRows = partResp?.Data || partResp?.data || []
                        if (!Array.isArray(partRows) || !partRows.length) break
                        mergeInstanceActivityMap(instanceActivityMap, partRows)
                        if (partRows.length < PAGE_SIZE) break
                    }
                } catch {
                    // ignore per-activity failures
                }
            }),
        )
    } catch (e) {
        console.warn('fetchClaimActivityContext failed', e)
    }

    return { fallbackActivityId, instanceActivityMap }
}

export function resolveClaimPopupIds(row, instanceActivityMap = {}) {
    const instanceId = String(row?.id || row?.raw?._id || '').trim()
    let activityId = String(
        row?.activityId || extractActivityInstanceId(row?.raw || row) || '',
    ).trim()

    if (!activityId && instanceId && instanceActivityMap?.[instanceId]) {
        activityId = String(instanceActivityMap[instanceId]).trim()
    }

    return { instanceId, activityId }
}

/** Lookup activity id from myitems by instance id (expense-dashboard pattern). */
async function resolveActivityFromMyitems(kfInstance, accountId, instanceId) {
    if (!accountId || !instanceId || !kfInstance?.api) return ''

    const needle = String(instanceId).trim()
    for (let page = 1; page <= MAX_PAGES; page++) {
        const url = `/process/2/${accountId}/${PROCESS_ID}/myitems?apply_preference=true&skip_aggregation=true&_application_id=${APP_ID}&page_number=${page}&page_size=${PAGE_SIZE}`
        let resp
        try {
            resp = await kfInstance.api(url)
        } catch {
            break
        }
        const rows = resp?.Data || resp?.data || []
        if (!Array.isArray(rows) || !rows.length) break
        const hit = rows.find((r) => String(r?._id || '').trim() === needle)
        if (hit) {
            const aid = extractActivityInstanceId(hit)
            if (aid) return aid
        }
        if (rows.length < PAGE_SIZE) break
    }
    return ''
}

async function resolveActivityFromAdminItem(kfInstance, accountId, instanceId) {
    const process = kfInstance?.app?.getProcess?.(PROCESS_ID)
    if (process?.getAdminItem) {
        try {
            const item = await process.getAdminItem({ instanceId })
            const aid =
                extractActivityInstanceId(item) ||
                extractActivityInstanceId(unwrapKfApiResponse(item))
            if (aid) return aid
        } catch (e) {
            console.warn('getAdminItem failed', instanceId, e)
        }
    }

    const urls = [
        `/process/2/${accountId}/admin/${PROCESS_ID}/${instanceId}?_application_id=${encodeURIComponent(APP_ID)}`,
        `/process/2/${accountId}/admin/${PROCESS_ID}/item/${instanceId}?_application_id=${encodeURIComponent(APP_ID)}`,
        `/process/2/${accountId}/${PROCESS_ID}/admin/${instanceId}?_application_id=${encodeURIComponent(APP_ID)}`,
    ]
    for (const url of urls) {
        try {
            const resp = await kfInstance.api(url, {
                method: 'GET',
                headers: { Accept: 'application/json' },
            })
            const item = unwrapKfApiResponse(resp)
            const aid = extractActivityInstanceId(item) || extractActivityIdFromScan(item)
            if (aid) return aid
        } catch {
            // try next shape
        }
    }
    return ''
}

async function resolveActivityFromProgress(kfInstance, accountId, instanceId) {
    const process = kfInstance?.app?.getProcess?.(PROCESS_ID)
    if (process?.getProgress) {
        try {
            const progress = await process.getProgress({ instanceId })
            const aid = extractActivityIdFromProgress(progress)
            if (aid) return aid
        } catch (e) {
            console.warn('getProgress failed', instanceId, e)
        }
    }

    try {
        const url = `/process/2/${accountId}/${PROCESS_ID}/${encodeURIComponent(instanceId)}/progress?_application_id=${encodeURIComponent(APP_ID)}`
        const resp = await kfInstance.api(url, {
            method: 'GET',
            headers: { Accept: 'application/json' },
        })
        return extractActivityIdFromProgress(unwrapKfApiResponse(resp) || resp)
    } catch (e) {
        console.warn('progress GET failed', instanceId, e)
        return ''
    }
}

/**
 * Resolve activity_id for popup — row → map → myitems → admin item → process GET → progress.
 */
export async function resolveClaimActivityForPopup({
    kfInstance,
    row,
    instanceActivityMap = {},
    instanceId,
}) {
    let activityId =
        resolveClaimPopupIds(row, instanceActivityMap).activityId ||
        extractActivityIdFromScan(row?.raw || row)
    if (activityId) return activityId

    const accountId = kfInstance?.account?._id
    if (!instanceId || !accountId) return ''

    if (kfInstance?.api) {
        activityId = await resolveActivityFromMyitems(kfInstance, accountId, instanceId)
        if (activityId) return activityId
    }

    activityId = await resolveActivityFromAdminItem(kfInstance, accountId, instanceId)
    if (activityId) return activityId

    if (kfInstance?.api) {
        try {
            const url = `/process/2/${accountId}/${PROCESS_ID}/${instanceId}?_application_id=${encodeURIComponent(APP_ID)}`
            const resp = await kfInstance.api(url, {
                method: 'GET',
                headers: { Accept: 'application/json' },
            })
            const item = unwrapKfApiResponse(resp)
            activityId = extractActivityInstanceId(item) || extractActivityIdFromScan(item)
            if (activityId) return activityId
        } catch (e) {
            console.warn('resolveClaimActivityForPopup process GET failed', instanceId, e)
        }
    }

    activityId = await resolveActivityFromProgress(kfInstance, accountId, instanceId)
    if (activityId) return activityId

    return ''
}

/**
 * Popup params so a process form inside CLAIM_POPUP_ID can bind an existing item.
 * Kissflow popup docs: instanceId + activityInstanceId
 * Working sibling apps (assign-asset / asset-requests): Instance_ID + Activity_ID
 */
export function buildClaimPopupParams(instanceId, activityId) {
    const actId = String(activityId || '').trim()
    const instId = String(instanceId || '').trim()
    return {
        Instance_ID: instId,
        Activity_ID: actId,
        instanceId: instId,
        activityInstanceId: actId,
        _id: instId,
        _activity_instance_id: actId,
        instance_id: instId,
        activity_id: actId,
        activity_instance_id: actId,
        Activity_Instance_ID: actId,
        ActivityID: actId,
        InstanceId: instId,
        ActivityInstanceId: actId,
        ActivityId: actId,
        activityId: actId,
        InstanceID: instId,
        width: 960,
        height: 720,
        popupWidth: '960px',
        popupHeight: '720px',
    }
}

function getProcessApi(client) {
    return client?.app?.getProcess?.(PROCESS_ID) || null
}

/** Kissflow documented API — opens the saved process item (fields + line items). */
export async function openExistingClaimForm(client, instanceId, activityId) {
    const instId = String(instanceId || '').trim()
    const actId = String(activityId || '').trim()
    const process = getProcessApi(client)
    if (!process?.openForm || !instId || !actId) return false
    try {
        await process.openForm({
            _id: instId,
            _activity_instance_id: actId,
        })
        return true
    } catch (e) {
        console.warn('openExistingClaimForm failed', e)
        return false
    }
}

/**
 * Open an existing claim for view/edit.
 * 1) process.openForm — this is what actually loads saved data
 * 2) same Create Claim popup + initForm — if the popup's process widget can bind
 */
export async function openExistingClaim(client, { instanceId, activityId, popupId }) {
    const instId = String(instanceId || '').trim()
    const actId = String(activityId || '').trim()
    const process = getProcessApi(client)
    const params = buildClaimPopupParams(instId, actId)

    const openedForm = await openExistingClaimForm(client, instId, actId)
    if (openedForm) return true

    if (popupId && client?.app?.page?.openPopup) {
        try {
            const result = client.app.page.openPopup(popupId, params)
            if (process?.initForm) {
                try {
                    await process.initForm(instId, actId)
                } catch (e) {
                    console.warn('initForm failed', e)
                }
            }
            if (result && typeof result.then === 'function') {
                await result.catch((e) => {
                    console.error('openPopup rejected', e)
                })
            }
            return true
        } catch (e) {
            console.error('openExistingClaim popup failed', e)
        }
    }

    return false
}

const INBOX_COLUMNS = [
    { Id: 'Name', Model: PROCESS_ID },
    { Id: '_created_at', Model: PROCESS_ID },
    { Id: '_current_step', Model: PROCESS_ID },
    { Id: '_status', Model: PROCESS_ID },
    { Id: '_activity_instance_id', Model: PROCESS_ID },
    { Id: '_current_assigned_to', Model: PROCESS_ID },
]

async function postWorkflowPreference(kfInstance, accountId, viewId, viewType) {
    const url = `/common/2/${accountId}/preference/${PROCESS_ID}/${viewType}/${encodeURIComponent(String(viewId))}/?_application_id=${APP_ID}`
    try {
        await kfInstance.api(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
            body: JSON.stringify({
                AppId: PROCESS_ID,
                ConfigJson: { Columns: INBOX_COLUMNS, Filter: {}, Sort: [] },
                ViewId: viewId,
                ViewType: viewType,
            }),
        })
    } catch (e) {
        console.warn('workflow preference POST failed', viewId, e)
    }
}

async function fetchPagedProcessRows(kfInstance, makeUrl) {
    const all = []
    for (let page = 1; page <= MAX_PAGES; page++) {
        let resp
        try {
            resp = await kfInstance.api(makeUrl(page), {
                method: 'GET',
                headers: { Accept: 'application/json' },
            })
        } catch {
            break
        }
        const rows = Array.isArray(resp?.Data)
            ? resp.Data
            : Array.isArray(resp?.data)
              ? resp.data
              : []
        if (!rows.length) break
        all.push(...rows)
        if (rows.length < PAGE_SIZE) break
    }
    return all
}

export async function fetchMyItemsStatusCounts(kfInstance, accountId) {
    const empty = {
        Draft: 0,
        InProgress: 0,
        Completed: 0,
        Withdrawn: 0,
        Rejected: 0,
    }
    if (!kfInstance?.api || !accountId) return empty
    try {
        const res = await kfInstance.api(
            `/process/2/${accountId}/${PROCESS_ID}/myitems/status/count?_application_id=${APP_ID}`,
        )
        return {
            Draft: res?.Draft || 0,
            InProgress: res?.InProgress || 0,
            Completed: res?.Completed || 0,
            Withdrawn: res?.Withdrawn || 0,
            Rejected: res?.Rejected || 0,
        }
    } catch (e) {
        console.warn('myitems status count failed', e)
        return empty
    }
}

async function fetchMyItemsForStatus(kfInstance, accountId, status) {
    await postWorkflowPreference(kfInstance, accountId, status, 'WorkflowStep')
    const rows = await fetchPagedProcessRows(
        kfInstance,
        (page) =>
            `/process/2/${accountId}/${PROCESS_ID}/myitems/${status}?page_number=${page}&page_size=${PAGE_SIZE}&apply_preference=true&_application_id=${APP_ID}`,
    )
    return rows.map((r) => ({ ...r, _source: 'myItems', _kf_list_status: status }))
}

async function fetchMyTasksInbox(kfInstance, accountId) {
    let steps = []
    try {
        const resp = await kfInstance.api(
            `/process/2/${accountId}/${PROCESS_ID}/pending/activity/count?_application_id=${APP_ID}`,
        )
        steps = Array.isArray(resp) ? resp : (resp?.Data ?? resp?.data ?? [])
        if (!Array.isArray(steps)) steps = []
    } catch (e) {
        console.warn('pending activity count failed', e)
        steps = []
    }

    const taskRows = []
    await Promise.all(
        steps.map(async (step) => {
            const activityId = step?._id
            if (!activityId) return
            await postWorkflowPreference(kfInstance, accountId, activityId, 'WorkflowStep')
            const rows = await fetchPagedProcessRows(
                kfInstance,
                (page) =>
                    `/process/2/${accountId}/${PROCESS_ID}/pending/${encodeURIComponent(String(activityId))}?apply_preference=true&page_number=${page}&page_size=${PAGE_SIZE}&skip_aggregation=true&_application_id=${APP_ID}`,
            )
            for (const r of rows) {
                taskRows.push({
                    ...r,
                    _source: 'myTasks',
                    _taskStepId: String(activityId),
                    _taskStepName: String(step.StepName || step.Name || ''),
                    _status: r._status || 'InProgress',
                })
            }
        }),
    )

    return { steps, taskRows }
}

function overlayReportFields(inboxRaw, reportMapped) {
    const reportRaw = reportMapped?.raw || {}
    const merged = { ...reportRaw, ...inboxRaw }
    const row = mapRow(merged)
    row.source = inboxRaw._source || 'myItems'
    row.taskStepId = inboxRaw._taskStepId ? String(inboxRaw._taskStepId) : ''
    row.taskStepName = inboxRaw._taskStepName ? String(inboxRaw._taskStepName) : ''
    if (reportMapped) {
        if (!row.advocate) row.advocate = reportMapped.advocate
        if (row.invoiceNumber === '—' && reportMapped.invoiceNumber !== '—') {
            row.invoiceNumber = reportMapped.invoiceNumber
        }
        if (row.company === '—' && reportMapped.company !== '—') row.company = reportMapped.company
        if (row.caseType === '—' && reportMapped.caseType !== '—') row.caseType = reportMapped.caseType
        if (!row.amount && reportMapped.amount) {
            row.amount = reportMapped.amount
            row.currency = reportMapped.currency
        }
        if (row.invoiceDateLabel === '—' && reportMapped.invoiceDateLabel !== '—') {
            row.invoiceDate = reportMapped.invoiceDate
            row.invoiceDateLabel = reportMapped.invoiceDateLabel
        }
    }
    return row
}

/**
 * Live when Kissflow SDK + api are available.
 * Mock data is only for local `npm run dev` — never used inside Kissflow / production builds.
 */
export async function loadLegalExpenseRows(kfInstance) {
    const accountId = kfInstance?.account?._id
    const canLive = Boolean(kfInstance?.api && accountId)

    if (canLive) {
        const [{ rows: reportRows, reportActivityMap }, activityContext, myItemsCounts] =
            await Promise.all([
                fetchAllClaimRows(kfInstance, accountId),
                fetchClaimActivityContext(kfInstance, accountId),
                fetchMyItemsStatusCounts(kfInstance, accountId),
            ])

        const [draftRows, pendingRows, completedRows, rejectedRows, withdrawnRows, tasks] =
            await Promise.all([
                fetchMyItemsForStatus(kfInstance, accountId, 'Draft'),
                fetchMyItemsForStatus(kfInstance, accountId, 'InProgress'),
                fetchMyItemsForStatus(kfInstance, accountId, 'Completed'),
                fetchMyItemsForStatus(kfInstance, accountId, 'Rejected'),
                fetchMyItemsForStatus(kfInstance, accountId, 'Withdrawn'),
                fetchMyTasksInbox(kfInstance, accountId),
            ])

        const reportById = new Map(reportRows.map((r) => [String(r.id), r]))
        const inboxRaw = [
            ...pendingRows,
            ...draftRows,
            ...completedRows,
            ...rejectedRows,
            ...withdrawnRows,
            ...(tasks.taskRows || []),
        ]

        const rows = inboxRaw.map((raw) =>
            overlayReportFields(raw, reportById.get(String(raw?._id || ''))),
        )

        const instanceActivityMap = {
            ...activityContext.instanceActivityMap,
            ...reportActivityMap,
        }
        for (const r of rows) {
            if (r.id && r.activityId && !instanceActivityMap[r.id]) {
                instanceActivityMap[r.id] = r.activityId
            }
        }

        return {
            rows,
            reportRows,
            connected: true,
            instanceActivityMap,
            fallbackActivityId: activityContext.fallbackActivityId || '',
            myItemsCounts,
            taskSteps: tasks.steps || [],
        }
    }

    if (import.meta.env.DEV) {
        const { MOCK_LEGAL_REPORT } = await import('../mocks/legalExpenseClaims.js')
        const mapped = (MOCK_LEGAL_REPORT.Data || []).map((raw) => {
            const row = mapRow({ ...raw, _source: 'myItems' })
            row.source = 'myItems'
            return row
        })
        const pending = mapped.filter((r) => r.statusKey === 'pending')
        const taskRows = pending.map((r) => ({
            ...r,
            source: 'myTasks',
            taskStepId: 'mock-task-step',
            taskStepName: 'Pending Approval',
            id: r.id,
        }))
        const counts = { Draft: 0, InProgress: 0, Completed: 0, Withdrawn: 0, Rejected: 0 }
        for (const r of mapped) {
            if (r.kfStatus && counts[r.kfStatus] != null) counts[r.kfStatus] += 1
        }
        return {
            rows: [...mapped, ...taskRows],
            reportRows: mapped,
            connected: false,
            instanceActivityMap: {},
            fallbackActivityId: '',
            myItemsCounts: counts,
            taskSteps: [
                {
                    _id: 'mock-task-step',
                    StepName: 'Pending Approval',
                    Count: taskRows.length,
                },
            ],
        }
    }

    return {
        rows: [],
        reportRows: [],
        connected: false,
        instanceActivityMap: {},
        fallbackActivityId: '',
        myItemsCounts: {
            Draft: 0,
            InProgress: 0,
            Completed: 0,
            Withdrawn: 0,
            Rejected: 0,
        },
        taskSteps: [],
    }
}

export function buildMisSummaryText(rows, filters, userName, company) {
    const kpis = buildKpis(rows)
    const lines = [
        `Legal Expense MIS Report`,
        `Generated for: ${userName || 'User'} · ${company || '—'}`,
        `Generated at: ${new Date().toLocaleString('en-IN')}`,
        ``,
        `Filters:`,
        `• Company: ${filters.company || 'All'}`,
        `• Advocate/Firm: ${filters.advocate || 'All'}`,
        `• Case Type: ${filters.caseType || 'All'}`,
        `• Department: ${filters.department || 'All'}`,
        `• Period: ${(filters.dateFrom || '—') + ' to ' + (filters.dateTo || '—')}`,
        ``,
        `Summary:`,
        `• Total Invoice Value: ${formatINR(kpis.totalValue)}`,
        `• Total Invoices: ${kpis.total}`,
        `• Paid: ${kpis.paid}`,
        `• Pending / Open: ${kpis.pending}`,
        `• Open Amount: ${formatINR(kpis.openAmount)}`,
        ``,
        `Top invoices:`,
        ...rows.slice(0, 10).map(
            (r, i) =>
                `${i + 1}. ${r.invoiceNumber} | ${r.advocate} | ${r.company} | ${formatINR(r.amount, r.currency)} | ${r.statusLabel}`,
        ),
    ]
    return lines.join('\n')
}
