import { useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { KissflowSDKContext, kf } from './../sdk/index.js'
import {
    CLAIM_POPUP_ID,
    EMPTY_FILTERS,
    MY_ITEM_TABS,
    TABLE_PAGE_SIZE,
} from './constants.js'
import {
    applyFilters,
    buildGroupSum,
    buildKpis,
    countActiveFilters,
    formatCompactINR,
    formatINR,
    loadLegalExpenseRows,
    openExistingClaim,
    resolveClaimActivityForPopup,
    uniqueSorted,
} from './utils.js'
import { FilterSheet } from './FilterSheet.jsx'
import './dashboard.css'

function SelectField({ label, value, onChange, options, placeholder = 'All' }) {
    return (
        <div className="field">
            <label>{label}</label>
            <select value={value} onChange={(e) => onChange(e.target.value)}>
                <option value="">{placeholder}</option>
                {options.map((opt) => (
                    <option key={opt} value={opt}>
                        {opt}
                    </option>
                ))}
            </select>
        </div>
    )
}

function KpiCard({ label, value, hint, icon, color, glow, delay }) {
    return (
        <div
            className="kpiCard"
            style={{ '--glow': glow, animationDelay: `${delay}s` }}
        >
            <div className="kpiTop">
                <p className="kpiLabel">{label}</p>
                <div
                    className="kpiIcon"
                    style={{ background: `${color}18`, color }}
                >
                    <i className={icon} />
                </div>
            </div>
            <p className="kpiValue">{value}</p>
            {hint ? <p className="kpiHint">{hint}</p> : null}
        </div>
    )
}



function statusClass(key) {
    if (key === 'completed' || key === 'paid') return 'badgePaid'
    if (key === 'pending') return 'badgePending'
    if (key === 'rejected') return 'badgeRejected'
    if (key === 'draft') return 'badgeDraft'
    if (key === 'withdrawn') return 'badgeWithdrawn'
    return 'badgePending'
}

function getClient(kfFromContext, kfInstance) {
    return (
        kfFromContext ??
        kfInstance ??
        (typeof window !== 'undefined' ? window.kf : null) ??
        kf
    )
}

export function DefaultLandingComponent() {
    const { kf: kfFromContext, sdkReady } = useContext(KissflowSDKContext)
    const kfInstance =
        kfFromContext ??
        (typeof window !== 'undefined' ? window.kf : null)

    const liveUser = kfInstance?.user
    const [previewUser, setPreviewUser] = useState(null)
    const user = liveUser || previewUser || { Name: 'User', Company: '' }

    const accountId = kfInstance?.account?._id || ''
    const userId = String(user?._id || '').trim()
    const userName = user?.Name || 'User'

    const [company, setCompany] = useState(
        () => String(liveUser?.Company || '').trim(),
    )
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState('')
    const [connected, setConnected] = useState(false)
    const [rows, setRows] = useState([])
    const [instanceActivityMap, setInstanceActivityMap] = useState({})
    const [myItemsCounts, setMyItemsCounts] = useState({
        Draft: 0,
        InProgress: 0,
        Completed: 0,
        Withdrawn: 0,
        Rejected: 0,
    })
    const [taskSteps, setTaskSteps] = useState([])
    const [listTab, setListTab] = useState('myItems')
    const [itemStatus, setItemStatus] = useState('InProgress')
    const [activeTaskId, setActiveTaskId] = useState('')
    const [draftFilters, setDraftFilters] = useState({ ...EMPTY_FILTERS })
    const [filters, setFilters] = useState({ ...EMPTY_FILTERS })
    const [showMore, setShowMore] = useState(false)
    const [page, setPage] = useState(1)
    const [sheetOpen, setSheetOpen] = useState(false)

    useEffect(() => {
        if (!import.meta.env.DEV || liveUser) return
        let cancelled = false
        import('../mocks/legalExpenseClaims.js').then((mod) => {
            if (cancelled) return
            setPreviewUser(mod.MOCK_LEGAL_USER)
            if (!liveUser?.Company) {
                setCompany(String(mod.MOCK_LEGAL_USER.Company || '').trim())
            }
        })
        return () => {
            cancelled = true
        }
    }, [liveUser])

    const loadData = useCallback(async () => {
        if (!sdkReady) return
        setLoading(true)
        setError('')
        const isLive = Boolean(kfInstance?.api && kfInstance?.account?._id)
        try {
            const result = await loadLegalExpenseRows(kfInstance)
            setRows(result.rows)
            setConnected(result.connected)
            setInstanceActivityMap(result.instanceActivityMap || {})
            setMyItemsCounts(
                result.myItemsCounts || {
                    Draft: 0,
                    InProgress: 0,
                    Completed: 0,
                    Withdrawn: 0,
                    Rejected: 0,
                },
            )
            const steps = Array.isArray(result.taskSteps) ? result.taskSteps : []
            setTaskSteps(steps)
            setActiveTaskId((prev) => prev || (steps[0]?._id ? String(steps[0]._id) : ''))
        } catch (e) {
            console.error('Legal expense fetch failed', e)
            // Never fall back to mock when running in Kissflow / production.
            setRows([])
            setConnected(isLive)
            setError(e?.message || 'Unable to load expense claims.')
        } finally {
            setLoading(false)
        }
    }, [kfInstance, sdkReady])

    useEffect(() => {
        loadData()
    }, [loadData])

    useEffect(() => {
        if (
            !connected ||
            !accountId ||
            !userId ||
            typeof kfInstance?.api !== 'function'
        ) {
            setCompany(String(user?.Company || '').trim())
            return
        }
        let cancelled = false
        ;(async () => {
            try {
                const resp = await kfInstance.api(
                    `/user/2/${accountId}/${userId}`,
                    {
                        method: 'GET',
                        headers: { Accept: 'application/json' },
                    },
                )
                const co = String(resp?.Company ?? '').trim()
                if (!cancelled && co) setCompany(co)
            } catch (e) {
                console.warn('User profile fetch failed', e)
            }
        })()
        return () => {
            cancelled = true
        }
    }, [connected, accountId, userId, kfInstance, user?.Company])

    const scopedRows = useMemo(() => {
        const base = applyFilters(rows, { ...filters, status: '' })
        if (listTab === 'myTasks') {
            let list = base.filter((r) => r.source === 'myTasks')
            if (activeTaskId) {
                list = list.filter((r) => r.taskStepId === String(activeTaskId))
            }
            return list
        }
        const tab = MY_ITEM_TABS.find((t) => t.key === itemStatus)
        return base.filter((r) => {
            if (r.source === 'myTasks') return false
            if (!tab) return r.statusKey === 'pending'
            return r.statusKey === tab.statusKey
        })
    }, [rows, filters, listTab, itemStatus, activeTaskId])

    const kpis = useMemo(
        () => buildKpis(applyFilters(rows, { ...filters, status: '' })),
        [rows, filters],
    )
    const byAdvocate = useMemo(
        () => buildGroupSum(scopedRows, 'advocate', 5),
        [scopedRows],
    )

    const options = useMemo(
        () => ({
            company: uniqueSorted(rows.map((r) => r.company)),
            advocate: uniqueSorted(rows.map((r) => r.advocate)),
            caseType: uniqueSorted(rows.map((r) => r.caseType)),
            department: uniqueSorted(rows.map((r) => r.department)),
            month: uniqueSorted(rows.map((r) => r.month)),
            currency: uniqueSorted(rows.map((r) => r.currency)),
            gst: uniqueSorted(rows.map((r) => r.gst)),
        }),
        [rows],
    )

    const activeFilterCount = useMemo(() => countActiveFilters(filters), [filters])

    const totalPages = Math.max(1, Math.ceil(scopedRows.length / TABLE_PAGE_SIZE))
    const pageRows = scopedRows.slice(
        (page - 1) * TABLE_PAGE_SIZE,
        page * TABLE_PAGE_SIZE,
    )

    useEffect(() => {
        setPage(1)
    }, [filters, listTab, itemStatus, activeTaskId])

    useEffect(() => {
        if (page > totalPages) setPage(totalPages)
    }, [page, totalPages])

    const setDraft = (key, value) =>
        setDraftFilters((prev) => ({ ...prev, [key]: value }))

    const applyCommitted = useCallback((next) => {
        const committed = { ...EMPTY_FILTERS, ...next }
        setDraftFilters(committed)
        setFilters(committed)
        if (committed.status === 'draft') {
            setListTab('myItems')
            setItemStatus('Draft')
        } else if (committed.status === 'completed' || committed.status === 'paid') {
            setListTab('myItems')
            setItemStatus('Completed')
        } else if (committed.status === 'rejected') {
            setListTab('myItems')
            setItemStatus('Rejected')
        } else if (committed.status === 'pending') {
            setListTab('myItems')
            setItemStatus('InProgress')
        }
    }, [])

    const applyDraft = () => applyCommitted(draftFilters)

    const resetFilters = () => {
        applyCommitted({ ...EMPTY_FILTERS })
        setListTab('myItems')
        setItemStatus('InProgress')
    }

    const closeFilterSheet = useCallback(() => setSheetOpen(false), [])

    useEffect(() => {
        const mq = window.matchMedia('(min-width: 992px)')
        const onChange = () => {
            if (mq.matches) setSheetOpen(false)
        }
        mq.addEventListener('change', onChange)
        return () => mq.removeEventListener('change', onChange)
    }, [])

    /** Welcome bar — open blank create form (no instance/activity params). */
    const createClaim = () => {
        const client = getClient(kfFromContext, kfInstance)

        if (!connected) {
            window.alert(
                'Preview mode — Create Claim opens the live popup only inside Kissflow.',
            )
            return
        }

        if (!client?.app?.page?.openPopup) {
            client?.client?.showInfo?.('Unable to open create claim popup.')
            return
        }

        try {
            client.app.page.openPopup(CLAIM_POPUP_ID)
        } catch (e) {
            console.error('createClaim popup failed', e)
            client?.client?.showInfo?.(
                e?.message || 'Failed to open create claim popup.',
            )
        }
    }

    /**
     * Table row — view / edit the saved claim (fields + line items).
     * Create Claim stays a blank popup. Row click uses Kissflow process.openForm
     * with this project's instance_id + activity_id resolution so existing data loads.
     */
    const openClaimPopup = async (row) => {
        const client = getClient(kfFromContext, kfInstance)
        const instanceId = String(row?.id || row?.raw?._id || '').trim()

        if (!instanceId) {
            client?.client?.showInfo?.('Unable to open this invoice: missing instance id.')
            return
        }

        if (!connected) {
            window.alert(
                'Preview mode — Kissflow form opens only inside the app.\n' +
                    `instance_id: ${instanceId}`,
            )
            return
        }

        const activityId = await resolveClaimActivityForPopup({
            kfInstance: client,
            row,
            instanceActivityMap,
            instanceId,
        })

        if (!activityId) {
            client?.client?.showInfo?.(
                'Unable to open this invoice: missing activity instance id for this record.',
            )
            return
        }

        console.info('[counsel-cost] open existing claim', {
            instanceId,
            activityId,
            processId: 'Expense_Claim_i8nK',
        })

        try {
            const opened = await openExistingClaim(client, {
                instanceId,
                activityId,
                popupId: CLAIM_POPUP_ID,
            })
            if (!opened) {
                client?.client?.showInfo?.('Unable to open this invoice form.')
            }
        } catch (e) {
            console.error('openClaimPopup failed', e)
            client?.client?.showInfo?.(
                e?.message || 'Unable to open this invoice form.',
            )
        }
    }

    return (
        <div className="dash">
            <section className="welcome">
                <div className="welcomeInner">
                    <div>
                        <h2>
                            Welcome back, {userName}{' '}
                            <span aria-hidden="true">👋</span>
                        </h2>
                        <p>
                            {company} · Real-time legal invoice intelligence with
                            filters, MIS exports, and glowing clarity across every
                            claim.
                        </p>
                    </div>
                    <div className="welcomeActions">
                        <button
                            type="button"
                            className="btn btnPrimary"
                            onClick={createClaim}
                        >
                            <i className="ri-add-line" />
                            Create Claim
                        </button>
                    </div>
                </div>
            </section>

            <div className="mobileFiltersBar">
                <button
                    type="button"
                    className={`mobileFiltersBtn${activeFilterCount ? ' mobileFiltersBtnActive' : ''}`}
                    onClick={() => setSheetOpen(true)}
                >
                    <i className="ri-filter-3-line" aria-hidden="true" />
                    {activeFilterCount ? `Filters (${activeFilterCount})` : 'Filters'}
                </button>
            </div>
            <FilterSheet
                open={sheetOpen}
                appliedFilters={filters}
                options={options}
                onApply={(next) => {
                    applyCommitted(next)
                    setSheetOpen(false)
                }}
                onClear={() => {
                    resetFilters()
                    setSheetOpen(false)
                }}
                onDismiss={closeFilterSheet}
            />

            <section className="panel filterToolbarDesktop" style={{ animationDelay: '0.08s' }}>
                <h3 className="panelTitle">
                    <i className="ri-filter-3-line" style={{ color: '#1E3A5F' }} />
                    Reports & Filters
                </h3>
                <div className="filterGrid">
                    <SelectField
                        label="Company"
                        value={draftFilters.company}
                        onChange={(v) => setDraft('company', v)}
                        options={options.company}
                    />
                    <SelectField
                        label="Advocate / Firm / Counsel"
                        value={draftFilters.advocate}
                        onChange={(v) => setDraft('advocate', v)}
                        options={options.advocate}
                    />
                    <SelectField
                        label="Case Type"
                        value={draftFilters.caseType}
                        onChange={(v) => setDraft('caseType', v)}
                        options={options.caseType}
                    />
                    <SelectField
                        label="Department"
                        value={draftFilters.department}
                        onChange={(v) => setDraft('department', v)}
                        options={options.department}
                    />
                    <div className="field">
                        <label>Date From</label>
                        <input
                            type="date"
                            value={draftFilters.dateFrom}
                            onChange={(e) => setDraft('dateFrom', e.target.value)}
                        />
                    </div>
                    <div className="field">
                        <label>Date To</label>
                        <input
                            type="date"
                            value={draftFilters.dateTo}
                            onChange={(e) => setDraft('dateTo', e.target.value)}
                        />
                    </div>
                    <div className="field">
                        <label>Invoice Value</label>
                        <select
                            value={draftFilters.valueSort}
                            onChange={(e) => setDraft('valueSort', e.target.value)}
                        >
                            <option value="">Latest first</option>
                            <option value="high">High to Low</option>
                            <option value="low">Low to High</option>
                        </select>
                    </div>
                    <SelectField
                        label="Currency"
                        value={draftFilters.currency}
                        onChange={(v) => setDraft('currency', v)}
                        options={options.currency}
                    />
                    <div className="field">
                        <label>Status</label>
                        <select
                            value={draftFilters.status}
                            onChange={(e) => setDraft('status', e.target.value)}
                        >
                            <option value="">All</option>
                            <option value="draft">Draft</option>
                            <option value="pending">Pending</option>
                            <option value="completed">Completed</option>
                            <option value="rejected">Rejected</option>
                        </select>
                    </div>
                    <SelectField
                        label="Month"
                        value={draftFilters.month}
                        onChange={(v) => setDraft('month', v)}
                        options={options.month}
                    />
                </div>

                {showMore ? (
                    <div className="filterGrid" style={{ marginTop: 10 }}>
                        <SelectField
                            label="GST"
                            value={draftFilters.gst}
                            onChange={(v) => setDraft('gst', v)}
                            options={options.gst}
                        />
                        <div className="field">
                            <label>Min Value</label>
                            <input
                                type="number"
                                placeholder="e.g. 10000"
                                value={draftFilters.valueMin}
                                onChange={(e) =>
                                    setDraft('valueMin', e.target.value)
                                }
                            />
                        </div>
                        <div className="field">
                            <label>Max Value</label>
                            <input
                                type="number"
                                placeholder="e.g. 500000"
                                value={draftFilters.valueMax}
                                onChange={(e) =>
                                    setDraft('valueMax', e.target.value)
                                }
                            />
                        </div>
                        <div className="field" style={{ gridColumn: 'span 2' }}>
                            <label>Search</label>
                            <input
                                type="search"
                                placeholder="Invoice #, advocate, company, case…"
                                value={draftFilters.search}
                                onChange={(e) =>
                                    setDraft('search', e.target.value)
                                }
                            />
                        </div>
                    </div>
                ) : null}

                <div className="filterActions">
                    <button
                        type="button"
                        className="linkBtn"
                        onClick={() => setShowMore((v) => !v)}
                    >
                        {showMore ? 'Hide extra filters' : 'More Filters'}
                    </button>
                    <button type="button" className="linkBtn" onClick={resetFilters}>
                        Reset
                    </button>
                    <button
                        type="button"
                        className="btn btnOrange"
                        onClick={applyDraft}
                    >
                        <i className="ri-check-line" />
                        Apply Filters
                    </button>
                </div>
            </section>

            {loading ? (
                <div className="kpiGrid">
                    {[0, 1, 2, 3, 4].map((i) => (
                        <div key={i} className="skeleton" />
                    ))}
                </div>
            ) : (
                <div className="kpiGrid">
                    <KpiCard
                        label="Total Invoice Value"
                        value={formatCompactINR(kpis.totalValue)}
                        hint={`${kpis.total} invoices in inbox`}
                        icon="ri-money-rupee-circle-line"
                        color="#1E3A5F"
                        glow="rgba(30,58,95,0.2)"
                        delay={0.05}
                    />
                    <KpiCard
                        label="Total Invoices"
                        value={kpis.total.toLocaleString('en-IN')}
                        hint="My Items + My Tasks"
                        icon="ri-file-list-3-line"
                        color="#4A6FA5"
                        glow="rgba(74,111,165,0.18)"
                        delay={0.1}
                    />
                    <KpiCard
                        label="Completed"
                        value={kpis.completed.toLocaleString('en-IN')}
                        hint="Finished claims"
                        icon="ri-checkbox-circle-line"
                        color="#4A7C59"
                        glow="rgba(74,124,89,0.18)"
                        delay={0.15}
                    />
                    <KpiCard
                        label="Pending"
                        value={kpis.pending.toLocaleString('en-IN')}
                        hint="In progress"
                        icon="ri-time-line"
                        color="#6B2D3C"
                        glow="rgba(107,45,60,0.16)"
                        delay={0.2}
                    />
                    <KpiCard
                        label="Open Amount"
                        value={formatCompactINR(kpis.openAmount)}
                        hint="Pending + draft value"
                        icon="ri-wallet-3-line"
                        color="#9B4D4D"
                        glow="rgba(155,77,77,0.16)"
                        delay={0.25}
                    />
                </div>
            )}

            {error ? (
                <div className="panel" style={{ color: '#b91c1c', marginBottom: 12 }}>
                    {error}
                </div>
            ) : null}

            <section className="panel" style={{ animationDelay: '0.24s' }}>
                <div
                    style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        gap: 12,
                        alignItems: 'center',
                        marginBottom: 8,
                        flexWrap: 'wrap',
                    }}
                >
                    <h3 className="panelTitle" style={{ margin: 0 }}>
                        <i className="ri-table-line" style={{ color: '#1E3A5F' }} />
                        Expenses
                    </h3>
                    <span className="muted" style={{ fontSize: 13 }}>
                        Showing {pageRows.length ? (page - 1) * TABLE_PAGE_SIZE + 1 : 0}–
                        {Math.min(page * TABLE_PAGE_SIZE, scopedRows.length)} of{' '}
                        {scopedRows.length}
                    </span>
                </div>

                <div className="inboxTabs">
                    {['myItems', 'myTasks'].map((tab) => (
                        <button
                            key={tab}
                            type="button"
                            className={`inboxTab ${listTab === tab ? 'inboxTabActive' : ''}`}
                            onClick={() => {
                                setListTab(tab)
                                if (tab === 'myTasks' && !activeTaskId && taskSteps[0]?._id) {
                                    setActiveTaskId(String(taskSteps[0]._id))
                                }
                            }}
                        >
                            {tab === 'myItems' ? 'My Items' : 'My Tasks'}
                        </button>
                    ))}
                </div>
                <div className="inboxSubTabs">
                    {listTab === 'myItems'
                        ? MY_ITEM_TABS.map((tab) => (
                              <button
                                  key={tab.key}
                                  type="button"
                                  className={`inboxSubTab ${itemStatus === tab.key ? 'inboxSubTabActive' : ''}`}
                                  onClick={() => setItemStatus(tab.key)}
                              >
                                  {tab.label}
                                  <span>
                                      {myItemsCounts[tab.key] ??
                                          rows.filter(
                                              (r) =>
                                                  r.source !== 'myTasks' &&
                                                  r.statusKey === tab.statusKey,
                                          ).length}
                                  </span>
                              </button>
                          ))
                        : taskSteps.map((step) => (
                              <button
                                  key={step._id}
                                  type="button"
                                  className={`inboxSubTab ${activeTaskId === String(step._id) ? 'inboxSubTabActive' : ''}`}
                                  onClick={() => setActiveTaskId(String(step._id))}
                              >
                                  {step.StepName || step.Name || 'Step'}
                                  <span>{step.Count ?? 0}</span>
                              </button>
                          ))}
                </div>

                {loading ? (
                    <div className="skeleton" style={{ height: 220 }} />
                ) : !pageRows.length ? (
                    <div className="empty">
                        <i
                            className="ri-inbox-2-line"
                            style={{ fontSize: 28, color: '#a8a29e' }}
                        />
                        <p>
                            {connected
                                ? listTab === 'myTasks'
                                    ? 'No pending tasks in this step.'
                                    : 'No invoices in this status.'
                                : 'Preview mode — mock data. No rows match these filters.'}
                        </p>
                    </div>
                ) : (
                    <div className="tableWrap">
                        <table className="invTable">
                            <thead>
                                <tr>
                                    <th>Invoice #</th>
                                    <th>Invoice Date</th>
                                    <th>Advocate / Firm / Counsel</th>
                                    <th>Company Name</th>
                                    <th>Case Type</th>
                                    <th>Invoice Value</th>
                                    <th>Currency</th>
                                    <th>Status</th>
                                    <th>Action</th>
                                </tr>
                            </thead>
                            <tbody>
                                {pageRows.map((r) => (
                                    <tr
                                        key={`${r.source}-${r.id}-${r.taskStepId || r.statusKey}`}
                                        className="invRowClick"
                                        onClick={() => openClaimPopup(r)}
                                        onKeyDown={(e) => {
                                            if (e.key === 'Enter' || e.key === ' ') {
                                                e.preventDefault()
                                                openClaimPopup(r)
                                            }
                                        }}
                                        tabIndex={0}
                                        role="button"
                                        title="Open invoice"
                                    >
                                        <td>
                                            <strong>{r.invoiceNumber}</strong>
                                        </td>
                                        <td>{r.invoiceDateLabel}</td>
                                        <td>{r.advocate || '—'}</td>
                                        <td>{r.company}</td>
                                        <td>{r.caseType}</td>
                                        <td>{formatINR(r.amount, r.currency)}</td>
                                        <td>{r.currency}</td>
                                        <td>
                                            <span
                                                className={`badge ${statusClass(r.statusKey)}`}
                                            >
                                                {r.statusLabel}
                                            </span>
                                        </td>
                                        <td>
                                            <button
                                                type="button"
                                                className="iconBtn"
                                                title="Open invoice"
                                                onClick={(e) => {
                                                    e.stopPropagation()
                                                    openClaimPopup(r)
                                                }}
                                            >
                                                <i className="ri-eye-line" />
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}

                <div className="pagination">
                    <span className="muted" style={{ fontSize: 12 }}>
                        Page {page} of {totalPages}
                    </span>
                    <div className="pageBtns">
                        <button
                            type="button"
                            className="pageBtn"
                            disabled={page <= 1}
                            onClick={() => setPage((p) => Math.max(1, p - 1))}
                        >
                            ‹
                        </button>
                        {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                            const start = Math.min(
                                Math.max(1, page - 2),
                                Math.max(1, totalPages - 4),
                            )
                            const n = start + i
                            if (n > totalPages) return null
                            return (
                                <button
                                    key={n}
                                    type="button"
                                    className={`pageBtn ${n === page ? 'pageBtnActive' : ''}`}
                                    onClick={() => setPage(n)}
                                >
                                    {n}
                                </button>
                            )
                        })}
                        <button
                            type="button"
                            className="pageBtn"
                            disabled={page >= totalPages}
                            onClick={() =>
                                setPage((p) => Math.min(totalPages, p + 1))
                            }
                        >
                            ›
                        </button>
                    </div>
                </div>
            </section>

            <section className="panel" style={{ animationDelay: '0.28s' }}>
                <h3 className="panelTitle">
                    <i className="ri-user-star-line" style={{ color: '#B8956A' }} />
                    Top Advocates / Firms
                </h3>
                {byAdvocate.map((a, idx) => {
                    const max = byAdvocate[0]?.value || 1
                    const pct = Math.round((a.value / max) * 100)
                    return (
                        <div key={a.name} className="rankRow">
                            <div className="rankNum">{idx + 1}</div>
                            <div>
                                <div
                                    style={{
                                        fontWeight: 650,
                                        fontSize: 13,
                                        marginBottom: 6,
                                    }}
                                >
                                    {a.name}
                                </div>
                                <div className="barTrack">
                                    <div
                                        className="barFill"
                                        style={{ width: `${pct}%` }}
                                    />
                                </div>
                            </div>
                            <strong style={{ fontSize: 12 }}>
                                {formatCompactINR(a.value)}
                            </strong>
                        </div>
                    )
                })}
                {!byAdvocate.length ? (
                    <div className="empty">No advocate spend yet</div>
                ) : null}
            </section>

            <p className="footerNote">
                Reports support Company, Advocate/Firm/Counsel, Date Period, Invoice
                Value High→Low, Case Type, Department, Currency, GST, Status and more —
                generate Email / WhatsApp MIS in real time anytime.
            </p>

            <footer className="footerCredit">
                <span className="footerCreditLine" aria-hidden="true" />
                <p className="footerCreditText">
                    Design &amp; Developed by Refex AI Team · © 2026
                </p>
                <span className="footerCreditLine" aria-hidden="true" />
            </footer>
        </div>
    )
}
