import { Identifier } from '#core/domain/identifier';
import { err, ok, type Result } from '#core/result';

export interface InvalidOrderIdentifierError {
	type: 'invalid_order_identifier';
}

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;

export class OrderIdentifier extends Identifier<'OrderIdentifier'> {
	static create(value: unknown): Result<OrderIdentifier, InvalidOrderIdentifierError> {
		if (typeof value !== 'string' || !UUID_PATTERN.test(value)) {
			return err({ type: 'invalid_order_identifier' });
		}

		return ok(new OrderIdentifier({ value: value.toLowerCase() }));
	}
}
