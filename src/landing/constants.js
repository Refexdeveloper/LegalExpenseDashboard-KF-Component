export const APP_ID = 'Expense_and_Invoice_Manag_i8n7'
export const PROCESS_ID = 'Expense_Claim_i8nK'
export const REPORT_ID = 'Expense_Claim_i8nK_All_Items'
/** Kissflow page popup opened on invoice row click */
export const CLAIM_POPUP_ID = 'Popup_GaAEzeebi2'
export const PAGE_SIZE = 2000
export const MAX_PAGES = 20
export const TABLE_PAGE_SIZE = 8

/** Column Ids from Expense_Claim_i8nK_All_Items report */
export const COL = {
    month: 'Column-E5HnuZm_K2',
    advocate: 'Column-E5HnuZm_K6',
    invoiceNumber: 'Column-E5HnuZm_K8',
    invoiceDate: 'Column-E5HnuZm_KA',
    invoiceValue: 'Column-E5HnuZm_KC',
    caseType: 'Column-E5HnuZm_KG',
    description: 'Column_cAH4cgV8cI',
    company: 'Column_c-PGle5t4J',
    department: 'Column_1mEY7iyCwE',
    uploadInvoice: 'Column_k4SAYuIPkw',
    bankDetails: 'Column_HMuXEyI5w-',
    gst: 'Column_nMdtbXVGtx',
    pan: 'Column_aJIDN_jWcT',
    engagementLetter: 'Column_u1nIm5eTDq',
    termsOfEngagement: 'Column_NWCqV45MrX',
    invoiceValueAlt: 'Column_e67J8gfKGo',
    currencyCode: 'Column_-55jtDfBwY',
    currencyString: 'Column_NYoYFKGVof',
    convertCurrency: 'Column_qg-iHCYhmx',
}

export const CASE_TYPE_COLORS = [
    '#1E3A5F',
    '#4A6FA5',
    '#4A7C59',
    '#6B2D3C',
    '#9B4D4D',
    '#4A6670',
    '#B8956A',
    '#7C6B8A',
]

export const EMPTY_FILTERS = {
    company: '',
    advocate: '',
    caseType: '',
    department: '',
    month: '',
    currency: '',
    gst: '',
    status: 'pending',
    dateFrom: '',
    dateTo: '',
    valueSort: '',
    valueMin: '',
    valueMax: '',
    search: '',
}

/** Kissflow myitems workflow statuses — Draft, Pending, Completed, Rejected */
export const MY_ITEM_TABS = [
    { key: 'Draft', label: 'Draft', statusKey: 'draft' },
    { key: 'InProgress', label: 'Pending', statusKey: 'pending' },
    { key: 'Completed', label: 'Completed', statusKey: 'completed' },
    { key: 'Rejected', label: 'Rejected', statusKey: 'rejected' },
]
