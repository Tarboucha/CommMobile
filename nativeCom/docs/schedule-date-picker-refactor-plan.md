# Schedule Date Picker Refactor Plan

## Goal

Create a **flexible, reusable calendar component** that can be used in multiple contexts:
- Chef Calendar (manage schedules)
- Browse Date Picker (customer selects pickup slot)
- Future: Order history, availability preview, etc.

---

## Current Problems

1. **Duplication**: `ChefCalendarScreen` and `ScheduleDatePicker` have similar logic but separate implementations
2. **Tight Coupling**: Calendar components are tied to specific use cases
3. **Not Reusable**: Can't easily add calendar to new screens

---

## Solution: Flexible Calendar Component

Create a generic `Calendar` component that accepts:
- Data (slots by date)
- Render functions for customization
- Callbacks for interactions

---

## Target UI

```
┌─────────────────────────────────────────┐
│  [X]       Pick a Date                  │  ← Header with close button
│            Meal Name                    │
├─────────────────────────────────────────┤
│  [<]    January 2026    [>]             │  ← CalendarHeader (month nav)
│  2 schedules • 3 slots today            │
├─────────────────────────────────────────┤
│  Mon  Tue  Wed  Thu  Fri  Sat  Sun      │  ← WeekStrip (scrollable)
│  20   21   22   23   24   25   26       │
│       ●         ●    ●                  │  ← Green dots = available
├─────────────────────────────────────────┤
│  Wednesday, January 22                  │  ← Selected day header
│  2 slots available                      │
│─────────────────────────────────────────│
│  ┌─────────────────────────────────┐    │
│  │ Lunch                           │    │  ← Slot Card 1
│  │ 🕐 11:00 - 14:00                │    │
│  │           [8 available]    (○)  │    │
│  └─────────────────────────────────┘    │
│  ┌─────────────────────────────────┐    │
│  │ Dinner                          │    │  ← Slot Card 2
│  │ 🕐 18:00 - 21:00                │    │
│  │           [Only 3 left!]   (●)  │    │  ← Selected
│  └─────────────────────────────────┘    │
├─────────────────────────────────────────┤
│  [ Confirm: 18:00 - 21:00 ]             │  ← Confirm button
└─────────────────────────────────────────┘
```

---

## Architecture: Flexible Calendar System

```
┌─────────────────────────────────────────────────────────────┐
│                    SHARED COMPONENTS                         │
│  (src/components/ui/calendar/)                              │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  Calendar              - Main container, orchestrates all    │
│    ├── CalendarHeader  - Month/year navigation (existing)   │
│    ├── WeekStrip       - Day selection (existing)           │
│    └── DayContent      - Render prop for day details        │
│                                                              │
└─────────────────────────────────────────────────────────────┘
                            │
            ┌───────────────┼───────────────┐
            ▼               ▼               ▼
    ┌──────────────┐ ┌──────────────┐ ┌──────────────┐
    │ Chef Calendar│ │ Browse Picker│ │ Future Use   │
    │   Screen     │ │    Modal     │ │              │
    ├──────────────┤ ├──────────────┤ ├──────────────┤
    │ DaySlotsEdit │ │ DaySlotsPick │ │ Custom       │
    │ (edit/cancel)│ │ (select one) │ │ Content      │
    └──────────────┘ └──────────────┘ └──────────────┘
```

---

## Components to Create/Modify

### 1. `Calendar` (NEW - Generic Container)

**Location:** `src/components/ui/calendar/calendar.tsx`

**Props:**
```typescript
interface CalendarProps {
  // Data
  slotsMap: CalendarSlotsMap;

  // State
  selectedDate: string;
  onDateSelect: (date: string) => void;

  // Navigation
  currentMonth: Date;
  onMonthChange: (date: Date) => void;
  minDate?: Date;
  maxDate?: Date;

  // Customization
  renderDayContent: (dayData: DaySlots | null, date: string) => React.ReactNode;

  // Optional header info
  headerStats?: {
    scheduleCount?: number;
    todaySlotCount?: number;
  };
}
```

### 2. Move Existing Components

**From:** `src/components/pages/account/chef/calendar/`
**To:** `src/components/ui/calendar/`

Files to move:
- `calendar-header.tsx` → keep as is
- `week-strip.tsx` → keep as is

