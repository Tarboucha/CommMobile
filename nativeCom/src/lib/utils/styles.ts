import { StyleSheet, ViewStyle, TextStyle, ImageStyle } from 'react-native';

/**
 * Style utility type
 */
type Style = ViewStyle | TextStyle | ImageStyle;

/**
 * Merge multiple style objects
 * Similar to cn() in web app
 *
 * @example
 * const style = mergeStyles(
 *   commonStyles.container,
 *   { backgroundColor: 'red' },
 *   isActive && { opacity: 1 }
 * );
 */
export function mergeStyles<T extends Style>(
  ...styles: (T | false | undefined | null)[]
): T {
  const filtered = styles.filter((s): s is T => Boolean(s));
  return Object.assign({}, ...filtered) as T;
}

/**
 * Create style variants
 * Similar to CVA (Class Variance Authority) in web app
 *
 * @example
 * const buttonVariants = createStyleVariants(
 *   { padding: 10, borderRadius: 5 },
 *   {
 *     variant: {
 *       primary: { backgroundColor: 'blue' },
 *       secondary: { backgroundColor: 'gray' },
 *     },
 *     size: {
 *       sm: { height: 32 },
 *       md: { height: 44 },
 *       lg: { height: 56 },
 *     },
 *   }
 * );
 *
 * const style = buttonVariants({ variant: 'primary', size: 'md' });
 */
export function createStyleVariants<
  BaseStyle extends Style,
  Variants extends Record<string, Record<string, Partial<BaseStyle>>>
>(
  base: BaseStyle,
  variants: Variants
): (props: { [K in keyof Variants]?: keyof Variants[K] }) => BaseStyle {
  return (props) => {
    let result = { ...base };

    for (const [key, value] of Object.entries(props)) {
      if (value && variants[key] && variants[key][value as string]) {
        result = { ...result, ...variants[key][value as string] };
      }
    }

    return result;
  };
}

/**
 * Responsive style helper
 * For now, returns the small size
 * TODO: Integrate with Dimensions API for true responsive design
 *
 * @example
 * const style = responsive(
 *   { fontSize: 14 },    // small (mobile)
 *   { fontSize: 16 },    // medium (tablet)
 *   { fontSize: 18 }     // large (desktop)
 * );
 */
export function responsive<T extends Style>(
  small: T,
  medium?: T,
  large?: T
): T {
  // For now, just return small
  // In the future, we can use Dimensions API to return appropriate size
  return small;
}

/**
 * Conditional style helper
 * Returns style if condition is true, otherwise returns empty object
 *
 * @example
 * const style = conditionalStyle(isActive, { opacity: 1 });
 */
export function conditionalStyle<T extends Style>(
  condition: boolean,
  style: T
): T | Record<string, never> {
  return condition ? style : {};
}

/**
 * Create a reusable style factory with theme colors
 *
 * @example
 * const createThemedButton = createStyleFactory((colors) => ({
 *   button: {
 *     backgroundColor: colors.primary,
 *     padding: 10,
 *   },
 *   text: {
 *     color: colors.primaryForeground,
 *   },
 * }));
 *
 * // Later in component:
 * const styles = createThemedButton(themeColors);
 */
export function createStyleFactory<
  T extends Record<string, Style>,
  Colors extends Record<string, string>
>(factory: (colors: Colors) => T): (colors: Colors) => T {
  return factory;
}
