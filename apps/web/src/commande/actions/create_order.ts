import { inject } from '@adonisjs/core';
import { Order } from '#commande/domain/order';
import { OrderIdentifier } from '#commande/domain/order_identifier';
import { ServiceTypeValueObject, type ServiceTypeError } from '#commande/domain/service_type';
import { OrderRepository } from '#commande/repositories/order_repository';
import { err, type Result } from '#core/result';
import { TransactionManager } from '#shared/services/transaction_manager';

export interface CreateOrderParams {
	serviceType: string;
	tableId?: string | null;
}

export type CreateOrderResult = Result<Order, ServiceTypeError>;

@inject()
export class CreateOrder {
	constructor(
		private readonly orders: OrderRepository,
		private readonly transactions: TransactionManager,
	) {}

	async execute(params: CreateOrderParams): Promise<CreateOrderResult> {
		const service = ServiceTypeValueObject.create(params.serviceType, params.tableId);

		if (!service.ok) {
			return err(service.error);
		}

		const order = Order.createDraft(OrderIdentifier.generate(), service.value);

		return this.transactions.run(() => this.orders.createOrder(order));
	}
}
