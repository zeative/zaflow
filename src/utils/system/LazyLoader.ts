import { createRequire } from 'module';

export class LazyLoader {
  private static _require: NodeRequire | null = null;

  private static getRequire(): NodeRequire {
    if (this._require) return this._require;

    if (typeof require !== 'undefined') {
      this._require = require;
      return this._require;
    }

    try {
      this._require = createRequire(import.meta.url);
      return this._require;
    } catch {
      try {
        this._require = createRequire(`file://${process.cwd()}/`);
        return this._require;
      } catch {
        throw new Error(
          '[ZaFlow] Failed to create module loader. ' +
          'Your environment may not support dynamic module loading.'
        );
      }
    }
  }

  static load<T>(moduleName: string, providerName: string): T {
    try {
      const requireFn = this.getRequire();
      const mod = requireFn(moduleName);
      
      return mod;
    } catch (error: any) {
      const isModuleNotFound = 
        error.code === 'MODULE_NOT_FOUND' || 
        error.code === 'ERR_MODULE_NOT_FOUND' ||
        error.message?.includes('Cannot find module') ||
        error.message?.includes('Module not found');
      
      if (isModuleNotFound) {
        throw new Error(
          `[ZaFlow] Module "${moduleName}" not found. ` +
          `To use the ${providerName} provider, please install it:\n` +
          `  npm install ${moduleName}\n` +
          `  pnpm add ${moduleName}\n` +
          `  yarn add ${moduleName}`
        );
      }

      throw new Error(
        `[ZaFlow] Failed to load module "${moduleName}": ${error.message}`
      );
    }
  }

  static async loadAsync<T>(moduleName: string, providerName: string): Promise<T> {
    try {
      return this.load<T>(moduleName, providerName);
    } catch {
      try {
        const mod = await import(moduleName);
        return mod.default || mod;
      } catch (error: any) {
        throw new Error(
          `[ZaFlow] Module "${moduleName}" not found. ` +
          `To use the ${providerName} provider, please install it:\n` +
          `  npm install ${moduleName}\n` +
          `  pnpm add ${moduleName}\n` +
          `  yarn add ${moduleName}`
        );
      }
    }
  }
}
