## General rules

- Use `npx expo install <package>` instead of `npm install <package>` to install dependencies
- Use kebab-case for all TypeScript file names
- Prefer defining functions with const rather than the function keyword
- Don't leave comments in the code

## Styling

We use Uniwind/Tailwind for styling. It works roughly like Nativewind but with different utility functions - see below.

### General styling rules

- We use shadcn-style named colours, defined in `app/global.css`. **Always use these named colours and do not use built-in Tailwind ones like `bg-red-500`.**
- If a wrapped component exists in `components/styled.tsx`, use that component instead of directly using the React Native or third party one. For example, always use `StyledText` instead of `Text`.

### Uniwind utility functions

- The `useUniwind` function returns the current theme. **Always use this instead of `useColorScheme` from React Native**

  ```ts
  const { theme } = useUniwind();
  ```

- The `withUniwind` function adds `className` styling support to third party components

  ```ts
  const StyledSafeAreaView = withUniwind(SafeAreaView);

  <StyledSafeAreaView className="..." />
  ```

- The `useResolveClassNames` function converts Tailwind class names to React Native style objects, in places where `withUniwind` cannot be used such as `react-navigation` options

  ```ts
  const styles = useResolveClassNames('bg-background p-4 rounded-lg')
  return <View style={styles}>Content</View>
  ```

- The `useCSSVariable` function returns one or more CSS variable values, useful for fetching specific style values in the current theme in places where `className` cannot be used

  ```ts
  const primaryColor = useCSSVariable("--color-primary");
  ```
