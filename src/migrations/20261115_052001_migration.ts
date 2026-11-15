import {
  MigrateDownArgs,
  MigrateUpArgs,
} from '@payloadcms/db-mongodb'
import { migrateSizesToVariants } from '@payloadcms/db-mongodb/migration-utils'
export async function up({ payload, req, session }: MigrateUpArgs): Promise<void> {
  await migrateSizesToVariants({ payload, req })

}

export async function down({ payload, req, session }: MigrateDownArgs): Promise<void> {
  await migrateSizesToVariants({ direction: 'down', payload, req })

}
