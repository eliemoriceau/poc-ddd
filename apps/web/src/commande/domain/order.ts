import { OrderStatus, type OrderStatus as OrderStatusValue } from '#commande/domain/order_status';
import { Entity } from '#core/domain/entity';
import type { OrderIdentifier } from '#commande/domain/order_identifier';
import type { OrderService } from '#commande/domain/order_service';

export interface OrderProperties {
	id: OrderIdentifier;
	service: OrderService;
	status: OrderStatusValue;
}

export class Order extends Entity<OrderProperties> {
	static createDraft(id: OrderIdentifier, service: OrderService) {
		return new Order({ id, service, status: OrderStatus.Draft });
	}

	static restore(properties: OrderProperties) {
		return new Order(properties);
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
}
