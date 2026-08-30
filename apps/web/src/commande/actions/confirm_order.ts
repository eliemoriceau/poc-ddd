import { inject } from '@adonisjs/core';
import { Order } from '#commande/domain/order';
import { OrderIdentifier, type InvalidOrderIdentifierError } from '#commande/domain/order_identifier';
import { OrderRepository } from '#commande/repositories/order_repository';
import { err, ok, type Result } from '#core/result';
import { TransactionManager } from '#shared/services/transaction_manager';

export interface ConfirmOrderParams {
	orderId: unknown;
}

export interface OrderNotFoundError {
	type: 'order_not_found';
}

export type ConfirmOrderError =
	| InvalidOrderIdentifierError
	| OrderNotFoundError
	| { type: 'order_not_draft' }
	| { type: 'order_empty' };
export type ConfirmOrderResult = Result<Order, ConfirmOrderError>;

@inject()
export class ConfirmOrder {
	constructor(
		private readonly orders: OrderRepository,
		private readonly transactions: TransactionManager,
	) {}

	async execute(params: ConfirmOrderParams): Promise<ConfirmOrderResult> {
		const orderId = OrderIdentifier.create(params.orderId);

		if (!orderId.ok) {
			return err(orderId.error);
		}

		return this.transactions.run(async () => {
			const order = await this.orders.findOrderForUpdate(orderId.value);

			if (!order) {
				return err({ type: 'order_not_found' });
			}

			const confirmed = order.confirm();

			if (!confirmed.ok) {
				return err(confirmed.error);
			}

			return ok(await this.orders.saveOrder(order));
		});
	}
}
