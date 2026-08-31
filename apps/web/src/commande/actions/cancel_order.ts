import { inject } from '@adonisjs/core';
import { OrderIdentifier, type InvalidOrderIdentifierError } from '#commande/domain/order_identifier';
import { OrderRepository } from '#commande/repositories/order_repository';
import { err, ok, type Result } from '#core/result';
import { TransactionManager } from '#shared/services/transaction_manager';
import type { Order, OrderNotCancellableError } from '#commande/domain/order';

export interface CancelOrderParams {
	orderId: unknown;
}

export interface OrderNotFoundError {
	type: 'order_not_found';
}

export type CancelOrderError = InvalidOrderIdentifierError | OrderNotFoundError | OrderNotCancellableError;
export type CancelOrderResult = Result<Order, CancelOrderError>;

@inject()
export class CancelOrder {
	constructor(
		private readonly orders: OrderRepository,
		private readonly transactions: TransactionManager,
	) {}

	async execute(params: CancelOrderParams): Promise<CancelOrderResult> {
		const orderId = OrderIdentifier.create(params?.orderId);

		if (!orderId.ok) {
			return err(orderId.error);
		}

		return this.transactions.run(async () => {
			const order = await this.orders.findOrderForUpdate(orderId.value);

			if (!order) {
				return err({ type: 'order_not_found' });
			}

			const cancelled = order.cancel();

			if (!cancelled.ok) {
				return err(cancelled.error);
			}

			return cancelled.value ? ok(await this.orders.saveOrder(order)) : ok(order);
		});
	}
}
