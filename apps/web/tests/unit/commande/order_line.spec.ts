import { test } from '@japa/runner';
import { MenuItemIdentifier } from '#commande/domain/menu_item_identifier';
import { OrderLine } from '#commande/domain/order_line';
import { Price } from '#commande/domain/price';

const menuItemId = '22222222-2222-4222-8222-222222222222';

test.group('OrderLine', () => {
	test('valide et expose les valeurs capturées', ({ assert }) => {
		const result = OrderLine.create(menuItemId, 'Pizza', 2, 1250);

		assert.isTrue(result.ok);

		if (!result.ok) {
			return;
		}

		assert.equal(result.value.menuItemId, menuItemId);
		assert.equal(result.value.name, 'Pizza');
		assert.equal(result.value.quantity, 2);
		assert.equal(result.value.unitPriceCents, 1250);
	});

	const invalidCases: Array<[string, unknown, unknown, unknown, unknown, string]> = [
		['refuse un identifiant absent', undefined, 'Pizza', 1, 100, 'invalid_menu_item_identifier'],
		['refuse un nom absent', menuItemId, '', 1, 100, 'invalid_order_line_name'],
		['refuse une quantité nulle', menuItemId, 'Pizza', 0, 100, 'invalid_order_line_quantity'],
		['refuse une quantité décimale', menuItemId, 'Pizza', 1.5, 100, 'invalid_order_line_quantity'],
		['refuse un prix négatif', menuItemId, 'Pizza', 1, -1, 'invalid_price'],
		['refuse un prix décimal', menuItemId, 'Pizza', 1, 1.5, 'invalid_price'],
	];

	for (const [description, id, name, quantity, price, errorType] of invalidCases) {
		test(description, ({ assert }) => {
			const result = OrderLine.create(id, name, quantity, price);
			assert.deepEqual(result, { ok: false, error: { type: errorType } });
		});
	}

	test('ne modifie pas le prix métier avec des flottants', ({ assert }) => {
		const price = Price.create(0);
		const identifier = MenuItemIdentifier.create(menuItemId);
		assert.isTrue(price.ok);
		assert.isTrue(identifier.ok);
	});
});
