import { test } from '@japa/runner';
import { ConfirmOrder } from '#commande/actions/confirm_order';
import { Order } from '#commande/domain/order';
import { OrderIdentifier } from '#commande/domain/order_identifier';
import { OrderLine } from '#commande/domain/order_line';
import { OrderService } from '#commande/domain/order_service';
import { OrderStatus } from '#commande/domain/order_status';
import type { OrderRepository } from '#commande/repositories/order_repository';
import type { TransactionManager } from '#shared/services/transaction_manager';

const orderId = '11111111-1111-4111-8111-111111111111';
const menuItemId = '22222222-2222-4222-8222-222222222222';
const tableId = '33333333-3333-4333-8333-333333333333';

function makeOrder(status: OrderStatus = OrderStatus.Draft, withLine = false) {
	const service = OrderService.create('DineIn', tableId);

	if (!service.ok) {
		throw new Error('invalid test service');
	}

	const lines = withLine ? [OrderLine.create(menuItemId, 'Pizza', 1, 1250)] : [];

	if (lines.some((line) => !line.ok)) {
		throw new Error('invalid test line');
	}
	return Order.restore({
		id: OrderIdentifier.fromString(orderId),
		service: service.value,
		status,
		lines: lines
			.map((line) => (line.ok ? line.value : undefined))
			.filter((line): line is OrderLine => line !== undefined),
	});
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
	return new ConfirmOrder(orders, transactions);
}

test.group('ConfirmOrder', () => {
	test('confirme et retourne l’agrégat après sauvegarde', async ({ assert }) => {
		const calls: { saved?: Order } = {};
		const result = await makeAction(makeOrder(OrderStatus.Draft, true), calls).execute({ orderId });

		assert.isTrue(result.ok);
		assert.equal(calls.saved?.status, OrderStatus.Confirmed);

		if (result.ok) {
			assert.equal(result.value.status, calls.saved?.status);
		}
	});

	test('refuse une commande vide sans sauvegarder', async ({ assert }) => {
		const calls: { saved?: Order } = {};
		const result = await makeAction(makeOrder(), calls).execute({ orderId });

		assert.deepEqual(result, { ok: false, error: { type: 'order_empty' } });
		assert.isUndefined(calls.saved);
	});

	for (const status of [OrderStatus.Confirmed, OrderStatus.SentToKitchen, OrderStatus.Cancelled]) {
		test(`refuse ${status} sans sauvegarder`, async ({ assert }) => {
			const calls: { saved?: Order } = {};
			const result = await makeAction(makeOrder(status, true), calls).execute({ orderId });

			assert.deepEqual(result, { ok: false, error: { type: 'order_not_draft' } });
			assert.isUndefined(calls.saved);
		});
	}

	test('priorise l’état invalide sur la vacuité', async ({ assert }) => {
		const result = await makeAction(makeOrder(OrderStatus.Confirmed), {}).execute({ orderId });
		assert.deepEqual(result, { ok: false, error: { type: 'order_not_draft' } });
	});

	test('refuse un identifiant invalide sans charger', async ({ assert }) => {
		const calls: { loaded?: number } = {};
		const result = await makeAction(makeOrder(), calls).execute({ orderId: 'invalid' });

		assert.deepEqual(result, { ok: false, error: { type: 'invalid_order_identifier' } });
		assert.equal(calls.loaded ?? 0, 0);
	});

	test('retourne order_not_found pour une commande absente', async ({ assert }) => {
		const result = await makeAction(null).execute({ orderId });
		assert.deepEqual(result, { ok: false, error: { type: 'order_not_found' } });
	});

	test('ne retourne aucun agrégat si la sauvegarde échoue', async ({ assert }) => {
		const orders = {
			findOrderForUpdate: async () => makeOrder(OrderStatus.Draft, true),
			saveOrder: async () => {
				throw new Error('database unavailable');
			},
		} as unknown as OrderRepository;
		const transactions = { run: <T>(callback: () => Promise<T>) => callback() } as TransactionManager;

		await assert.rejects(() => new ConfirmOrder(orders, transactions).execute({ orderId }), 'database unavailable');
	});
});
