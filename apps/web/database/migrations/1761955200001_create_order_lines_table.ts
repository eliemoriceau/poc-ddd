import { sql, type Kysely } from 'kysely';
import type { DB } from '#types/db';

export async function up(db: Kysely<DB>) {
	await db.schema
		.createTable('order_lines')
		.addColumn('order_id', 'uuid', (column) => column.notNull().references('orders.id').onDelete('cascade'))
		.addColumn('menu_item_id', 'uuid', (column) => column.notNull())
		.addColumn('name', 'text', (column) => column.notNull())
		.addColumn('quantity', 'integer', (column) => column.notNull())
		.addColumn('unit_price_cents', 'integer', (column) => column.notNull())
		.addPrimaryKeyConstraint('order_lines_pkey', ['order_id', 'menu_item_id'])
		.addCheckConstraint('order_lines_quantity_check', sql`quantity > 0`)
		.addCheckConstraint('order_lines_price_check', sql`unit_price_cents >= 0`)
		.addCheckConstraint('order_lines_name_check', sql`length(btrim(name)) > 0`)
		.execute();
}

export async function down(db: Kysely<DB>) {
	await db.schema.dropTable('order_lines').execute();
}
