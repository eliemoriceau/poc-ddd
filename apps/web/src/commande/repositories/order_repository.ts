import { inject } from '@adonisjs/core';
import { Order } from '#commande/domain/order';
import { OrderIdentifier } from '#commande/domain/order_identifier';
import { OrderStatus } from '#commande/domain/order_status';
import { ServiceTypeValueObject } from '#commande/domain/service_type';
import { ok, type Result } from '#core/result';
import { TransactionManager } from '#shared/services/transaction_manager';
import type { Orders } from '#types/db';
import type { Selectable } from 'kysely';

const orderColumns = ['id', 'service_type', 'table_id', 'status'] as const;
type OrderRecord = Pick<Selectable<Orders>, (typeof orderColumns)[number]>;

@inject()
export class OrderRepository {
	constructor(private readonly transactions: TransactionManager) {}

	async createOrder(order: Order): Promise<Result<Order, never>> {
		const record = await this.transactions
			.currentDatabase()
			.insertInto('orders')
			.values({
				id: order.id,
				service_type: order.serviceType,
				table_id: order.tableId,
				status: order.status,
			})
			.returning(orderColumns)
			.executeTakeFirstOrThrow();

		return ok(this.#toDomain(record));
	}

	async findOrderById(id: OrderIdentifier): Promise<Order | null> {
		const record = await this.transactions
			.currentDatabase()
			.selectFrom('orders')
			.select(orderColumns)
			.where('id', '=', id.toString())
			.executeTakeFirst();

		return record ? this.#toDomain(record) : null;
	}

	#toDomain(record: OrderRecord) {
		const service = ServiceTypeValueObject.create(record.service_type, record.table_id);

		if (!service.ok) {
			throw new Error(`Invalid service persisted for order ${record.id}`);
		}

		const status = Object.values(OrderStatus).find((value) => value === record.status);

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
