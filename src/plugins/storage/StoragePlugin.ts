import type { StorageDefinition, StoragePlugin } from '../../types/storage';

/**
 * Define a custom storage plugin
 */
export function defineStorage(definition: StorageDefinition): StoragePlugin {
  return {
    name: definition.name,
    ...definition.adapter,
  };
}
