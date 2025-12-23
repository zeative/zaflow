import { createRequire } from 'module';

/**
 * 🚀 LazyLoader Utility
 * Safely loads optional peer dependencies only when needed.
 * Supports both CommonJS and ESM environments.
 */
export class LazyLoader {
  private static _require: NodeRequire | null = null;

  /**
   * Get or create a require function that works in both CJS and ESM
   */
  private static getRequire(): NodeRequire {
    if (this._require) return this._require;

    // Try native require first (CJS environment)
    if (typeof require !== 'undefined') {
      this._require = require;
      return this._require;
    }

    // ESM environment - create require using import.meta.url or fallback
    try {
      // Use createRequire with a base URL
      this._require = createRequire(import.meta.url);
      return this._require;
    } catch {
      // Fallback: create require from process.cwd()
      try {
        this._require = createRequire(`file://${process.cwd()}/`);
        return this._require;
      } catch {
        throw new Error(
          '[ZaFlow] ❌ Failed to create module loader. ' +
          'Your environment may not support dynamic module loading.'
        );
      }
    }
  }

  /**
   * Dynamically require a module with a helpful error message if it's missing.
   * Works in both CJS and ESM environments.
   */
  static load<T>(moduleName: string, providerName: string): T {
    try {
      const requireFn = this.getRequire();
      const mod = requireFn(moduleName);
      
      // Handle both default exports and named exports
      // Some SDKs export default, others export named
      return mod;
    } catch (error: any) {
      // Check if it's a "module not found" error
      const isModuleNotFound = 
        error.code === 'MODULE_NOT_FOUND' || 
        error.code === 'ERR_MODULE_NOT_FOUND' ||
        error.message?.includes('Cannot find module') ||
        error.message?.includes('Module not found');
      
      if (isModuleNotFound) {
        throw new Error(
          `[ZaFlow] ❌ Module "${moduleName}" not found. ` +
          `To use the ${providerName} provider, please install it:\n` +
          `  npm install ${moduleName}\n` +
          `  pnpm add ${moduleName}\n` +
          `  yarn add ${moduleName}`
        );
      }

      // Re-throw other errors with context
      throw new Error(
        `[ZaFlow] ❌ Failed to load module "${moduleName}": ${error.message}`
      );
    }
  }

  /**
   * Async version for environments that require dynamic import
   */
  static async loadAsync<T>(moduleName: string, providerName: string): Promise<T> {
    try {
      // Try synchronous first
      return this.load<T>(moduleName, providerName);
    } catch {
      // Fallback to dynamic import for pure ESM modules
      try {
        const mod = await import(moduleName);
        return mod.default || mod;
      } catch (error: any) {
        throw new Error(
          `[ZaFlow] ❌ Module "${moduleName}" not found. ` +
          `To use the ${providerName} provider, please install it:\n` +
          `  npm install ${moduleName}\n` +
          `  pnpm add ${moduleName}\n` +
          `  yarn add ${moduleName}`
        );
      }
    }
  }
}
