import { MenuItemIdentifier, type InvalidMenuItemIdentifierError } from '#commande/domain/menu_item_identifier';
import { Price } from '#commande/domain/price';
import { ValueObject } from '#core/domain/value_object';
import { err, ok, type Result } from '#core/result';
import type { InvalidPriceError } from '#commande/domain/price';

export interface InvalidOrderLineNameError {
	type: 'invalid_order_line_name';
}
export interface InvalidOrderLineQuantityError {
	type: 'invalid_order_line_quantity';
}
export interface OrderLineQuantityOverflowError {
	type: 'order_line_quantity_overflow';
}
export const MAX_POSTGRES_INTEGER = 2_147_483_647;
export type OrderLineError =
	| InvalidOrderLineNameError
	| InvalidOrderLineQuantityError
	| OrderLineQuantityOverflowError
	| InvalidMenuItemIdentifierError
	| InvalidPriceError;

interface OrderLineProperties {
	menuItemId: MenuItemIdentifier;
	name: string;
	quantity: number;
	unitPrice: Price;
}

export class OrderLine extends ValueObject<OrderLineProperties> {
	static create(
		menuItemId: unknown,
		name: unknown,
		quantity: unknown,
		unitPriceCents: unknown,
	): Result<OrderLine, OrderLineError> {
		const identifier = MenuItemIdentifier.create(menuItemId);

		if (!identifier.ok) {
			return err(identifier.error);
		}

		if (typeof name !== 'string' || name.trim() === '') {
			return err({ type: 'invalid_order_line_name' });
		}

		if (
			typeof quantity !== 'number' ||
			!Number.isSafeInteger(quantity) ||
			quantity <= 0 ||
			quantity > MAX_POSTGRES_INTEGER
		) {
			return err({ type: 'invalid_order_line_quantity' });
		}

		const price = Price.create(unitPriceCents);

		if (!price.ok) {
			return err(price.error);
		}

		return ok(new OrderLine({ menuItemId: identifier.value, name, quantity, unitPrice: price.value }));
	}

	static restore(properties: OrderLineProperties) {
		return new OrderLine(properties);
	}

	get menuItemId() {
		return this.props.menuItemId.toString();
	}

	get name() {
		return this.props.name;
	}

	get quantity() {
		return this.props.quantity;
	}

	get unitPriceCents() {
		return this.props.unitPrice.cents;
	}

	addQuantity(quantity: number): Result<OrderLine, OrderLineQuantityOverflowError> {
		if (this.quantity > MAX_POSTGRES_INTEGER - quantity) {
			return err({ type: 'order_line_quantity_overflow' });
		}

		return ok(OrderLine.restore({ ...this.props, quantity: this.quantity + quantity }));
	}
}
