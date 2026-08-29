import { inject } from '@adonisjs/core';
import { MenuItemIdentifier } from '#commande/domain/menu_item_identifier';
import { Order } from '#commande/domain/order';
import { OrderIdentifier } from '#commande/domain/order_identifier';
import { OrderLine } from '#commande/domain/order_line';
import { OrderService } from '#commande/domain/order_service';
import { parseOrderStatus } from '#commande/domain/order_status';
import { Price } from '#commande/domain/price';
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
		const database = this.transactions.currentDatabase().withSchema(this.schema);

		await database
			.insertInto('order_lines')
			.values(
				order.lines.map((line) => ({
					order_id: order.id,
					menu_item_id: line.menuItemId,
					name: line.name,
					quantity: line.quantity,
					unit_price_cents: line.unitPriceCents,
				})),
			)
			.onConflict((conflict) =>
				conflict.columns(['order_id', 'menu_item_id']).doUpdateSet((values) => ({
					name: values.ref('excluded.name'),
					quantity: values.ref('excluded.quantity'),
					unit_price_cents: values.ref('excluded.unit_price_cents'),
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
				const menuItemId = MenuItemIdentifier.create(line.menu_item_id);
				const price = Price.create(line.unit_price_cents);

				if (
					!menuItemId.ok ||
					!price.ok ||
					typeof line.name !== 'string' ||
					line.name.trim() === '' ||
					!Number.isSafeInteger(line.quantity) ||
					line.quantity <= 0
				) {
					throw new Error(`Invalid order line persisted for order ${record.id}`);
				}

				return OrderLine.restore({
					menuItemId: menuItemId.value,
					name: line.name,
					quantity: line.quantity,
					unitPrice: price.value,
				});
			}),
		});
	}
}
