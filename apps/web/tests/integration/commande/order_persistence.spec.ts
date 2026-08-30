import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { test } from '@japa/runner';
import { sql } from 'kysely';
import { AddOrderLine } from '#commande/actions/add_order_line';
import { CreateOrder } from '#commande/actions/create_order';
import { OrderStatus } from '#commande/domain/order_status';
import { OrderRepository } from '#commande/repositories/order_repository';
import { up } from '#database/migrations/1761955200000_create_orders_table';
import { up as upOrderLines } from '#database/migrations/1761955200001_create_order_lines_table';
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

async function assertConstraintViolation(
	assert: Assert,
	query: () => Promise<unknown>,
	constraint: string,
	code = '23514',
) {
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

	assert.equal(error.code, code);
	assert.equal(error.constraint_name, constraint);
}

test.group('Persistance PostgreSQL de Order', (group) => {
	group.setup(async () => {
		await db.schema.dropSchema(testSchema).ifExists().cascade().execute();
		await db.schema.createSchema(testSchema).execute();
		await up(db.withSchema(testSchema));
		await upOrderLines(db.withSchema(testSchema));
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

	test('ajoute, recharge et fusionne les lignes', async ({ assert }) => {
		const orders = new OrderRepository(new TransactionManager(), testSchema);
		const create = new CreateOrder(orders, new TransactionManager());
		const created = await create.execute({ serviceType: 'Takeaway' });
		assert.isTrue(created.ok);

		if (!created.ok) {
			return;
		}

		const add = new AddOrderLine(orders, new TransactionManager());
		assert.isTrue(
			(
				await add.execute({
					orderId: created.value.id,
					menuItemId: tableId,
					name: 'Pizza',
					quantity: 2,
					unitPriceCents: 2_147_483_648,
				})
			).ok,
		);
		assert.isTrue(
			(
				await add.execute({
					orderId: created.value.id,
					menuItemId: tableId,
					name: 'Nom modifié',
					quantity: 3,
					unitPriceCents: 999,
				})
			).ok,
		);

		const reloaded = await orders.findOrderById(created.value.getIdentifier());
		assert.lengthOf(reloaded?.lines ?? [], 1);
		assert.equal(reloaded?.lines[0].quantity, 5);
		assert.equal(reloaded?.lines[0].name, 'Pizza');
		assert.equal(reloaded?.lines[0].unitPriceCents, 2_147_483_648);
	});

	test('additionne deux ajouts concurrents sans perte', async ({ assert }) => {
		const orders = new OrderRepository(new TransactionManager(), testSchema);
		const create = new CreateOrder(orders, new TransactionManager());
		const created = await create.execute({ serviceType: 'Takeaway' });
		assert.isTrue(created.ok);

		if (!created.ok) {
			return;
		}

		const add = new AddOrderLine(orders, new TransactionManager());
		const results = await Promise.all([
			add.execute({ orderId: created.value.id, menuItemId: tableId, name: 'Pizza', quantity: 2, unitPriceCents: 1250 }),
			add.execute({ orderId: created.value.id, menuItemId: tableId, name: 'Pizza', quantity: 3, unitPriceCents: 1250 }),
		]);
		assert.isTrue(results.every((result) => result.ok));

		const reloaded = await orders.findOrderById(created.value.getIdentifier());
		assert.equal(reloaded?.lines[0].quantity, 5);
	});

	test('annule toute la transaction quand la persistance échoue', async ({ assert }) => {
		const orders = new OrderRepository(new TransactionManager(), testSchema);
		const create = new CreateOrder(orders, new TransactionManager());
		const created = await create.execute({ serviceType: 'Takeaway' });
		assert.isTrue(created.ok);

		if (!created.ok) {
			return;
		}

		await sql
			.raw(
				`CREATE FUNCTION "${testSchema}".fail_order_line_insert() RETURNS trigger LANGUAGE plpgsql AS 'BEGIN RAISE EXCEPTION ''forced persistence failure''; END;'`,
			)
			.execute(db);
		await sql
			.raw(
				`CREATE TRIGGER fail_order_line_insert BEFORE INSERT ON "${testSchema}".order_lines FOR EACH ROW EXECUTE FUNCTION "${testSchema}".fail_order_line_insert()`,
			)
			.execute(db);

		const add = new AddOrderLine(orders, new TransactionManager());
		await assert.rejects(
			() =>
				add.execute({
					orderId: created.value.id,
					menuItemId: tableId,
					name: 'Pizza',
					quantity: 1,
					unitPriceCents: 1250,
				}),
			'forced persistence failure',
		);

		const persistedLines = await db
			.withSchema(testSchema)
			.selectFrom('order_lines')
			.select('order_id')
			.where('order_id', '=', created.value.id)
			.execute();
		assert.lengthOf(persistedLines, 0);
		await sql.raw(`DROP TRIGGER fail_order_line_insert ON "${testSchema}".order_lines`).execute(db);
		await sql.raw(`DROP FUNCTION "${testSchema}".fail_order_line_insert()`).execute(db);
	});

	test('protège l’unicité, la quantité et le prix des lignes', async ({ assert }) => {
		const orderId = randomUUID();
		await db
			.withSchema(testSchema)
			.insertInto('orders')
			.values({ id: orderId, service_type: 'Takeaway', table_id: null, status: OrderStatus.Draft })
			.execute();
		await db
			.withSchema(testSchema)
			.insertInto('order_lines')
			.values({ order_id: orderId, menu_item_id: tableId, name: 'Pizza', quantity: 1, unit_price_cents: 0 })
			.execute();

		await assertConstraintViolation(
			assert,
			() =>
				db
					.withSchema(testSchema)
					.insertInto('order_lines')
					.values({ order_id: orderId, menu_item_id: tableId, name: 'Pizza', quantity: 1, unit_price_cents: 0 })
					.execute(),
			'order_lines_pkey',
			'23505',
		);
		await assertConstraintViolation(
			assert,
			() =>
				db
					.withSchema(testSchema)
					.insertInto('order_lines')
					.values({ order_id: orderId, menu_item_id: randomUUID(), name: 'Pizza', quantity: 0, unit_price_cents: 0 })
					.execute(),
			'order_lines_quantity_check',
		);
		await assertConstraintViolation(
			assert,
			() =>
				db
					.withSchema(testSchema)
					.insertInto('order_lines')
					.values({ order_id: orderId, menu_item_id: randomUUID(), name: 'Pizza', quantity: 1, unit_price_cents: -1 })
					.execute(),
			'order_lines_price_check',
		);
		await assertConstraintViolation(
			assert,
			() =>
				db
					.withSchema(testSchema)
					.insertInto('order_lines')
					.values({ order_id: orderId, menu_item_id: randomUUID(), name: '   ', quantity: 1, unit_price_cents: 0 })
					.execute(),
			'order_lines_name_check',
		);

		const cascadeOrderId = randomUUID();
		await db
			.withSchema(testSchema)
			.insertInto('orders')
			.values({ id: cascadeOrderId, service_type: 'Takeaway', table_id: null, status: OrderStatus.Draft })
			.execute();
		await db
			.withSchema(testSchema)
			.insertInto('order_lines')
			.values({ order_id: cascadeOrderId, menu_item_id: randomUUID(), name: 'Pizza', quantity: 1, unit_price_cents: 0 })
			.execute();
		await db.withSchema(testSchema).deleteFrom('orders').where('id', '=', cascadeOrderId).execute();
		const cascadedLines = await db
			.withSchema(testSchema)
			.selectFrom('order_lines')
			.select('order_id')
			.where('order_id', '=', cascadeOrderId)
			.execute();
		assert.lengthOf(cascadedLines, 0);
	});
});
