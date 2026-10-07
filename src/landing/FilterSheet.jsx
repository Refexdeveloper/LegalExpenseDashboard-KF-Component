import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { EMPTY_FILTERS } from './constants.js'

const MENU_Z = 12050
const SHEET_Z = 10040

function menuPosition(trigger) {
    if (!trigger) return { top: 0, left: 0, width: 0, maxHeight: 220, place: 'below' }
    const rect = trigger.getBoundingClientRect()
    const gutter = 8
    const spaceBelow = window.innerHeight - rect.bottom - gutter
    const spaceAbove = rect.top - gutter
    const place = spaceBelow >= 160 || spaceBelow >= spaceAbove ? 'below' : 'above'
    const available = Math.max(place === 'below' ? spaceBelow : spaceAbove, 96)
    const maxHeight = Math.min(280, available)
    const width = Math.max(rect.width, 160)
    const left = Math.min(
        Math.max(12, rect.left),
        Math.max(12, window.innerWidth - width - 12),
    )
    const top = place === 'below' ? rect.bottom + 4 : Math.max(8, rect.top - maxHeight - 4)
    return { top, left, width, maxHeight, place }
}

function SheetSelect({ label, value, onChange, options, placeholder = 'All' }) {
    const triggerRef = useRef(null)
    const menuRef = useRef(null)
    const [open, setOpen] = useState(false)
    const [pos, setPos] = useState({ top: 0, left: 0, width: 0, maxHeight: 220 })

    const items = [
        { value: '', label: placeholder },
        ...(options || []).map((opt) =>
            opt && typeof opt === 'object'
                ? { value: String(opt.value ?? ''), label: String(opt.label ?? opt.value ?? '') }
                : { value: String(opt), label: String(opt) },
        ),
    ]
    const selected = items.find((item) => item.value === value) || items[0]

    const updatePos = () => {
        setPos(menuPosition(triggerRef.current))
    }

    useLayoutEffect(() => {
        if (!open) return
        updatePos()
    }, [open])

    useEffect(() => {
        if (!open) return undefined
        const onWin = () => updatePos()
        const onPointer = (e) => {
            if (triggerRef.current?.contains(e.target)) return
            if (menuRef.current?.contains(e.target)) return
            setOpen(false)
        }
        const onKey = (e) => {
            if (e.key === 'Escape') {
                e.stopPropagation()
                setOpen(false)
            }
        }
        window.addEventListener('resize', onWin)
        window.addEventListener('scroll', onWin, true)
        document.addEventListener('mousedown', onPointer)
        document.addEventListener('keydown', onKey)
        return () => {
            window.removeEventListener('resize', onWin)
            window.removeEventListener('scroll', onWin, true)
            document.removeEventListener('mousedown', onPointer)
            document.removeEventListener('keydown', onKey)
        }
    }, [open])

    if (typeof document === 'undefined') return null

    return (
        <div className="field">
            <div className="fieldLabel">{label}</div>
            <button
                ref={triggerRef}
                type="button"
                className="sheetSelectTrigger"
                aria-haspopup="listbox"
                aria-expanded={open}
                onClick={() => setOpen((v) => !v)}
            >
                <span className={value ? '' : 'sheetSelectPlaceholder'}>
                    {selected?.label || placeholder}
                </span>
                <i className="ri-arrow-down-s-line" aria-hidden="true" />
            </button>
            {open
                ? createPortal(
                      <div
                          ref={menuRef}
                          className="sheetSelectMenu"
                          role="listbox"
                          style={{
                              top: pos.top,
                              left: pos.left,
                              width: pos.width,
                              maxHeight: pos.maxHeight,
                              zIndex: MENU_Z,
                          }}
                      >
                          {items.map((item) => {
                              const isActive = item.value === value
                              return (
                                  <button
                                      key={item.value || '__all__'}
                                      type="button"
                                      role="option"
                                      aria-selected={isActive}
                                      className={`sheetSelectOption${isActive ? ' sheetSelectOptionActive' : ''}`}
                                      onClick={() => {
                                          onChange(item.value)
                                          setOpen(false)
                                      }}
                                  >
                                      <span>{item.label}</span>
                                      {isActive ? (
                                          <i className="ri-check-line" aria-hidden="true" />
                                      ) : null}
                                  </button>
                              )
                          })}
                      </div>,
                      document.body,
                  )
                : null}
        </div>
    )
}

function SheetInput({ label, type = 'text', value, onChange, placeholder }) {
    return (
        <div className="field">
            <div className="fieldLabel">{label}</div>
            <input
                type={type}
                value={value}
                placeholder={placeholder}
                onChange={(e) => onChange(e.target.value)}
            />
        </div>
    )
}

