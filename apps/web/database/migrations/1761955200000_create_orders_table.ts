import { sql, type Kysely } from 'kysely';

export async function up(db: Kysely<unknown>) {
	await db.schema
		.createTable('orders')
		.addColumn('id', 'uuid', (column) => column.primaryKey())
		.addColumn('service_type', 'text', (column) => column.notNull())
		.addColumn('table_id', 'uuid')
		.addColumn('status', 'text', (column) => column.notNull())
		.addCheckConstraint('orders_service_type_check', sql`service_type in ('DineIn', 'Takeaway')`)
		.addCheckConstraint(
			'orders_service_table_check',
			sql`(service_type = 'DineIn' and table_id is not null) or (service_type = 'Takeaway' and table_id is null)`,
		)
		.addCheckConstraint('orders_status_check', sql`status in ('Draft', 'Confirmed', 'SentToKitchen', 'Cancelled')`)
		.execute();
}

export async function down(db: Kysely<unknown>) {
	await db.schema.dropTable('orders').execute();
}
