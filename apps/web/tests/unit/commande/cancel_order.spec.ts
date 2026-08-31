import { test } from '@japa/runner';
import { CancelOrder } from '#commande/actions/cancel_order';
import { Order } from '#commande/domain/order';
import { OrderIdentifier } from '#commande/domain/order_identifier';
import { OrderService } from '#commande/domain/order_service';
import { OrderStatus } from '#commande/domain/order_status';
import type { OrderRepository } from '#commande/repositories/order_repository';
import type { TransactionManager } from '#shared/services/transaction_manager';

const orderId = '11111111-1111-4111-8111-111111111111';
const tableId = '22222222-2222-4222-8222-222222222222';

function makeOrder(status: OrderStatus) {
	const service = OrderService.create('DineIn', tableId);

	if (!service.ok) {
		throw new Error('invalid test service');
	}

	return Order.restore({ id: OrderIdentifier.fromString(orderId), service: service.value, status, lines: [] });
}

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

	return new CancelOrder(orders, transactions);
}

test.group('CancelOrder', () => {
	for (const status of [OrderStatus.Draft, OrderStatus.Confirmed]) {
		test(`annule et persiste une commande ${status}`, async ({ assert }) => {
			const calls: { saved?: Order } = {};
			const result = await makeAction(makeOrder(status), calls).execute({ orderId });

			assert.isTrue(result.ok);

			if (!result.ok) {
				return;
			}

			assert.equal(result.value.status, OrderStatus.Cancelled);
			assert.equal(calls.saved?.status, OrderStatus.Cancelled);
		});
	}

	test('réussit sans sauvegarder une commande déjà annulée', async ({ assert }) => {
		const calls: { saved?: Order } = {};
		const result = await makeAction(makeOrder(OrderStatus.Cancelled), calls).execute({ orderId });

		assert.isTrue(result.ok);

		if (!result.ok) {
			return;
		}

		assert.equal(result.value.status, OrderStatus.Cancelled);
		assert.isUndefined(calls.saved);
	});

	test('refuse SentToKitchen sans sauvegarder', async ({ assert }) => {
		const calls: { saved?: Order } = {};
		const result = await makeAction(makeOrder(OrderStatus.SentToKitchen), calls).execute({ orderId });

		assert.deepEqual(result, { ok: false, error: { type: 'order_not_cancellable' } });
		assert.isUndefined(calls.saved);
	});

	test('retourne une erreur pour une commande absente', async ({ assert }) => {
		const result = await makeAction(null).execute({ orderId });

		assert.deepEqual(result, { ok: false, error: { type: 'order_not_found' } });
	});

	for (const invalidOrderId of [undefined, 42, 'not-an-uuid']) {
		test(`refuse un identifiant invalide (${String(invalidOrderId)})`, async ({ assert }) => {
			const calls: { loaded?: number } = {};
			const result = await makeAction(makeOrder(OrderStatus.Draft), calls).execute({ orderId: invalidOrderId });

			assert.deepEqual(result, { ok: false, error: { type: 'invalid_order_identifier' } });
			assert.equal(calls.loaded ?? 0, 0);
		});
	}

	test('propage une erreur de persistance sans résultat partiel', async ({ assert }) => {
		const order = makeOrder(OrderStatus.Draft);
		const orders = {
			findOrderForUpdate: async () => order,
			saveOrder: async () => {
				throw new Error('database unavailable');
			},
		} as unknown as OrderRepository;
		const transactions = { run: <T>(callback: () => Promise<T>) => callback() } as TransactionManager;

		await assert.rejects(() => new CancelOrder(orders, transactions).execute({ orderId }), 'database unavailable');
		assert.equal(order.status, OrderStatus.Cancelled);
	});
});
