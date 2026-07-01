import type { EntryCreateInput } from '../domain/entry/Entry.js';

// Fixed identifiers so seeded data is stable and vendors repeat across entries.
const COMPANY_A = '64b8f0000000000000000a01';
const COMPANY_B = '64b8f0000000000000000a02';
const USER_1 = '64b8f0000000000000000b01';
const USER_2 = '64b8f0000000000000000b02';

type SeedSpec = Partial<EntryCreateInput> & { entryNo: string; name: string; amount: number };

/** Fill an entry spec with sensible defaults (balanced debit, valid GL, weekday). */
function entry(spec: SeedSpec): EntryCreateInput {
  const amount = spec.amount;
  return {
    postingDate: spec.postingDate ?? new Date('2026-06-15T10:30:00.000Z'), // Mon
    transactionType: spec.transactionType ?? 'Journal Entry',
    entryNo: spec.entryNo,
    name: spec.name,
    description: spec.description ?? 'Routine ledger posting',
    amount,
    debit: spec.debit ?? amount,
    credit: spec.credit ?? 0,
    currency: spec.currency ?? 'INR',
    glNumber: spec.glNumber ?? '400120',
    postingBy: spec.postingBy ?? 'user_8392',
    companyId: spec.companyId ?? COMPANY_A,
    userId: spec.userId ?? USER_1,
    sourceId: spec.sourceId ?? 'upload_91',
    uploadId: spec.uploadId ?? 'file_22',
    systemCreated: spec.systemCreated ?? false,
    uploadSourceType: spec.uploadSourceType ?? 1,
  };
}

/** 27 entries spanning normal, high-value, unbalanced, suspicious, temporal, and GL cases. */
export function buildSeedEntries(): EntryCreateInput[] {
  return [
    // ── normal, balanced ──
    entry({ entryNo: 'JE-100001', name: 'ABC Traders Pvt Ltd', description: 'Purchase of raw materials for production', amount: 125000, glNumber: '400120' }),
    entry({ entryNo: 'JE-100002', name: 'Globex Supplies', description: 'Office stationery purchase', amount: 8200, glNumber: '400130' }),
    entry({ entryNo: 'JE-100003', name: 'Initech Services', description: 'Monthly cloud hosting fees', amount: 45000, glNumber: '510200' }),
    entry({ entryNo: 'JE-100004', name: 'ABC Traders Pvt Ltd', description: 'Freight and logistics charges', amount: 15750, glNumber: '400140' }),
    entry({ entryNo: 'JE-100005', name: 'Umbrella Corp', description: 'Consulting retainer', amount: 60000, glNumber: '510210' }),
    entry({ entryNo: 'JE-100006', name: 'Wayne Enterprises', description: 'Equipment maintenance', amount: 22000, glNumber: '400150', companyId: COMPANY_B, userId: USER_2 }),
    entry({ entryNo: 'JE-100007', name: 'Stark Industries', description: 'Software licence renewal', amount: 98000, glNumber: '510220', companyId: COMPANY_B }),
    entry({ entryNo: 'JE-100008', name: 'Globex Supplies', description: 'Packaging materials', amount: 12300, glNumber: '400130' }),

    // ── high-value ──
    entry({ entryNo: 'JE-200001', name: 'Wayne Enterprises', description: 'Capital equipment acquisition', amount: 4200000, glNumber: '600100', companyId: COMPANY_B }),
    entry({ entryNo: 'JE-200002', name: 'Stark Industries', description: 'Annual infrastructure contract', amount: 7500000, glNumber: '600110', companyId: COMPANY_B }),

    // ── debit/credit mismatch (unbalanced) ──
    entry({ entryNo: 'JE-300001', name: 'ABC Traders Pvt Ltd', description: 'Vendor settlement', amount: 500000, debit: 500000, credit: 120000, glNumber: '400120' }),
    entry({ entryNo: 'JE-300002', name: 'Initech Services', description: 'Partial invoice posting', amount: 30000, debit: 18000, credit: 0, glNumber: '510200' }),

    // ── suspicious descriptions ──
    entry({ entryNo: 'JE-400001', name: 'ABC Traders Pvt Ltd', description: 'Manual adjustment to close variance', amount: 275000, glNumber: '400120' }),
    entry({ entryNo: 'JE-400002', name: 'Umbrella Corp', description: 'Urgent reversal override requested by ops', amount: 190000, glNumber: '510210' }),
    entry({ entryNo: 'JE-400003', name: 'Globex Supplies', description: 'Manual reversal adjustment', amount: 64000, debit: 64000, credit: 10000, glNumber: '400130' }),

    // ── weekend / late-night postings ──
    entry({ entryNo: 'JE-500001', name: 'Wayne Enterprises', description: 'Weekend batch import', amount: 34000, glNumber: '400150', postingDate: new Date('2026-06-20T13:00:00.000Z'), companyId: COMPANY_B }), // Sat
    entry({ entryNo: 'JE-500002', name: 'Initech Services', description: 'After-hours accrual', amount: 51000, glNumber: '510200', postingDate: new Date('2026-06-21T02:15:00.000Z') }), // Sun 02:15
    entry({ entryNo: 'JE-500003', name: 'Stark Industries', description: 'Late night manual adjustment', amount: 880000, glNumber: '600110', postingDate: new Date('2026-06-14T03:40:00.000Z'), companyId: COMPANY_B }), // Sun 03:40

    // ── unusual / missing GL ──
    entry({ entryNo: 'JE-600001', name: 'Globex Supplies', description: 'Miscellaneous expense', amount: 9800, glNumber: '' }),
    entry({ entryNo: 'JE-600002', name: 'Umbrella Corp', description: 'Uncategorised charge', amount: 14200, glNumber: 'XX12' }),
    entry({ entryNo: 'JE-600003', name: 'ABC Traders Pvt Ltd', description: 'Suspense posting', amount: 46000, glNumber: '99' }),

    // ── missing / empty description ──
    entry({ entryNo: 'JE-700001', name: 'Initech Services', description: '', amount: 7300, glNumber: '510200' }),
    entry({ entryNo: 'JE-700002', name: 'Wayne Enterprises', description: '', amount: 210000, glNumber: '', companyId: COMPANY_B }),

    // ── duplicated vendor / repeated pattern (similarity fodder) ──
    entry({ entryNo: 'JE-800001', name: 'ABC Traders Pvt Ltd', description: 'Purchase of raw materials for production', amount: 125000, glNumber: '400120' }),
    entry({ entryNo: 'JE-800002', name: 'ABC Traders Pvt Ltd', description: 'Purchase of raw materials for production', amount: 126500, glNumber: '400120' }),
    entry({ entryNo: 'JE-800003', name: 'Globex Supplies', description: 'Office stationery purchase', amount: 8100, glNumber: '400130' }),

    // ── system-generated ──
    entry({ entryNo: 'JE-900001', name: 'System Accrual', description: 'Automated month-end accrual', amount: 33000, glNumber: '510230', systemCreated: true, postingBy: 'system' }),
  ];
}
