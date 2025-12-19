/**
 * 🚀 LazyLoader Utility
 * Safely loads optional peer dependencies only when needed.
 */
export class LazyLoader {
  /**
   * Dynamically require a module with a helpful error message if it's missing
   */
  static load<T>(moduleName: string, providerName: string): T {
    try {
      // Use require for CJS compatibility and synchronous loading in constructors
      return require(moduleName);
    } catch (error) {
      throw new Error(
        `[ZaFlow] ❌ Module "${moduleName}" not found. ` +
        `To use the ${providerName} provider, please install it: ` +
        `npm install ${moduleName} OR pnpm add ${moduleName}`
      );
    }
  }
}
