# TODO.md

## Critical Path: Fix UI Information Density

The current UI wastes ~70% of vertical space on decorative borders and excessive padding. The generate button is below the fold on most screens. This is unacceptable. Every task below directly improves time-to-action.

### Phase 1: Surgical Space Recovery (Immediate Impact)

- [x] **Remove all decorative ASCII borders from dashboard components** - Delete the terminal-style border components in `src/components/dashboard/AnalysisFilters.tsx`, `src/components/dashboard/CommitAnalysisModule.tsx`, and `src/components/dashboard/RepositorySelector.tsx`. These borders alone consume ~120px of vertical space for zero functional value.

- [x] **Flatten the activity mode selector into horizontal pills** - In `src/components/dashboard/ActivityModeSelector.tsx`, replace the vertical radio button stack (currently lines 15-45) with inline flex buttons: `<div className="flex gap-2">{modes.map(mode => <button className="px-4 py-2 rounded-lg...`)`. This saves ~100px vertical.

- [x] **Inline date range inputs on single row** - Modify `src/components/dashboard/DateRangeSelector.tsx` lines 78-95 to place start_date and end_date inputs side-by-side using `grid grid-cols-2 gap-4` instead of stacked. Include the quick-select buttons (Last 7/30 days) as small pills above. Reduces height from ~200px to ~80px.

- [x] **Move Generate button to fixed header bar** - Extract the submit button from `src/app/dashboard/page.tsx` line 267 and place it in a new fixed header component at viewport top-right. Button should always be visible and show selected repos count: "Generate (12 repos)". Eliminates scroll-to-submit problem entirely.

- [x] **Reduce all padding values by 60%** - Global find/replace in `src/app/globals.css` and all component files: `p-8` → `p-3`, `p-6` → `p-2`, `p-4` → `p-1.5`, `py-4` → `py-1.5`, `px-6` → `px-2`. The current padding is optimized for 4K monitors, not 13" laptops.

### Phase 2: Information Hierarchy (Clear Signal)

- [x] **Replace terminal green theme with high-contrast modern colors** - In `tailwind.config.ts`, update the color palette: primary green `#00ff00` → `#10B981` (emerald-500), background `#0a0e0a` → `#ffffff`, text `#00ff00` → `#111827` (gray-900). The Matrix aesthetic is fun but reduces readability by ~40%.

- [x] **Implement smart repository pre-selection** - In `src/components/dashboard/RepositorySelector.tsx` line 45, add logic to auto-select repos with commits in last 30 days: `const recentRepos = repos.filter(r => r.pushed_at > thirtyDaysAgo)`. Pre-check these on mount. Users shouldn't manually select repos they're obviously working on.


- [x] **Show real-time selection feedback** - Update Generate button text dynamically in `src/app/dashboard/page.tsx` line 267: Show "Generate summary for USERNAME" (individual) or "Generate summary for X repos" (count) or "Generate team summary for X members". User should know exactly what will happen before clicking.

### Phase 3: State Management (Reduce Friction)

- [x] **Persist user selections to localStorage** - In `src/app/dashboard/page.tsx` line 32, add localStorage hooks to save/restore: selected activity mode, date range preference, selected repositories. Key: `gitpulse_preferences`. Users shouldn't re-enter the same preferences daily.

- [x] **Add "Generate Same as Last Time" quick action** - Add prominent button at page top that restores exact previous generation parameters and auto-submits. One click for repeat users. Store last params in localStorage key: `gitpulse_last_generation`.

- [x] **Implement loading state with progress indication** - Replace generic "Generating..." with specific progress: "Fetching commits from 12 repositories... (3/12 complete)". Add to `src/app/dashboard/page.tsx` lines 280-290. Users need to know the system is working and how long to wait.

### Phase 4: Layout Consolidation (Modern Patterns)

- [x] **Merge all filter components into single horizontal toolbar** - Create new `src/components/dashboard/CompactToolbar.tsx` combining ActivityMode + DateRange + Generate button in single 48px height bar. Replace the three separate sections in dashboard page.

- [x] **Convert repository list to virtualized scrolling** - Repository list is already using react-window, but increase visible item count from 10 to 20 (line 89 in RepositorySelector.tsx). More visible = faster selection.

- [x] **Add collapsible "Advanced Options" section** - Hide rarely-used options (custom date ranges, exclude forks, etc.) behind a disclosure triangle. Default closed. 95% of users need only the basics.

- [x] **Implement responsive breakpoints** - Add tablet/mobile layouts in dashboard page: Stack toolbar vertically on screens < 768px, hide repo list on mobile (default to "all"), adjust font sizes. Current design assumes desktop-only.

### Phase 5: Performance (Perceived Speed)

- [x] **Add optimistic UI updates** - When Generate is clicked, immediately show skeleton loader for results section while API calls happen. Don't make UI feel frozen during 2-3 second generation time.

- [x] **Prefetch repository data on page load** - In `src/app/dashboard/page.tsx`, start fetching repos in parallel with auth check, not sequentially after. Saves ~500ms on initial load.

- [ ] **Cache generated summaries for 5 minutes** - Add caching layer with key hash of (user, repos, date_range) to prevent regenerating identical summaries. Many users click Generate multiple times impatiently.

### Success Metrics

- Generate button visible without scrolling on 13" MacBook Air (1440x900)
- Time from page load to Generate click: < 3 seconds for repeat user
- Vertical space utilization: > 80% content, < 20% chrome
- Click count for common use case (my activity, last week, all repos): 1

### Notes

The terminal aesthetic is a self-indulgent distraction. Users want their commit summary, not a cyberpunk fantasy. Every pixel of chrome should justify its existence through improved task completion rate. The current design optimizes for screenshots, not daily use.

Remember Carmack's principle: "Focus on what you can measure and improve." We can measure pixels wasted, clicks required, and time-to-action. Optimize those relentlessly.
