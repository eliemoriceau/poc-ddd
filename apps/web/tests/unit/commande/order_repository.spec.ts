import { test } from '@japa/runner';
import { Order } from '#commande/domain/order';
import { OrderIdentifier } from '#commande/domain/order_identifier';
import { OrderService } from '#commande/domain/order_service';
import { OrderStatus } from '#commande/domain/order_status';
import { OrderRepository } from '#commande/repositories/order_repository';

test('utilise le schéma public par défaut pour la persistance de Order', async ({ assert }) => {
	const schemas: string[] = [];
	const service = OrderService.create('Takeaway', null);

	if (!service.ok) {
		assert.fail('Le service Takeaway doit être valide');
		return;
	}

	const order = Order.createDraft(OrderIdentifier.generate(), service.value);
	const record = {
		id: order.id,
		service_type: order.serviceType,
		table_id: order.tableId,
		status: order.status,
	};
	const database = {
		withSchema(schema: string) {
			schemas.push(schema);
			return {
				insertInto() {
					return {
						values() {
							return {
								returning() {
									return { executeTakeFirstOrThrow: async () => record };
								},
							};
						},
					};
				},
				updateTable() {
					return {
						set() {
							return {
								where() {
									return { executeTakeFirstOrThrow: async () => ({ numUpdatedRows: 1n }) };
								},
							};
						},
					};
				},
			};
		},
	};
	const transactions = { currentDatabase: () => database };

	await new OrderRepository(transactions as never).createOrder(order);

	assert.deepEqual(schemas, ['public']);
	assert.equal(order.status, OrderStatus.Draft);
});

test('ne tente pas values([]) pour un agrégat sans lignes', async ({ assert }) => {
	const service = OrderService.create('Takeaway', null);

	if (!service.ok) {
		assert.fail('Le service Takeaway doit être valide');
		return;
	}

	const order = Order.createDraft(OrderIdentifier.generate(), service.value);
	let inserted = false;
	const transactions = {
		currentDatabase() {
			return {
				withSchema() {
					return {
						deleteFrom() {
							return {
								where() {
									return { execute: async () => undefined };
								},
							};
						},
						insertInto() {
							inserted = true;
							throw new Error('values([]) interdit');
						},
						updateTable() {
							return {
								set() {
									return {
										where() {
											return { executeTakeFirstOrThrow: async () => ({ numUpdatedRows: 1n }) };
										},
									};
								},
							};
						},
					};
				},
			};
		},
	};

	const saved = await new OrderRepository(transactions as never).saveOrder(order);
	assert.isTrue(saved.equals(order));
	assert.isFalse(inserted);
});

test('convertit les colonnes bigint string et bigint en nombres sûrs', async ({ assert }) => {
	const records = [
		{ menu_item_id: '22222222-2222-4222-8222-222222222222', name: 'Pizza', quantity: '2', unit_price_cents: '1250' },
		{ menu_item_id: '33333333-3333-4333-8333-333333333333', name: 'Pâtes', quantity: 3n, unit_price_cents: 1500n },
	];
	const database = {
		withSchema() {
			return {
				selectFrom(table: string) {
					return {
						select() {
							return {
								$if() {
									return this;
								},
								where() {
									return {
										$if() {
											return this;
										},
										executeTakeFirst: async () =>
											table === 'orders'
												? {
														id: '11111111-1111-4111-8111-111111111111',
														service_type: 'Takeaway',
														table_id: null,
														status: 'Draft',
													}
												: undefined,
										execute: async () => (table === 'order_lines' ? records : []),
									};
								},
							};
						},
						updateTable() {
							return {
								set() {
									return {
										where() {
											return { executeTakeFirstOrThrow: async () => ({ numUpdatedRows: 1n }) };
										},
									};
								},
							};
						},
					};
				},
			};
		},
	};

	const order = await new OrderRepository({ currentDatabase: () => database } as never).findOrderById(
		OrderIdentifier.fromString('11111111-1111-4111-8111-111111111111'),
	);
	assert.deepEqual(
		order?.lines.map((line) => ({ quantity: line.quantity, price: line.unitPriceCents })),
		[
			{ quantity: 2, price: 1250 },
			{ quantity: 3, price: 1500 },
		],
	);

	records[0].unit_price_cents = '9007199254740992';
	await assert.rejects(
		() =>
			new OrderRepository({ currentDatabase: () => database } as never).findOrderById(
				OrderIdentifier.fromString('11111111-1111-4111-8111-111111111111'),
			),
		'Invalid unit_price_cents persisted',
	);
});
