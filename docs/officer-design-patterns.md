# STI Sync — Officer Panel Design Patterns

> **Scope:** All pages and components under `src/app/officer/`
> **Role:** Organization Officer (club president, secretary, treasurer, auditor, etc.)
> **Layout entry:** `src/app/officer/components/OfficerLayout.tsx`
> **Route prefix:** `/officer`

---

## 1. Modern STI Officer Color Palette

The Officer Panel uses a clean, modern, institutional color system that mirrors and complements the Admin Portal with an approachable, high-productivity aesthetic. **Strictly NO purple/violet tokens are used.**

| Token | Hex / Class | Usage |
|---|---|---|
| **Deep STI Navy** | `#001A4D` | Primary headers, modal title banners, active card borders, strong data labels |
| **STI Royal Blue** | `#0E4EBD` | Primary action CTAs, active nav items, key buttons, highlight rings, main icons |
| **Electric Blue Accent** | `#1E70E8` | Secondary action buttons, interactive hover states, information indicators |
| **Ice Blue Surface** | `#F0F6FF` / `bg-blue-50/60` | Active sidebar nav background, subtle pill backgrounds, highlighted rows |
| **Golden Yellow** | `#FFC107` / `#FFD41C` | Organization context pills, status alerts, active indicator bars |
| **Surface White** | `#FFFFFF` | Card backgrounds, dropdowns, modal body surfaces, topnav |
| **Border Gray** | `#E0E0E0` / `border-gray-200` | Card borders, table dividers, input borders |
| **Muted Slate** | `#64748B` / `text-gray-500` | Subtitles, helper text, inactive navigation icons |
| **Body Charcoal** | `#1E293B` / `text-gray-900` | Primary table data, modal text, readable typography |

### Semantic Status Colors
| State | Color | Tailwind Tokens |
|---|---|---|
| **Success / Paid / Active** | `#10B981` | `text-green-600`, `bg-green-50`, `border-green-200` |
| **Warning / Pending / Draft** | `#FFC107` | `text-amber-600`, `bg-amber-50`, `border-amber-200` |
| **Danger / Deficit / Rejected** | `#EF4444` | `text-red-600`, `bg-red-50`, `border-red-200` |
| **Info / Transferred** | `#0E4EBD` | `text-blue-600`, `bg-blue-50`, `border-blue-200` |

---

## 2. Layout Structure

```
/officer (OfficerLayout.tsx)
├── OfficerSidebar (fixed, 240px wide, bg-white border-r border-[#E0E0E0])
└── Main content area
    └── ml-[240px] min-h-screen bg-slate-50/50
        └── <Outlet /> — page content with p-6 max-w-7xl mx-auto
```

### Sidebar (`src/app/officer/components/OfficerSidebar.tsx`)
- **Background:** `bg-white border-r border-[#E0E0E0]`
- **Width:** `w-[240px]`
- **Logo:** Official STI Sync logo + "STI Sync" `text-[#001A4D]` bold
- **Org Switcher Pill:** `bg-blue-50 border border-blue-200 text-[#0E4EBD]` with `hover:bg-blue-100/70`
- **Nav item inactive:** `text-gray-500 hover:text-[#001A4D] hover:bg-gray-50`
- **Nav item active:** `bg-[#F0F6FF] text-[#0E4EBD] font-semibold` + `w-[3px] bg-[#0E4EBD]` left accent
- **Notification dot:** `bg-red-500` or `bg-[#FFC107]`
- **User profile footer:** Avatar with `bg-gradient-to-br from-[#001A4D] to-[#0E4EBD]`, `text-[#001A4D]` name, `text-gray-500` role

---

## 3. Page Header Pattern

Every officer page begins with a clean, unified header block:

```tsx
<div className="flex items-start justify-between">
  <div>
    <h2 className="text-2xl font-bold text-[#001A4D]">Page Title</h2>
    <p className="text-gray-500 text-sm">Supporting description or breadcrumb path</p>
  </div>
  {/* Primary CTA */}
  <button className="px-4 py-2.5 bg-[#001A4D] hover:bg-[#0E4EBD] text-white rounded-xl text-sm font-semibold flex items-center gap-2 transition-colors shadow-xs cursor-pointer">
    <Plus className="w-4 h-4 text-[#FFD41C]" />
    Create Something
  </button>
</div>
```

