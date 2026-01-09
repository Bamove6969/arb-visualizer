# Design Guidelines: Arbitrage Calculator Web App

## Design Approach
**Selected System**: Material Design principles adapted for financial data clarity
**Rationale**: This is a utility-focused calculation tool requiring instant data comprehension, clear visual hierarchy for numerical data, and professional trust signals. Material's emphasis on structured information display and clear feedback aligns perfectly with arbitrage analysis needs.

## Core Design Elements

### Typography System
**Font Stack**: Google Fonts - Inter (UI/body) + JetBrains Mono (numbers/data)
- **Headings**: Inter Bold, sizes: text-2xl (main title), text-xl (section headers)
- **Body Text**: Inter Regular, text-base for labels, text-sm for helper text
- **Numerical Data**: JetBrains Mono Bold for all prices, percentages, and calculations (enhanced readability for financial figures)
- **Results Display**: Large numerical emphasis - text-3xl for profit amounts, text-2xl for ROI percentages

### Layout System
**Spacing Primitives**: Tailwind units of 2, 4, 6, and 8
- Card padding: p-6
- Form field spacing: space-y-4
- Section gaps: gap-6 between major components
- Container: max-w-4xl mx-auto for optimal readability

**Grid Structure**: 
- Single column form layout (stack inputs vertically)
- Two-column results grid for scenario comparison (grid-cols-1 md:grid-cols-2)
- Full-width warning banner when triggered

### Component Library

**Input Forms**:
- Floating label inputs with clean borders
- Currency symbol prefix ($) integrated into input design
- Real-time validation feedback
- Input groups: Site name + price paired together in contained cards
- Clear visual separation between Site A and Site B inputs

**Results Cards**:
- Elevated cards (shadow-lg) for each scenario
- Distinct visual states: Profit (success treatment), Loss (error treatment), Neutral (default)
- Card header: Scenario description with action summary
- Card body: Cost breakdown, profit/loss margin, ROI percentage, investment projection
- Visual indicators: Icon badges (✓ for profit, ✗ for loss) prominently displayed

**Status Indicators**:
- Profit opportunity: Success state with prominent positive margin display
- No opportunity: Muted state with clear loss indication  
- ROI badges: Pill-shaped containers highlighting percentage returns
- Investment calculator: Inline calculation showing "$1000 → $XXX profit" format

**Warning Banner**:
- Full-width alert component
- Conditional rendering when "PredictIt" detected
- Warning icon with fee breakdown details
- Distinct visual treatment separate from results

### Information Architecture

**Page Structure**:
1. Header: App title "💸 Arbitrage Hunter" with tagline
2. Instruction Panel: Brief reminder about identical question requirements
3. Input Section: Two-column layout for Site A and Site B (stacks on mobile)
4. Calculate Button: Full-width, prominent CTA
5. Results Grid: Side-by-side scenario comparison (stacks on mobile)
6. Fee Warning: Conditional banner below results
7. Secondary Action: "Calculate Another" button

**Visual Hierarchy**:
- Primary focus: Profit/loss amounts (largest, boldest typography)
- Secondary: ROI percentages and scenario descriptions
- Tertiary: Cost breakdowns and helper text
- Emphasis through size, weight, and strategic use of monospace for numbers

### Responsive Behavior
- Desktop (lg): Two-column results, spacious padding
- Tablet (md): Maintained two-column with tighter spacing  
- Mobile (base): Single column stack, full-width buttons, optimized touch targets (min-h-12 for inputs)

### Interaction Patterns
- Live calculation: Results update instantly as prices change
- Clear state management: Empty state, calculating state, results state
- Form validation: Inline errors for non-numeric inputs
- Focus states: Clear keyboard navigation indicators
- No page refresh: SPA experience with smooth transitions

### Data Visualization Strategy
- Numerical prominence: All financial figures use monospace font at emphasized sizes
- Comparative display: Side-by-side scenario cards enable instant comparison
- Color-coded outcomes: Visual scanning for profitable opportunities (though specific colors determined later)
- Contextual examples: "$1000 investment" projections ground abstract percentages in real terms

### Professional Polish
- Consistent corner radius: rounded-lg for all cards and inputs
- Subtle elevation: shadow hierarchy (inputs < cards < active states)
- Breathing room: Generous whitespace between calculation groups
- Clear affordances: Buttons clearly distinguished from informational elements
- Error prevention: Input constraints and helpful placeholder text

This design prioritizes speed of comprehension and decision-making—users should instantly identify profitable arbitrage opportunities through clear visual hierarchy and strategic information density.