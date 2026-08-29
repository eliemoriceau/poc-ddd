import { OrderLine } from '#commande/domain/order_line';
import { OrderStatus, type OrderStatus as OrderStatusValue } from '#commande/domain/order_status';
import { Entity } from '#core/domain/entity';
import { err, ok, type Result } from '#core/result';
import type { OrderIdentifier } from '#commande/domain/order_identifier';
import type { OrderService } from '#commande/domain/order_service';

export interface OrderProperties {
	id: OrderIdentifier;
	service: OrderService;
	status: OrderStatusValue;
	lines: OrderLine[];
}

export interface OrderNotDraftError {
	type: 'order_not_draft';
}

export class Order extends Entity<OrderProperties> {
	static createDraft(id: OrderIdentifier, service: OrderService) {
		return new Order({ id, service, status: OrderStatus.Draft, lines: [] });
	}

	static restore(properties: OrderProperties) {
		return new Order({ ...properties, lines: [...properties.lines] });
	}

	get id() {
		return this.getIdentifier().toString();
	}

	get serviceType() {
		return this.props.service.value;
	}

	get tableId() {
		return this.props.service.tableId;
	}

	get status() {
		return this.props.status;
	}

	get lines() {
		return [...this.props.lines];
	}

	addLine(line: OrderLine): Result<void, OrderNotDraftError | import('#commande/domain/order_line').OrderLineError> {
		if (this.status !== OrderStatus.Draft) {
			return err({ type: 'order_not_draft' });
		}

		const existingLine = this.props.lines.find((candidate) => candidate.menuItemId === line.menuItemId);

		if (existingLine) {
			const mergedLine = existingLine.addQuantity(line.quantity);

			if (!mergedLine.ok) {
				return err(mergedLine.error);
			}

			this.props.lines[this.props.lines.indexOf(existingLine)] = mergedLine.value;
		} else {
			this.props.lines.push(line);
		}

		return ok(undefined);
	}
}
