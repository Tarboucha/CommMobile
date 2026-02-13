# Babel Configuration Explained

## Overview

This document explains the `babel.config.js` configuration for the nativeComChefs React Native app running on **Expo SDK 54** with **NativeWind v4**.

```javascript
module.exports = function (api) {
  api.cache(true);
  return {
    presets: [
      ['babel-preset-expo', { jsxImportSource: 'nativewind' }],
    ],
    plugins: [
      'react-native-worklets/plugin',
    ],
  };
};
```

---

## Line-by-Line Breakdown

### 1. `module.exports = function (api) { ... }`

Babel configs can be either:
- **Static**: A plain object `module.exports = { presets: [...] }`
- **Dynamic**: A function that receives the Babel API

We use the **function form** because it gives access to the `api` object, which allows caching and environment detection.

---

### 2. `api.cache(true)`

```javascript
api.cache(true);
```

**What it does:** Tells Babel to cache the config permanently.

**Why it matters:**
- Babel re-evaluates config files on every compilation by default
- `api.cache(true)` = "this config never changes, cache it forever"
- Significantly speeds up build times (especially in development with hot reload)

**Other options:**
| Value | Behavior |
|-------|----------|
| `api.cache(true)` | Cache forever (config never changes) |
| `api.cache(false)` | Never cache (re-evaluate every time) |
| `api.cache.using(() => process.env.NODE_ENV)` | Cache based on environment |
| `api.cache.invalidate(() => Date.now())` | Always invalidate (same as false) |

---

### 3. Presets Array

```javascript
presets: [
  ['babel-preset-expo', { jsxImportSource: 'nativewind' }],
],
```

**Presets** are pre-configured sets of Babel plugins bundled together. They're applied in **reverse order** (last to first).

#### `babel-preset-expo`

The official Expo preset that includes everything needed for React Native + Expo:

| Included Feature | Description |
|------------------|-------------|
| `@babel/preset-env` | Transforms modern JS to compatible version |
| `@babel/preset-react` | Transforms JSX syntax |
| `@babel/preset-typescript` | Strips TypeScript types |
| `metro-react-native-babel-preset` | React Native specific transforms |
| React Compiler (SDK 54+) | Automatic memoization |
| Reanimated plugin (SDK 54+) | Worklet transforms (auto-included) |

#### `{ jsxImportSource: 'nativewind' }`

This option configures the **JSX transform** to use NativeWind's custom JSX runtime.

**How JSX Transform Works:**

```jsx
// You write:
<View className="flex-1 bg-red-500" />

// Without jsxImportSource, compiles to:
import { jsx } from 'react/jsx-runtime';
jsx(View, { className: "flex-1 bg-red-500" });

// With jsxImportSource: 'nativewind', compiles to:
import { jsx } from 'nativewind/jsx-runtime';
jsx(View, { className: "flex-1 bg-red-500" });
```

**Why NativeWind needs this:**
- NativeWind's JSX runtime intercepts the `className` prop
- Converts Tailwind classes to React Native `style` objects
- Happens at runtime, not build time
- Requires `react-native-css-interop` package to work

---

### 4. Plugins Array

```javascript
plugins: [
  'react-native-worklets/plugin',
],
```

**Plugins** are individual Babel transforms. Applied in **order** (first to last), **before** presets.

#### `react-native-worklets/plugin`

**What it does:** Enables worklets - JavaScript functions that run on the UI thread.

**Why it's needed:**
- Used by `react-native-reanimated` for smooth 60fps animations
- Used by other libraries like `react-native-gesture-handler`
- Worklets bypass the JS-to-Native bridge for performance

**How worklets work:**

```javascript
// Regular function (runs on JS thread)
const handleScroll = (offset) => {
  console.log(offset);
};

// Worklet function (runs on UI thread)
const handleScroll = (offset) => {
  'worklet';
  // This runs directly on the UI thread!
  scrollY.value = offset;
};
```

The Babel plugin:
1. Detects functions with `'worklet'` directive
2. Serializes them to run on the UI thread
3. Handles shared values and dependencies

---

## What We Removed (And Why)

### Removed: `'nativewind/babel'`

```javascript
// OLD (broken with Expo SDK 54)
presets: [
  ['babel-preset-expo', { jsxImportSource: 'nativewind' }],
  'nativewind/babel',  // ❌ REMOVED
],
```

**Why removed:**
- `nativewind/babel` was needed in NativeWind v2/v3
- In NativeWind v4, the JSX transform is handled differently
- Having both `jsxImportSource: 'nativewind'` AND `nativewind/babel` causes conflicts
- The `jsxImportSource` option is the v4 way to enable NativeWind

**Symptoms when included:**
- Styles not applying
- Blank screens
- CSS classes ignored

---

## Important: What NOT to Add

### Don't add `react-native-reanimated/plugin`

```javascript
// DON'T DO THIS in Expo SDK 54
plugins: [
  'react-native-reanimated/plugin',  // ❌ Already in babel-preset-expo
],
```

**Why:**
- As of Expo SDK 54, `babel-preset-expo` **automatically includes** the Reanimated plugin
- Adding it manually causes "Duplicate plugin/preset detected" errors
- The Expo team handles version compatibility automatically

### Don't add both worklets plugins

```javascript
// DON'T DO THIS
plugins: [
  'react-native-worklets/plugin',
  'react-native-reanimated/plugin',  // ❌ Conflicts with worklets
],
```

**Why:**
- `react-native-reanimated/plugin` internally uses `react-native-worklets`
- Having both causes duplicate transformation errors

---

## Dependency Chain

```
babel-preset-expo
    └── includes react-native-reanimated/plugin (SDK 54+)
            └── uses react-native-worklets internally

Your babel.config.js
    └── react-native-worklets/plugin (explicit, for non-reanimated worklets)

NativeWind
    └── jsxImportSource: 'nativewind' (in babel-preset-expo options)
            └── requires react-native-css-interop package
```

---

## Required Packages

For this babel config to work, these packages must be installed:

| Package | Purpose |
|---------|---------|
| `babel-preset-expo` | Core Expo preset (included with Expo) |
| `nativewind` | Tailwind CSS for React Native |
| `react-native-css-interop` | JSX runtime for NativeWind v4 |
| `react-native-worklets` | Worklet support |
| `react-native-reanimated` | Animations (optional but common) |

---

## Troubleshooting

### Styles not applying?

1. Ensure `react-native-css-interop` is installed:
   ```bash
   pnpm add react-native-css-interop
   ```

2. Clear cache and restart:
   ```bash
   npx expo start --clear
   ```

### "Duplicate plugin" error?

Remove any manually added `react-native-reanimated/plugin` - it's auto-included in SDK 54.

### Worklets not working?

Ensure `react-native-worklets/plugin` is in the plugins array.

---

## Version Compatibility Matrix

| Expo SDK | NativeWind | Reanimated | babel-preset-expo includes reanimated? |
|----------|------------|------------|----------------------------------------|
| 52       | 4.x        | 3.x        | No (add manually)                      |
| 53       | 4.x        | 3.x        | No (add manually)                      |
| **54**   | **4.2+**   | **4.x**    | **Yes (auto-included)**                |
| 55+      | 5.x        | 4.x        | Yes                                    |

---

## References

- [Expo SDK 54 Changelog](https://expo.dev/changelog/sdk-54)
- [NativeWind v4 Documentation](https://www.nativewind.dev/)
- [Babel Configuration Docs](https://babeljs.io/docs/config-files)
- [React Native Reanimated](https://docs.swmansion.com/react-native-reanimated/)
