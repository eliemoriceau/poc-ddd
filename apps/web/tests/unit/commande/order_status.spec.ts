import { test } from '@japa/runner';
import { OrderStatus, parseOrderStatus } from '#commande/domain/order_status';

test.group('OrderStatus', () => {
	test('parse tous les statuts persistables', ({ assert }) => {
		for (const status of Object.values(OrderStatus)) {
			assert.equal(parseOrderStatus(status), status);
		}
	});

	test('refuse un statut persistant inconnu', ({ assert }) => {
		assert.isNull(parseOrderStatus('Unknown'));
	});
});
