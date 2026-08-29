import { inject } from '@adonisjs/core';
import { Order } from '#commande/domain/order';
import { OrderIdentifier, type InvalidOrderIdentifierError } from '#commande/domain/order_identifier';
import { OrderLine, type OrderLineError } from '#commande/domain/order_line';
import { OrderRepository } from '#commande/repositories/order_repository';
import { err, ok, type Result } from '#core/result';
import { TransactionManager } from '#shared/services/transaction_manager';

export interface AddOrderLineParams {
	orderId: unknown;
	menuItemId: unknown;
	name: unknown;
	quantity: unknown;
	unitPriceCents: unknown;
}

export interface OrderNotFoundError {
	type: 'order_not_found';
}

export type AddOrderLineError =
	| OrderNotFoundError
	| InvalidOrderIdentifierError
	| OrderLineError
	| { type: 'order_not_draft' };
export type AddOrderLineResult = Result<Order, AddOrderLineError>;

@inject()
export class AddOrderLine {
	constructor(
		private readonly orders: OrderRepository,
		private readonly transactions: TransactionManager,
	) {}

	async execute(params: AddOrderLineParams): Promise<AddOrderLineResult> {
		const orderId = OrderIdentifier.create(params.orderId);

		if (!orderId.ok) {
			return err(orderId.error);
		}

		const line = OrderLine.create(params.menuItemId, params.name, params.quantity, params.unitPriceCents);

		if (!line.ok) {
			return err(line.error);
		}

		return this.transactions.run(async () => {
			const order = await this.orders.findOrderForUpdate(orderId.value);

			if (!order) {
				return err({ type: 'order_not_found' });
			}

			const added = order.addLine(line.value);

			if (!added.ok) {
				return err(added.error);
			}

			return ok(await this.orders.saveOrder(order));
		});
	}
}
