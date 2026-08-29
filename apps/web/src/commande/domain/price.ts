import { ValueObject } from '#core/domain/value_object';
import { err, ok, type Result } from '#core/result';

export interface InvalidPriceError {
	type: 'invalid_price';
}

export class Price extends ValueObject<{ cents: number }> {
	static create(cents: unknown): Result<Price, InvalidPriceError> {
		if (typeof cents !== 'number' || !Number.isSafeInteger(cents) || cents < 0) {
			return err({ type: 'invalid_price' });
		}

		return ok(new Price({ cents }));
	}

	get cents() {
		return this.props.cents;
	}
}
