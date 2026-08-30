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

		if (typeof quantity !== 'number' || !Number.isSafeInteger(quantity) || quantity <= 0) {
			return err({ type: 'invalid_order_line_quantity' });
		}

		const price = Price.create(unitPriceCents);

		if (!price.ok) {
			return err(price.error);
		}

		return ok(new OrderLine({ menuItemId: identifier.value, name, quantity, unitPrice: price.value }));
	}

	static restore(properties: OrderLineProperties) {
		return OrderLine.#restoreValidated(
			properties.menuItemId.toString(),
			properties.name,
			properties.quantity,
			properties.unitPrice.cents,
		);
	}

	static restoreFromPersistence(properties: {
		menuItemId: unknown;
		name: unknown;
		quantity: unknown;
		unitPriceCents: unknown;
	}) {
		return OrderLine.#restoreValidated(
			properties.menuItemId,
			properties.name,
			properties.quantity,
			properties.unitPriceCents,
		);
	}

	static #restoreValidated(menuItemId: unknown, name: unknown, quantity: unknown, unitPriceCents: unknown) {
		const validated = OrderLine.create(menuItemId, name, quantity, unitPriceCents);

		if (!validated.ok) {
			throw new Error(`Invalid order line state: ${validated.error.type}`);
		}

		return validated.value;
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

	addQuantity(quantity: number): Result<OrderLine, InvalidOrderLineQuantityError | OrderLineQuantityOverflowError> {
		if (!Number.isSafeInteger(quantity) || quantity <= 0) {
			return err({ type: 'invalid_order_line_quantity' });
		}

		if (!Number.isSafeInteger(this.quantity + quantity)) {
			return err({ type: 'order_line_quantity_overflow' });
		}

		return ok(
			OrderLine.restore({
				...this.props,
				quantity: this.quantity + quantity,
			}),
		);
	}
}
