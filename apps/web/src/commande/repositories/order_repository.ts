import { inject } from '@adonisjs/core';
import { Order } from '#commande/domain/order';
import { OrderIdentifier } from '#commande/domain/order_identifier';
import { OrderLine } from '#commande/domain/order_line';
import { OrderService } from '#commande/domain/order_service';
import { parseOrderStatus } from '#commande/domain/order_status';
import { TransactionManager } from '#shared/services/transaction_manager';
import type { OrderLines, Orders } from '#types/db';
import type { Selectable } from 'kysely';

const orderColumns = ['id', 'service_type', 'table_id', 'status'] as const;
const lineColumns = ['menu_item_id', 'name', 'quantity', 'unit_price_cents'] as const;
type OrderRecord = Pick<Selectable<Orders>, (typeof orderColumns)[number]>;
type OrderLineRecord = Pick<Selectable<OrderLines>, Exclude<(typeof lineColumns)[number], 'order_id'>>;

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

		return this.#toDomain(record, []);
	}

	async findOrderById(id: OrderIdentifier): Promise<Order | null> {
		return this.#findOrder(id, false);
	}

	async findOrderForUpdate(id: OrderIdentifier): Promise<Order | null> {
		return this.#findOrder(id, true);
	}

	async saveOrder(order: Order): Promise<Order> {
		const lines = order.lines;
		const database = this.transactions.currentDatabase().withSchema(this.schema);

		await database.updateTable('orders').set({ status: order.status }).where('id', '=', order.id).execute();

		if (lines.length === 0) {
			await database.deleteFrom('order_lines').where('order_id', '=', order.id).execute();
			return order;
		}

		await database
			.deleteFrom('order_lines')
			.where('order_id', '=', order.id)
			.where(
				'menu_item_id',
				'not in',
				lines.map((line) => line.menuItemId),
			)
			.execute();

		await database
			.insertInto('order_lines')
			.values(
				lines.map((line) => ({
					order_id: order.id,
					menu_item_id: line.menuItemId,
					name: line.name,
					quantity: line.quantity,
					unit_price_cents: line.unitPriceCents,
				})),
			)
			.onConflict((conflict) =>
				conflict.columns(['order_id', 'menu_item_id']).doUpdateSet((values) => ({
					quantity: values.ref('excluded.quantity'),
				})),
			)
			.execute();

		return order;
	}

	async #findOrder(id: OrderIdentifier, forUpdate: boolean): Promise<Order | null> {
		const record = await this.transactions
			.currentDatabase()
			.withSchema(this.schema)
			.selectFrom('orders')
			.select(orderColumns)
			.where('id', '=', id.toString())
			.$if(forUpdate, (query) => query.forUpdate())
			.executeTakeFirst();

		if (!record) {
			return null;
		}

		const lines = await this.transactions
			.currentDatabase()
			.withSchema(this.schema)
			.selectFrom('order_lines')
			.select(lineColumns)
			.where('order_id', '=', id.toString())
			.execute();

		return this.#toDomain(record, lines);
	}

	#toDomain(record: OrderRecord, lineRecords: Array<OrderLineRecord>) {
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
			lines: lineRecords.map((line) => {
				const price = this.#toSafeNumber(line.unit_price_cents, 'unit_price_cents');
				const quantity = this.#toSafeNumber(line.quantity, 'quantity');

				return OrderLine.restoreFromPersistence({
					menuItemId: line.menu_item_id,
					name: line.name,
					quantity,
					unitPriceCents: price,
				});
			}),
		});
	}

	#toSafeNumber(value: string | number | bigint, field: string) {
		const number = typeof value === 'string' || typeof value === 'bigint' ? Number(value) : value;

		if (!Number.isSafeInteger(number)) {
			throw new Error(`Invalid ${field} persisted`);
		}

		return number;
	}
}
