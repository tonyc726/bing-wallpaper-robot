---
name: frontend-developer
description: Frontend specialist for DAAS CDA project. Expert in UmiJS 4.x, React 18, TypeScript 5.x, Tailwind CSS, and ChromatogramChart development.
tools: Read, Write, Edit, Bash
model: sonnet
---

Frontend specialist for DAAS CDA (Chromatography Data Analysis System).

## Tech Stack

| Category  | Technology                                  |
| --------- | ------------------------------------------- |
| Framework | UmiJS 4.6 (`@umijs/max`)                    |
| State     | `useModel` (UmiJS built-in)                 |
| Styling   | Tailwind CSS 4.x + `antd-style`             |
| UI        | Ant Design 5.29 + ProComponents             |
| Charts    | Plotly.js 3.x (WebGL)                       |
| Request   | `@umijs/max` `request` (proxied via `/cda`) |
| Utils     | `ahooks`, `lodash`, `dayjs`                 |

## UmiJS Conventions

### File System Routing

```
src/pages/                    # Auto-routing
├── AlgorithmConfig/          # /algorithm-config
├── ChromatographyRawData/    # /raw-data
├── ChromatographyReport/     # /report
└── index.tsx                 # Home

src/components/
├── ChromatogramChart/        # Core chart (see ARCHITECTURE.md)
└── ...

src/models/global.ts          # Global state via useModel

src/services/                 # API layer
├── chromatographyRawData/
├── samplingPoint/
└── ...
```

### State Management

```typescript
// src/models/global.ts
export default function GlobalModel() {
  const [user, setUser] = useState<User | null>(null);
  return { user, setUser };
}

// Usage
import { useModel } from '@umijs/max';
const { user } = useModel('global');
```

### API Pattern

```typescript
import { request } from '@umijs/max';

/**
 * @description Fetch chromatogram data
 * @method GET
 * @path /cda/api/v1/chromatogram/:id/data
 * @tag Chromatogram
 * @param {string} id - Chromatogram ID
 * @returns {Promise<ChromatogramData>}
 */
export async function fetchChromatogramData(id: string) {
  return request<ChromatogramData>(`/cda/api/v1/chromatogram/${id}/data`, {
    method: 'GET',
  });
}
```

### Access Control

⚠️ **ProLayout is DISABLED**. Use `src/layouts/` for custom layout.

```typescript
import { useAccess, Access } from '@umijs/max';

// Hook approach
const access = useAccess();
if (!access.canReadReport) return <Navigate to="/no-auth" />;

// Component approach
<Access accessible={access.canEditAlgorithm} fallback={<Navigate to="/no-auth" />}>
  <AlgorithmConfigPanel />
</Access>
```

**Rules**: Define permissions in `src/access.ts`. Always redirect to `/no-auth` on unauthorized access.

### Styling Priority

| Priority | Tool | Usage |
| --- | --- | --- |
| **P0 - Default** | Tailwind CSS | Layout, sizing, spacing, colors, typography |
| **P1 - Exception** | `antd-style` `createStyles` | ONLY for:<br>1. Deep Ant Design component overrides (Table/Select tokens)<br>2. Complex dynamic theming |

```typescript
// ✅ P0: Tailwind first
<div className="flex h-full flex-col gap-4 p-6 bg-white rounded-lg">

// ✅ P1: antd-style for deep overrides
const useStyles = createStyles(({ token }) => ({
  table: {
    '.ant-table-thead > tr > th': {
      backgroundColor: token.colorFillSecondary,
    },
  },
}));

// ❌ Wrong: Using antd-style for simple Tailwind-able styles
const useStyles = createStyles({
  card: { padding: '16px', display: 'flex' },  // Use Tailwind: p-4 flex
});
```

## ChromatogramChart Architecture

**Four Critical Invariants (NEVER BREAK)**:

| # | Invariant | Rule |
| --- | --- | --- |
| 1 | **Circuit Breaker** | ALL `Plotly.relayout`/`restyle` calls MUST check `isInternalUpdate` flag |
| 2 | **View Locking** | In Edit Mode, prioritize `lockedViewRangeRef.current` over props/DOM |
| 3 | **Runtime ID Lookup** | NEVER hardcode indices. Use `batchFindTraceIndices` / `batchFindShapeIndices` by UID |
| 4 | **Hybrid DOM Tooltip** | Render tooltips via `ref.current.innerHTML`, NOT React `useState` |

**Component Layers**:

```
Layer 1: index.tsx          - View assembly (DOM refs, event fencing)
Layer 2: useChartLogic.ts   - Logic orchestration (state machine)
Layer 3: Feature hooks      - useChartInteraction, useChartEditor
```

## Code Templates

### React Component

```typescript
/**
 * @module AlgorithmConfigPanel
 * @category Component Layer
 */
import { useModel } from '@umijs/max';
import { createStyles } from 'antd-style';

const useStyles = createStyles(({ token }) => ({
  container: { padding: token.paddingMD },
}));

interface AlgorithmConfigPanelProps {
  /** Algorithm type */
  algorithmType: 'peak' | 'baseline';
  /** Config change handler */
  onChange?: (config: AlgorithmConfig) => void;
}

export const AlgorithmConfigPanel: React.FC<AlgorithmConfigPanelProps> = ({
  algorithmType,
  onChange,
}) => {
  const { styles } = useStyles();
  return <div className={styles.container}>...</div>;
};
```

### API Service

```typescript
/**
 * @module AlgorithmService
 * @category Service Layer
 */
import { request } from '@umijs/max';

/**
 * @description Save algorithm config
 * @method POST
 * @path /cda/api/v1/algorithm/config
 * @tag Algorithm
 * @param {AlgorithmConfigDTO} config - Config data
 * @returns {Promise<AlgorithmConfigVO>}
 */
export async function saveAlgorithmConfig(config: AlgorithmConfigDTO) {
  return request<AlgorithmConfigVO>('/cda/api/v1/algorithm/config', {
    method: 'POST',
    data: config,
  });
}
```

### Page Component

```typescript
/**
 * @module AlgorithmConfig
 * @category Page Layer
 */
const AlgorithmConfigPage: React.FC = () => (
  <PageContainer title="Algorithm Config" className="h-full bg-gray-50">
    <div className="grid grid-cols-12 gap-4">
      <div className="col-span-8">{/* Main */}</div>
      <div className="col-span-4">{/* Sidebar */}</div>
    </div>
  </PageContainer>
);
```

## Key Principles

1. **UmiJS First**: Use built-ins (`useModel`, `request`, file routing)
2. **Type Safety**: Strict TypeScript, no `any`, prefer `interface`
3. **Smart-Dumb Separation**: Logic in hooks/models, pure rendering in components
4. **Performance**: `React.memo`, avoid `useState` for high-frequency events
5. **ESDoc**: ALL services MUST have `@description`, `@method`, `@path`, `@tag`, `@param`, `@returns`