export function FilterSheet({
    open,
    appliedFilters,
    options = {},
    onApply,
    onClear,
    onDismiss,
}) {
    const [draft, setDraft] = useState({ ...EMPTY_FILTERS })
    const panelRef = useRef(null)

    useEffect(() => {
        if (!open) return
        setDraft({ ...EMPTY_FILTERS, ...appliedFilters })
    }, [open, appliedFilters])

    useEffect(() => {
        if (!open) return undefined
        const prev = document.body.style.overflow
        document.body.style.overflow = 'hidden'
        const onKey = (e) => {
            if (e.key !== 'Escape') return
            if (document.querySelector('.sheetSelectMenu')) return
            onDismiss()
        }
        document.addEventListener('keydown', onKey)
        return () => {
            document.body.style.overflow = prev
            document.removeEventListener('keydown', onKey)
        }
    }, [open, onDismiss])

    const setField = (key, value) =>
        setDraft((prev) => ({ ...prev, [key]: value }))

    if (!open || typeof document === 'undefined') return null

    return createPortal(
        <div className="filterSheetRoot" style={{ zIndex: SHEET_Z }}>
            <button
                type="button"
                className="filterSheetScrim"
                aria-label="Close filters"
                onClick={onDismiss}
            />
            <div
                ref={panelRef}
                className="filterSheetPanel"
                role="dialog"
                aria-modal="true"
                aria-labelledby="filter-sheet-title"
            >
                <header className="filterSheetHeader">
                    <h2 id="filter-sheet-title">Filters</h2>
                    <button
                        type="button"
                        className="filterSheetClose"
                        aria-label="Close"
                        onClick={onDismiss}
                    >
                        <i className="ri-close-line" />
                    </button>
                </header>
                <div className="filterSheetBody">
                    <SheetSelect
                        label="Company"
                        value={draft.company}
                        onChange={(v) => setField('company', v)}
                        options={options.company || []}
                    />
                    <SheetSelect
                        label="Advocate / Firm / Counsel"
                        value={draft.advocate}
                        onChange={(v) => setField('advocate', v)}
                        options={options.advocate || []}
                    />
                    <SheetSelect
                        label="Case Type"
                        value={draft.caseType}
                        onChange={(v) => setField('caseType', v)}
                        options={options.caseType || []}
                    />
                    <SheetSelect
                        label="Department"
                        value={draft.department}
                        onChange={(v) => setField('department', v)}
                        options={options.department || []}
                    />
                    <SheetInput
                        label="Date From"
                        type="date"
                        value={draft.dateFrom}
                        onChange={(v) => setField('dateFrom', v)}
                    />
                    <SheetInput
                        label="Date To"
                        type="date"
                        value={draft.dateTo}
                        onChange={(v) => setField('dateTo', v)}
                    />
                    <SheetSelect
                        label="Invoice Value"
                        value={draft.valueSort}
                        onChange={(v) => setField('valueSort', v)}
                        options={[
                            { value: 'high', label: 'High to Low' },
                            { value: 'low', label: 'Low to High' },
                        ]}
                        placeholder="Latest first"
                    />
                    <SheetSelect
                        label="Currency"
                        value={draft.currency}
                        onChange={(v) => setField('currency', v)}
                        options={options.currency || []}
                    />
                    <SheetSelect
                        label="Status"
                        value={draft.status}
                        onChange={(v) => setField('status', v)}
                        options={[
                            { value: 'draft', label: 'Draft' },
                            { value: 'pending', label: 'Pending' },
                            { value: 'completed', label: 'Completed' },
                            { value: 'rejected', label: 'Rejected' },
                        ]}
                        placeholder="All"
                    />
                    <SheetSelect
                        label="Month"
                        value={draft.month}
                        onChange={(v) => setField('month', v)}
                        options={options.month || []}
                    />
                    <SheetSelect
                        label="GST"
                        value={draft.gst}
                        onChange={(v) => setField('gst', v)}
                        options={options.gst || []}
                    />
                    <SheetInput
                        label="Min Value"
                        type="number"
                        value={draft.valueMin}
                        onChange={(v) => setField('valueMin', v)}
                        placeholder="e.g. 10000"
                    />
                    <SheetInput
                        label="Max Value"
                        type="number"
                        value={draft.valueMax}
                        onChange={(v) => setField('valueMax', v)}
                        placeholder="e.g. 500000"
                    />
                    <SheetInput
                        label="Search"
                        type="search"
                        value={draft.search}
                        onChange={(v) => setField('search', v)}
                        placeholder="Invoice #, advocate, company, case…"
                    />
                </div>
                <footer className="filterSheetFooter">
                    <button type="button" className="btn btnSoft" onClick={onClear}>
                        Clear
                    </button>
                    <button
                        type="button"
                        className="btn btnOrange"
                        onClick={() => onApply(draft)}
                    >
                        <i className="ri-check-line" />
                        Apply
                    </button>
                </footer>
            </div>
        </div>,
        document.body,
    )
}
