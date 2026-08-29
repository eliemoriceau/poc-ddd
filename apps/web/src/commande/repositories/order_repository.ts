import { inject } from '@adonisjs/core';
import { Order } from '#commande/domain/order';
import { OrderIdentifier } from '#commande/domain/order_identifier';
import { OrderService } from '#commande/domain/order_service';
import { parseOrderStatus } from '#commande/domain/order_status';
import { TransactionManager } from '#shared/services/transaction_manager';
import type { Orders } from '#types/db';
import type { Selectable } from 'kysely';

const orderColumns = ['id', 'service_type', 'table_id', 'status'] as const;
type OrderRecord = Pick<Selectable<Orders>, (typeof orderColumns)[number]>;

@inject()
export class OrderRepository {
	constructor(
		private readonly transactions: TransactionManager,
		private readonly schema = 'public',
	) {}

	async createOrder(order: Order): Promise<Order> {
		const record = await this.transactions
			.currentDatabase()
			.withSchema(this.schema)
			.insertInto('orders')
			.values({
				id: order.id,
				service_type: order.serviceType,
				table_id: order.tableId,
				status: order.status,
			})
			.returning(orderColumns)
			.executeTakeFirstOrThrow();

		return this.#toDomain(record);
	}

	async findOrderById(id: OrderIdentifier): Promise<Order | null> {
		const record = await this.transactions
			.currentDatabase()
			.withSchema(this.schema)
			.selectFrom('orders')
			.select(orderColumns)
			.where('id', '=', id.toString())
			.executeTakeFirst();

		return record ? this.#toDomain(record) : null;
	}

	#toDomain(record: OrderRecord) {
		const service = OrderService.create(record.service_type, record.table_id);

		if (!service.ok) {
			throw new Error(`Invalid service persisted for order ${record.id}`);
		}

		const status = parseOrderStatus(record.status);

		if (!status) {
			throw new Error(`Invalid status persisted for order ${record.id}`);
		}

		return Order.restore({
			id: OrderIdentifier.fromString(record.id),
			service: service.value,
			status,
		});
	}
}
