import { Entity } from '#core/domain/entity';
import type { OrderIdentifier } from '#commande/domain/order_identifier';
import type { OrderStatus } from '#commande/domain/order_status';
import type { ServiceTypeValueObject } from '#commande/domain/service_type';

export interface OrderProperties {
	id: OrderIdentifier;
	service: ServiceTypeValueObject;
	status: OrderStatus;
}

export class Order extends Entity<OrderProperties> {
	static createDraft(id: OrderIdentifier, service: ServiceTypeValueObject) {
		return new Order({ id, service, status: 'Draft' });
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
