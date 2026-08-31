import { test } from '@japa/runner';
import { Order } from '#commande/domain/order';
import { OrderIdentifier } from '#commande/domain/order_identifier';
import { OrderLine } from '#commande/domain/order_line';
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

	test('refuse plusieurs lignes pour le même menuItemId', ({ assert }) => {
		const service = OrderService.create('DineIn', tableId);

		if (!service.ok) {
			return;
		}

		assert.throws(
			() =>
				Order.restore({
					id: OrderIdentifier.generate(),
					service: service.value,
					status: OrderStatus.Draft,
					lines: [makeLine('Pizza', 1, 1250), makeLine('Pizza bis', 2, 1500)],
				}),
			'Duplicate menu item in order lines',
		);
	});

	test('refuse les quantités invalides ajoutées sans mutation', ({ assert }) => {
		const order = makeOrder();
		order.addLine(makeLine('Pizza', 1, 1250));
		const invalidLine = OrderLine.create(menuItemId, 'Pizza', 1, 1250);

		if (!invalidLine.ok) {
			throw new Error('invalid test line');
		}

		for (const quantity of [0, -1, 1.5, Number.MAX_SAFE_INTEGER + 1]) {
			const result = invalidLine.value.addQuantity(quantity);
			assert.deepEqual(result, { ok: false, error: { type: 'invalid_order_line_quantity' } });
		}

		assert.equal(order.lines[0].quantity, 1);
	});

	test('refuse le dépassement d’un entier sûr sans mutation', ({ assert }) => {
		const order = makeOrder();
		order.addLine(makeLine('Pizza', Number.MAX_SAFE_INTEGER, 1250));
		const result = order.addLine(makeLine('Pizza', 1, 1250));

		assert.deepEqual(result, { ok: false, error: { type: 'order_line_quantity_overflow' } });
		assert.equal(order.lines[0].quantity, Number.MAX_SAFE_INTEGER);
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

test.group('Order.confirm', () => {
	test('confirme une commande Draft non vide', ({ assert }) => {
		const order = makeOrder(OrderStatus.Draft, [makeLine('Pizza', 1, 1250)]);

		const result = order.confirm();

		assert.deepEqual(result, { ok: true, value: undefined });
		assert.equal(order.status, OrderStatus.Confirmed);
		assert.equal(order.lines[0].name, 'Pizza');
	});

	test('refuse une commande Draft vide', ({ assert }) => {
		const order = makeOrder();

		assert.deepEqual(order.confirm(), { ok: false, error: { type: 'order_empty' } });
		assert.equal(order.status, OrderStatus.Draft);
	});

	for (const status of [OrderStatus.Confirmed, OrderStatus.SentToKitchen, OrderStatus.Cancelled]) {
		test(`priorise l’état ${status} pour une commande vide`, ({ assert }) => {
			const order = makeOrder(status);

			assert.deepEqual(order.confirm(), { ok: false, error: { type: 'order_not_draft' } });
			assert.equal(order.status, status);
		});
	}
});