---

## 4. KPI Metric Cards Pattern (Mirrored from Admin)

All dashboards and centers present financial & activity metrics in a 4-column clean card grid:

```tsx
<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
  <div className="bg-white border border-[#E0E0E0] rounded-2xl p-5 shadow-xs">
    <div className="flex items-center justify-between text-gray-500 mb-2">
      <span className="text-xs font-semibold uppercase tracking-wider">Current Balance</span>
      <Wallet className="w-5 h-5 text-gray-400" />
    </div>
    <p className="text-2xl font-bold text-[#001A4D]">{formatCurrency(currentBalance)}</p>
    <p className="text-xs text-gray-400 mt-1">Available Club Treasury</p>
  </div>
</div>
```

---

## 5. Clean Tab Navigation & Filter Bar Pattern

```tsx
{/* Pill Tabs */}
<div className="flex items-center gap-2 border-b border-gray-200 pb-3">
  {tabs.map((t) => (
    <button
      key={t.id}
      onClick={() => setTab(t.id)}
      className={`px-4 py-2 rounded-xl text-sm font-bold transition-all cursor-pointer ${
        tab === t.id
          ? "bg-[#001A4D] text-white shadow-xs"
          : "bg-white text-gray-600 hover:text-gray-900 border border-gray-200 hover:bg-gray-50"
      }`}
    >
      {t.label}
    </button>
  ))}
</div>
```

---

## 6. Table Pattern

Tables use modern rounded-2xl card wrappers with sticky headers:

```tsx
<div className="bg-white border border-[#E0E0E0] rounded-2xl overflow-hidden shadow-xs">
  <div className="overflow-x-auto">
    <table className="w-full text-left">
      <thead className="bg-gray-50 border-b border-gray-200 text-xs font-bold text-gray-500 uppercase tracking-wider">
        <tr>
          <th className="px-5 py-3.5">Item</th>
          <th className="px-5 py-3.5">Category</th>
          <th className="px-5 py-3.5">Amount</th>
          <th className="px-5 py-3.5">Status</th>
          <th className="px-5 py-3.5 text-right">Actions</th>
        </tr>
      </thead>
      <tbody className="divide-y divide-gray-100 text-sm">
        {items.map((item) => (
          <tr key={item.id} className="hover:bg-gray-50/80 transition-colors">
            <td className="px-5 py-4 font-semibold text-gray-900">{item.title}</td>
            <td className="px-5 py-4 text-gray-600">{item.category}</td>
            <td className="px-5 py-4 font-bold text-[#001A4D]">{formatCurrency(item.amount)}</td>
            <td className="px-5 py-4">
              <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-green-100 text-green-700">
                Paid
              </span>
            </td>
            <td className="px-5 py-4 text-right">
              <button className="px-3 py-1.5 bg-blue-50 text-[#0E4EBD] hover:bg-blue-100 rounded-lg text-xs font-bold transition-colors">
                View Details
              </button>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  </div>
</div>
```

---

## 7. Modal Banner Pattern

All modal headers use the official STI Navy gradient with Golden Yellow accents:

```tsx
<div className="bg-gradient-to-r from-[#001A4D] to-[#0E4EBD] px-6 py-4.5 flex items-center justify-between">
  <div className="flex items-center gap-3">
    <Building2 className="w-5 h-5 text-[#FFD41C]" />
    <h3 className="text-white font-bold text-base">Modal Title</h3>
    <span className="px-2.5 py-0.5 bg-[#FFD41C] text-[#001A4D] text-xs font-bold rounded-full">Club Context</span>
  </div>
  <button onClick={onClose} className="text-white/70 hover:text-white p-1.5 rounded-lg hover:bg-white/10">
    <X className="w-5 h-5" />
  </button>
</div>
```