### 3. `DaySlotsPicker` (NEW - For Browse)

**Location:** `src/components/ui/calendar/day-slots-picker.tsx`

Renders selectable slot cards for customer to pick a time.

**Props:**
```typescript
interface DaySlotsPickerProps {
  dayData: DaySlots | null;
  selectedDate: string;
  selectedSlot: CalendarSlot | null;
  onSlotSelect: (slot: CalendarSlot) => void;
}
```

### 4. `DaySlotsEditor` (RENAME existing)

**Location:** `src/components/ui/calendar/day-slots-editor.tsx`

Rename from `day-slots-section.tsx` - for chef to edit/cancel slots.

### 5. `SlotCard` Variants

**Picker variant:** `src/components/ui/calendar/slot-card-picker.tsx`
- Radio button selection
- Shows availability count
- No edit actions

**Editor variant:** `src/components/ui/calendar/slot-card-editor.tsx`
- Edit/Cancel/Restore buttons
- Inline exception editing
- Shows sold count

---

## Data Flow

```
MealDetailModal
    │
    ├── Opens ScheduleDatePicker with `mealWithSlots`
    │
    ▼
ScheduleDatePicker
    │
    ├── convertToCalendarSlotsMap(meal) → CalendarSlotsMap
    │
    ├── CalendarHeader (month navigation)
    │
    ├── WeekStrip (day selection, shows green dots)
    │
    ├── Day Slots Section
    │   ├── Date header ("Wednesday, January 22")
    │   └── SlotCard for each slot
    │
    └── Confirm Button
            │
            ▼
        onSelectSlot(DisplaySlot) → MealDetailModal
```

---

## Types

### Existing (keep)

```typescript
// From @/types/availability
interface CalendarSlot {
  schedule_id: string;
  meal_id: string;
  meal_name: string;
  date: string;
  start_time: string;
  end_time: string;
  quantity_available: number;
  quantity_sold: number;
  slot_label: string | null;
  is_public: boolean;
  is_cancelled: boolean;
  has_exception: boolean;
  exception_reason: string | null;
}
```

### Export (for MealDetailModal)

```typescript
export interface DisplaySlot {
  scheduleId: string;
  date: string;
  startTime: string;
  endTime: string;
  maxQuantity: number;
  remainingQuantity: number;
  isCancelled: boolean;
  isSoldOut: boolean;
  hasException: boolean;
  slotLabel: string | null;
  // Display helpers
  dayLabel: string;      // "Today", "Tomorrow", "Wed, Jan 22"
  timeLabel: string;     // "11:00 - 14:00"
  isToday: boolean;
  isTomorrow: boolean;
  daysFromNow: number;
}
```

---

## Implementation Steps

### Phase 1: Create Shared Calendar Components

**Step 1.1:** Create calendar UI folder structure
```
src/components/ui/calendar/
├── index.ts              # Exports
├── calendar.tsx          # Main container
├── calendar-header.tsx   # (move from chef folder)
├── week-strip.tsx        # (move from chef folder)
├── day-slots-picker.tsx  # For browse/selection
├── day-slots-editor.tsx  # For chef management
├── slot-card-picker.tsx  # Selectable slot card
└── slot-card-editor.tsx  # Editable slot card
```

**Step 1.2:** Move `CalendarHeader` and `WeekStrip`
- Move files to new location
- Update imports in existing consumers
- No logic changes needed

**Step 1.3:** Create `Calendar` container component
- Combines header + week strip
- Accepts render prop for day content
- Handles month navigation state

**Step 1.4:** Create `SlotCardPicker`
- Simple selectable card
- Radio button style selection
- Quantity badge

**Step 1.5:** Create `DaySlotsPicker`
- List of SlotCardPicker
- Empty state
- Date header

### Phase 2: Refactor Browse Picker

**Step 2.1:** Rewrite `ScheduleDatePicker`
- Use new `Calendar` component
- Use `DaySlotsPicker` for day content
- Keep Modal wrapper
- Clean up deprecated code

**Step 2.2:** Update `MealDetailModal`
- Ensure compatibility with refactored picker

### Phase 3: Refactor Chef Calendar

**Step 3.1:** Create `SlotCardEditor`
- Move from existing `slot-card.tsx`
- Add to shared folder

