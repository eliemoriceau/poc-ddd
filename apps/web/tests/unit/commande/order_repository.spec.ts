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
			};
		},
	};
	const transactions = { currentDatabase: () => database };

	await new OrderRepository(transactions as never).createOrder(order);

	assert.deepEqual(schemas, ['public']);
	assert.equal(order.status, OrderStatus.Draft);
});
