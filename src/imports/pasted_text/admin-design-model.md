# STI Sync Web Admin — Modern Design System Model

## 1. Design Vision & Philosophy
The **STI Sync Web Admin** is the high-authority institutional command center for the Student Affairs Office (SAO) and campus administrators at STI College Ormoc. The interface is engineered to feel exceptionally modern, premium, clean, and reliable — drawing direct inspiration from STI's signature colors (Midnight Navy, Vibrant Cobalt, Golden Yellow, and Crisp White).

**Zero Purple Rule**: The interface strictly eliminates purple tones (`#83358E`, `#7F77DD`, `#6D2A78`) in favor of a cohesive STI Navy-Cobalt-Gold brand identity.

---

## 2. Color Palette & Design Tokens

### Primary Brand Colors
- **STI Midnight Navy (`#001A4D`)**: The anchor of the brand. Used for primary typography, header titles, active dark pill backgrounds, top navigation accents, and base dark card gradients.
- **STI Rich Blue (`#002B7F`)**: Secondary brand blue used for gradients, card midtones, and prominent accents.
- **STI Vibrant Cobalt (`#0E4EBD` / `#0038A8`)**: Used for primary interactive actions, button gradients (`from-[#001A4D] to-[#0E4EBD]`), active sidebar highlights, and link focus rings.
- **STI Light Blue Tint (`#EFF6FF` / `#DBEAFE`)**: Used for subtle active item backgrounds, info pills, and soft badges.

### Accent & Highlight Colors
- **STI Golden Yellow (`#FFD41C` / `#FACC15`)**: High-impact accent. Used for status counters (e.g. `4 Pending`), outstanding amounts on dark cards, warning badges, and active tab notification pills.
- **STI Soft Gold Background (`#FEF9C3` / `#FEF08A`)**: Subtle background tint for light warning/pending tags.

### Semantic Status Colors
- **Success / Paid / Active (`#10B981` / `#059669`)**:
  - Text/Icon: `#059669` or `#10B981`
  - Light Badge Background: `#ECFDF5` (border `#A7F3D0`)
  - Glowing Stat Text on Dark Hero Cards: `#34D399` / `#10B981`
- **Overdue / Danger / Rejection (`#EF4444` / `#DC2626`)**:
  - Text/Icon: `#DC2626`
  - Light Badge Background: `#FEF2F2` (border `#FECACA`)
- **Pending / Warning (`#F59E0B` / `#D97706`)**:
  - Text/Icon: `#D97706`
  - Light Badge Background: `#FFFBEB` (border `#FDE68A`)
- **Neutral / Muted (`#64748B` / `#94A3B8`)**:
  - Background Surface: `#F8FAFC`
  - Secondary Text: `#64748B`
  - Border: `#E2E8F0`

---

## 3. Component Architecture

### A. The "Financial Overview" Hero Card Pattern
Inspired by the flagship mobile card, key admin summaries (Dashboard, Budget & Fund Settings, Financial Liquidations, Attendance Monitoring) use this dark gradient card:
- **Background**: `bg-gradient-to-br from-[#001A4D] via-[#002B7F] to-[#0A47B8]`
- **Border**: `border border-blue-900/40` with soft rounded corners `rounded-3xl`
- **Shadow**: `shadow-lg shadow-[#001A4D]/15`
- **Title**: White uppercase with subtle icon `text-white/80 font-bold text-xs tracking-wider`
- **Badge**: Yellow Pill `bg-[#FFD41C] text-[#001A4D] font-bold text-xs px-3 py-1 rounded-full`
- **Primary Metric Figures**:
  - Dues / Total: Crisp White `#FFFFFF`
  - Paid / Collections: Emerald Green `#34D399`
  - Balance / Outstanding: Golden Yellow `#FFD41C`
- **Progress Indicator**: Deep blue track with emerald or gold active progress bar.

### B. Standard Elevated Card Pattern
- **Background**: `#FFFFFF`
- **Radius**: `rounded-2xl` or `rounded-3xl`
- **Border**: `border border-gray-100` or `border-slate-200/80`
- **Shadow**: `shadow-xs` / `shadow-sm`
- **Header**: Deep Navy `#001A4D` with optional subtle subtitle `#64748B`.

### C. Buttons & Primary CTAs
- **Primary Action Button**:
  `bg-gradient-to-r from-[#001A4D] to-[#0E4EBD] text-white font-semibold rounded-xl px-5 py-2.5 shadow-sm hover:opacity-95 hover:shadow transition-all active:scale-[0.99]`
- **Secondary Action Button**:
  `bg-white border border-gray-200 text-[#001A4D] font-semibold rounded-xl px-5 py-2.5 hover:bg-gray-50 transition-all`
- **Danger Action Button**:
  `bg-red-600 hover:bg-red-700 text-white font-semibold rounded-xl px-5 py-2.5 shadow-xs transition-all`

### D. Navigation & Pill Tabs
- **Active Pill Tab**: `bg-[#001A4D] text-white font-bold rounded-xl shadow-xs` with yellow count badge `bg-[#FFD41C] text-[#001A4D] px-2 py-0.5 rounded-full text-xs font-black`.
- **Inactive Pill Tab**: `text-gray-500 hover:text-gray-900 hover:bg-gray-100/80 rounded-xl transition-all`.

### E. Modals & Dialogs
- **Modal Header**: Deep Navy top header `bg-[#001A4D]` or clean white header with `#001A4D` text and a subtle slate border.
- **Backdrop**: Smooth blur `backdrop-blur-sm bg-black/40`.
- **Form Inputs**: `bg-gray-50/80 border border-gray-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-[#0E4EBD]/30 focus:border-[#0E4EBD] transition-all`.

---

## 4. Typography & Spacing
- **Font Family**: Inter, system-ui, sans-serif
- **Headings**:
  - H1: `text-2xl lg:text-3xl font-extrabold text-[#001A4D] tracking-tight`
  - H2: `text-xl font-bold text-[#001A4D]`
  - H3: `text-base font-semibold text-[#001A4D]`
- **Body**: `text-sm text-gray-600`
- **Data & Figures**: `font-mono font-bold` for monetary figures and IDs.

---

## 5. Implementation Standard
Every admin view, modal, and subcomponent must adhere to these tokens to ensure an unmistakable, unified STI enterprise aesthetic across the entire web platform.