**Step 3.2:** Create `DaySlotsEditor`
- Move from existing `day-slots-section.tsx`
- Use `SlotCardEditor`

**Step 3.3:** Update `ChefCalendarScreen`
- Use new `Calendar` component
- Use `DaySlotsEditor` for day content

### Phase 4: Cleanup

**Step 4.1:** Remove old files from chef folder
**Step 4.2:** Update all imports
**Step 4.3:** Test both flows

---

## File Changes Summary

| File | Action |
|------|--------|
| `src/components/ui/calendar/index.ts` | **NEW** |
| `src/components/ui/calendar/calendar.tsx` | **NEW** |
| `src/components/ui/calendar/calendar-header.tsx` | **MOVE** |
| `src/components/ui/calendar/week-strip.tsx` | **MOVE** |
| `src/components/ui/calendar/day-slots-picker.tsx` | **NEW** |
| `src/components/ui/calendar/day-slots-editor.tsx` | **MOVE + RENAME** |
| `src/components/ui/calendar/slot-card-picker.tsx` | **NEW** |
| `src/components/ui/calendar/slot-card-editor.tsx` | **MOVE** |
| `src/components/pages/chef/meals/schedule-date-picker.tsx` | **REFACTOR** |
| `src/components/pages/account/chef/calendar/chef-calendar-screen.tsx` | **REFACTOR** |
| `src/components/pages/account/chef/calendar/*.tsx` | **DELETE** (after move) |

---

## Usage Examples

### Browse Date Picker (Customer)

```tsx
import { Calendar, DaySlotsPicker } from '@/components/ui/calendar';

function ScheduleDatePicker({ meal, onSelectSlot }) {
  const [selectedDate, setSelectedDate] = useState(formatDateISO(new Date()));
  const [selectedSlot, setSelectedSlot] = useState(null);
  const [currentMonth, setCurrentMonth] = useState(new Date());

  const slotsMap = convertMealToSlotsMap(meal);

  return (
    <Calendar
      slotsMap={slotsMap}
      selectedDate={selectedDate}
      onDateSelect={setSelectedDate}
      currentMonth={currentMonth}
      onMonthChange={setCurrentMonth}
      renderDayContent={(dayData, date) => (
        <DaySlotsPicker
          dayData={dayData}
          selectedDate={date}
          selectedSlot={selectedSlot}
          onSlotSelect={setSelectedSlot}
        />
      )}
    />
  );
}
```

### Chef Calendar (Management)

```tsx
import { Calendar, DaySlotsEditor } from '@/components/ui/calendar';

function ChefCalendarScreen() {
  const [selectedDate, setSelectedDate] = useState(formatDateISO(new Date()));
  const [currentMonth, setCurrentMonth] = useState(new Date());

  const slotsMap = useChefCalendarSlots(currentMonth);

  return (
    <Calendar
      slotsMap={slotsMap}
      selectedDate={selectedDate}
      onDateSelect={setSelectedDate}
      currentMonth={currentMonth}
      onMonthChange={setCurrentMonth}
      renderDayContent={(dayData, date) => (
        <DaySlotsEditor
          dayData={dayData}
          selectedDate={date}
          onModify={handleModify}
          onCancel={handleCancel}
        />
      )}
    />
  );
}
```

---

## Acceptance Criteria

### Shared Calendar Component
- [ ] `Calendar` component accepts slotsMap and renders header + week strip
- [ ] `Calendar` accepts renderDayContent prop for customization
- [ ] Month navigation works (prev/next)
- [ ] Day selection updates selectedDate
- [ ] Week strip shows availability indicators (dots)

### Browse Picker (DaySlotsPicker)
- [ ] Shows selectable slot cards
- [ ] Radio-button style selection
- [ ] Shows quantity available / low stock warning
- [ ] Empty state when no slots
- [ ] Slot label displayed if exists

### Chef Editor (DaySlotsEditor)
- [ ] Shows editable slot cards
- [ ] Edit/Cancel/Restore actions work
- [ ] Inline exception editing
- [ ] Shows sold count

### Integration
- [ ] `ScheduleDatePicker` uses new Calendar + DaySlotsPicker
- [ ] `ChefCalendarScreen` uses new Calendar + DaySlotsEditor
- [ ] No regressions in either flow
- [ ] All imports updated
