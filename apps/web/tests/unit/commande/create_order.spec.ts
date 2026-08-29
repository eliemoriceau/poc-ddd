import { test } from '@japa/runner';
import { CreateOrder, type CreateOrderParams } from '#commande/actions/create_order';
import { Order } from '#commande/domain/order';
import { OrderStatus } from '#commande/domain/order_status';
import type { OrderRepository } from '#commande/repositories/order_repository';
import type { TransactionManager } from '#shared/services/transaction_manager';

function makeAction(receivedOrder?: (order: Order) => void, transactions: Partial<TransactionManager> = {}) {
	const orders = {
		createOrder(order: Order) {
			receivedOrder?.(order);
			return Promise.resolve(order);
		},
	} as OrderRepository;

	return new CreateOrder(orders, {
		run<T>(callback: () => Promise<T>) {
			return transactions.run ? transactions.run(callback) : callback();
		},
	} as TransactionManager);
}

const tableId = '11111111-1111-4111-8111-111111111111';

test.group('CreateOrder', () => {
	test('crée une commande DineIn Draft avec sa table', async ({ assert }) => {
		let received: Order | undefined;
		const action = makeAction((payload) => (received = payload));

		const result = await action.execute({ serviceType: 'DineIn', tableId });

		assert.isTrue(result.ok);

		if (!result.ok) {
			return;
		}
		assert.match(result.value.id, /^[0-9a-f-]{36}$/iu);
		assert.equal(result.value.serviceType, 'DineIn');
		assert.equal(result.value.tableId, tableId);
		assert.equal(result.value.status, OrderStatus.Draft);
		assert.equal(received?.tableId, tableId);
		assert.equal(received?.status, OrderStatus.Draft);
	});

	test('crée une commande Takeaway sans table', async ({ assert }) => {
		const action = makeAction();

		const result = await action.execute({ serviceType: 'Takeaway' });

		assert.isTrue(result.ok);

		if (!result.ok) {
			return;
		}
		assert.equal(result.value.serviceType, 'Takeaway');
		assert.isNull(result.value.tableId);
		assert.equal(result.value.status, OrderStatus.Draft);
	});

	const invalidCases: Array<[string, CreateOrderParams, string]> = [
		['refuse un service inconnu', { serviceType: 'Delivery' }, 'invalid_service_type'],
		['refuse DineIn sans table', { serviceType: 'DineIn' }, 'table_required_for_dine_in'],
		['refuse Takeaway avec table', { serviceType: 'Takeaway', tableId }, 'table_forbidden_for_takeaway'],
		['refuse un identifiant de table invalide', { serviceType: 'DineIn', tableId: 'not-a-uuid' }, 'invalid_table_id'],
		['refuse un identifiant de table vide', { serviceType: 'DineIn', tableId: '' }, 'invalid_table_id'],
		['refuse un identifiant de table non textuel', { serviceType: 'DineIn', tableId: 42 }, 'invalid_table_id'],
	];

	for (const [description, params, errorType] of invalidCases) {
		test(description, async ({ assert }) => {
			let repositoryCalled = false;
			const action = makeAction(() => (repositoryCalled = true));

			const result = await action.execute(params);

			assert.deepEqual(result, { ok: false, error: { type: errorType } });
			assert.isFalse(repositoryCalled);
		});
	}

	test('persiste dans la transaction et propage une erreur de persistance', async ({ assert }) => {
		let transactionStarted = false;
		const action = makeAction(undefined, {
			run(callback) {
				transactionStarted = true;
				return callback().then(() => {
					throw new Error('database unavailable');
				});
			},
		});

		await assert.rejects(() => action.execute({ serviceType: 'Takeaway' }), 'database unavailable');
		assert.isTrue(transactionStarted);
	});
});
