import { test } from '@japa/runner';
import { Order } from '#commande/domain/order';
import { OrderIdentifier } from '#commande/domain/order_identifier';
import { MAX_POSTGRES_INTEGER, OrderLine } from '#commande/domain/order_line';
import { OrderService } from '#commande/domain/order_service';
import { OrderStatus } from '#commande/domain/order_status';

const tableId = '11111111-1111-4111-8111-111111111111';
const menuItemId = '22222222-2222-4222-8222-222222222222';

function makeOrder(status: OrderStatus = OrderStatus.Draft, lines: OrderLine[] = []) {
	const service = OrderService.create('DineIn', tableId);

	if (!service.ok) {
		throw new Error('invalid test service');
	}
	return Order.restore({ id: OrderIdentifier.generate(), service: service.value, status, lines });
}

function makeLine(name: string, quantity: number, price: number) {
	const result = OrderLine.create(menuItemId, name, quantity, price);

	if (!result.ok) {
		throw new Error('invalid test line');
	}
	return result.value;
}

test.group('Order.addLine', () => {
	test('ajoute une ligne à une commande Draft', ({ assert }) => {
		const order = makeOrder();
		const result = order.addLine(makeLine('Pizza', 2, 1250));

		assert.isTrue(result.ok);
		assert.deepEqual(
			order.lines.map((line) => ({
				menuItemId: line.menuItemId,
				name: line.name,
				quantity: line.quantity,
				price: line.unitPriceCents,
			})),
			[{ menuItemId, name: 'Pizza', quantity: 2, price: 1250 }],
		);
	});

	test('fusionne par menuItemId et conserve le premier nom/prix', ({ assert }) => {
		const order = makeOrder();
		order.addLine(makeLine('Pizza originale', 2, 1250));
		const result = order.addLine(makeLine('Autre nom', 3, 1500));

		assert.isTrue(result.ok);
		assert.lengthOf(order.lines, 1);
		assert.equal(order.lines[0].quantity, 5);
		assert.equal(order.lines[0].name, 'Pizza originale');
		assert.equal(order.lines[0].unitPriceCents, 1250);
	});

	test('copie défensivement les lignes restaurées', ({ assert }) => {
		const lines = [makeLine('Pizza', 1, 1250)];
		const restored = makeOrder(OrderStatus.Draft, lines);

		lines.push(makeLine('Pâtes', 1, 900));
		assert.lengthOf(restored.lines, 1);
	});

	test('refuse le dépassement de la capacité integer PostgreSQL sans mutation', ({ assert }) => {
		const order = makeOrder();
		order.addLine(makeLine('Pizza', MAX_POSTGRES_INTEGER, 1250));
		const result = order.addLine(makeLine('Pizza', 1, 1250));

		assert.deepEqual(result, { ok: false, error: { type: 'order_line_quantity_overflow' } });
		assert.equal(order.lines[0].quantity, MAX_POSTGRES_INTEGER);
	});

	for (const status of [OrderStatus.Confirmed, OrderStatus.SentToKitchen, OrderStatus.Cancelled]) {
		test(`refuse l'ajout pour ${status}`, ({ assert }) => {
			const order = makeOrder(status);
			const result = order.addLine(makeLine('Pizza', 1, 1250));
			assert.deepEqual(result, { ok: false, error: { type: 'order_not_draft' } });
			assert.lengthOf(order.lines, 0);
		});
	}
});
