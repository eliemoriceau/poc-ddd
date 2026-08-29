import { test } from '@japa/runner';
import { AddOrderLine } from '#commande/actions/add_order_line';
import { Order } from '#commande/domain/order';
import { OrderIdentifier } from '#commande/domain/order_identifier';
import { OrderService } from '#commande/domain/order_service';
import { OrderStatus } from '#commande/domain/order_status';
import type { OrderRepository } from '#commande/repositories/order_repository';
import type { TransactionManager } from '#shared/services/transaction_manager';

const orderId = '11111111-1111-4111-8111-111111111111';
const menuItemId = '22222222-2222-4222-8222-222222222222';
const tableId = '33333333-3333-4333-8333-333333333333';

function makeAction(order: Order | null, calls: { saved?: Order; loaded?: number } = {}) {
	const orders = {
		findOrderForUpdate: async () => {
			calls.loaded = (calls.loaded ?? 0) + 1;
			return order;
		},
		saveOrder: async (saved: Order) => {
			calls.saved = saved;
			return saved;
		},
	} as unknown as OrderRepository;
	const transactions = { run: <T>(callback: () => Promise<T>) => callback() } as TransactionManager;
	return new AddOrderLine(orders, transactions);
}

function makeOrder(status: OrderStatus = OrderStatus.Draft) {
	const service = OrderService.create('DineIn', tableId);

	if (!service.ok) {
		throw new Error('invalid test service');
	}
	return Order.restore({ id: OrderIdentifier.fromString(orderId), service: service.value, status, lines: [] });
}

test.group('AddOrderLine', () => {
	test('ajoute et persiste une ligne', async ({ assert }) => {
		const calls: { saved?: Order } = {};
		const result = await makeAction(makeOrder(), calls).execute({
			orderId,
			menuItemId,
			name: 'Pizza',
			quantity: 2,
			unitPriceCents: 1250,
		});

		assert.isTrue(result.ok);
		assert.equal(calls.saved?.lines[0].quantity, 2);
	});

	test('retourne un refus typé sans charger pour une entrée invalide', async ({ assert }) => {
		const calls: { loaded?: number } = {};
		const result = await makeAction(makeOrder(), calls).execute({
			orderId,
			menuItemId,
			name: '',
			quantity: 1,
			unitPriceCents: 1250,
		});
		assert.deepEqual(result, { ok: false, error: { type: 'invalid_order_line_name' } });
		assert.equal(calls.loaded ?? 0, 0);
	});

	for (const orderId of [undefined, 42, 'not-an-uuid']) {
		test(`retourne un refus typé pour orderId invalide (${String(orderId)})`, async ({ assert }) => {
			const calls: { loaded?: number } = {};
			const result = await makeAction(makeOrder(), calls).execute({
				orderId,
				menuItemId,
				name: 'Pizza',
				quantity: 1,
				unitPriceCents: 1250,
			});
			assert.deepEqual(result, { ok: false, error: { type: 'invalid_order_identifier' } });
			assert.equal(calls.loaded ?? 0, 0);
		});
	}

	for (const status of [OrderStatus.Confirmed, OrderStatus.SentToKitchen, OrderStatus.Cancelled]) {
		test(`refuse ${status} sans save ni mutation`, async ({ assert }) => {
			const order = makeOrder(status);
			const calls: { saved?: Order; loaded?: number } = {};
			const result = await makeAction(order, calls).execute({
				orderId,
				menuItemId,
				name: 'Pizza',
				quantity: 1,
				unitPriceCents: 1250,
			});
			assert.deepEqual(result, { ok: false, error: { type: 'order_not_draft' } });
			assert.isUndefined(calls.saved);
			assert.lengthOf(order.lines, 0);
		});
	}

	test('propage l’échec de save sans commit transactionnel', async ({ assert }) => {
		const order = makeOrder();
		let committed = false;
		const orders = {
			findOrderForUpdate: async () => order,
			saveOrder: async () => {
				throw new Error('database unavailable');
			},
		} as unknown as OrderRepository;
		const transactions = {
			run: async <T>(callback: () => Promise<T>) => {
				const result = await callback();
				committed = true;
				return result;
			},
		} as TransactionManager;

		await assert.rejects(
			() =>
				new AddOrderLine(orders, transactions).execute({
					orderId,
					menuItemId,
					name: 'Pizza',
					quantity: 1,
					unitPriceCents: 1250,
				}),
			'database unavailable',
		);
		assert.isFalse(committed);
		assert.lengthOf(order.lines, 1);
	});

	test('retourne un refus typé pour une commande absente', async ({ assert }) => {
		const result = await makeAction(null).execute({
			orderId,
			menuItemId,
			name: 'Pizza',
			quantity: 1,
			unitPriceCents: 1250,
		});
		assert.deepEqual(result, { ok: false, error: { type: 'order_not_found' } });
	});
});
