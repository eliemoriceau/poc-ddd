import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { test } from '@japa/runner';
import { CreateOrder } from '#commande/actions/create_order';
import { OrderStatus } from '#commande/domain/order_status';
import { OrderRepository } from '#commande/repositories/order_repository';
import { up } from '#database/migrations/1761955200000_create_orders_table';
import { db } from '#shared/services/db';
import { TransactionManager } from '#shared/services/transaction_manager';
import type { Assert } from '@japa/assert';

const tableId = '11111111-1111-4111-8111-111111111111';
const testSchema = `order_persistence_test_${process.pid}_${randomUUID().replaceAll('-', '')}`;

function isPostgresConstraintError(error: unknown): error is { code: string; constraint_name: string } {
	return (
		typeof error === 'object' &&
		error !== null &&
		'code' in error &&
		typeof error.code === 'string' &&
		'constraint_name' in error &&
		typeof error.constraint_name === 'string'
	);
}

async function assertConstraintViolation(assert: Assert, query: () => Promise<unknown>, constraint: string) {
	let error: unknown;

	try {
		await query();
	} catch (caught) {
		error = caught;
	}

	if (!error) {
		assert.fail(`Expected PostgreSQL constraint ${constraint} to reject the query`);
	}

	if (!isPostgresConstraintError(error)) {
		assert.fail(`Expected PostgreSQL constraint error for ${constraint}`);
	}

	assert.equal(error.code, '23514');
	assert.equal(error.constraint_name, constraint);
}

test.group('Persistance PostgreSQL de Order', (group) => {
	group.setup(async () => {
		await db.schema.dropSchema(testSchema).ifExists().cascade().execute();
		await db.schema.createSchema(testSchema).execute();
		await up(db.withSchema(testSchema));
	});

	group.teardown(async () => {
		await db.schema.dropSchema(testSchema).ifExists().cascade().execute();
	});

	test('crée et recharge les deux services avec leur état Draft', async ({ assert }) => {
		const orders = new OrderRepository(new TransactionManager(), testSchema);
		const action = new CreateOrder(orders, new TransactionManager());

		const dineIn = await action.execute({ serviceType: 'DineIn', tableId });
		const takeaway = await action.execute({ serviceType: 'Takeaway' });

		assert.isTrue(dineIn.ok);
		assert.isTrue(takeaway.ok);

		if (!dineIn.ok || !takeaway.ok) {
			return;
		}

		const reloadedDineIn = await orders.findOrderById(dineIn.value.getIdentifier());
		const reloadedTakeaway = await orders.findOrderById(takeaway.value.getIdentifier());

		assert.equal(reloadedDineIn?.id, dineIn.value.id);
		assert.equal(reloadedDineIn?.serviceType, 'DineIn');
		assert.equal(reloadedDineIn?.tableId, tableId);
		assert.equal(reloadedDineIn?.status, OrderStatus.Draft);
		assert.equal(reloadedTakeaway?.id, takeaway.value.id);
		assert.equal(reloadedTakeaway?.serviceType, 'Takeaway');
		assert.isNull(reloadedTakeaway?.tableId);
		assert.equal(reloadedTakeaway?.status, OrderStatus.Draft);
	});

	test('applique les contraintes service/table et statut', async ({ assert }) => {
		await assertConstraintViolation(
			assert,
			() =>
				db
					.withSchema(testSchema)
					.insertInto('orders')
					.values({ id: randomUUID(), service_type: 'DineIn', table_id: null, status: OrderStatus.Draft })
					.execute(),
			'orders_service_table_check',
		);
		await assertConstraintViolation(
			assert,
			() =>
				db
					.withSchema(testSchema)
					.insertInto('orders')
					.values({ id: randomUUID(), service_type: 'Takeaway', table_id: tableId, status: OrderStatus.Draft })
					.execute(),
			'orders_service_table_check',
		);
		await assertConstraintViolation(
			assert,
			() =>
				db
					.withSchema(testSchema)
					.insertInto('orders')
					.values({ id: randomUUID(), service_type: 'Takeaway', table_id: null, status: 'Unknown' })
					.execute(),
			'orders_status_check',
		);
	});

	test('garantit la cohérence des statuts TypeScript et SQL', async ({ assert }) => {
		const migration = await readFile(
			new URL('../../../database/migrations/1761955200000_create_orders_table.ts', import.meta.url),
			'utf8',
		);
		const constraint = migration.match(/orders_status_check[\s\S]*?status in \(([^)]+)\)/u)?.[1];
		const sqlStatuses = constraint?.match(/'([^']+)'/gu)?.map((value) => value.slice(1, -1));

		assert.deepEqual(sqlStatuses?.sort(), Object.values(OrderStatus).sort());
	});
});
