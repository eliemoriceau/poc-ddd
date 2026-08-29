import { inject } from '@adonisjs/core';
import { Order } from '#commande/domain/order';
import { OrderIdentifier } from '#commande/domain/order_identifier';
import { OrderService, type ServiceTypeError } from '#commande/domain/order_service';
import { OrderRepository } from '#commande/repositories/order_repository';
import { err, ok, type Result } from '#core/result';
import { TransactionManager } from '#shared/services/transaction_manager';

export interface CreateOrderParams {
	serviceType: unknown;
	tableId?: unknown;
}

export type CreateOrderResult = Result<Order, ServiceTypeError>;

@inject()
export class CreateOrder {
	constructor(
		private readonly orders: OrderRepository,
		private readonly transactions: TransactionManager,
	) {}

	async execute(params: CreateOrderParams): Promise<CreateOrderResult> {
		const service = OrderService.create(params.serviceType, params.tableId);

		if (!service.ok) {
			return err(service.error);
		}

		const order = Order.createDraft(OrderIdentifier.generate(), service.value);

		return this.transactions.run(async () => ok(await this.orders.createOrder(order)));
	}
}
