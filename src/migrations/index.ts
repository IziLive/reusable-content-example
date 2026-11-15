import * as migration_20261115_052001_migration from './20261115_052001_migration';

export const migrations = [
  {
    up: migration_20261115_052001_migration.up,
    down: migration_20261115_052001_migration.down,
    name: '20261115_052001_migration'
  },
];
