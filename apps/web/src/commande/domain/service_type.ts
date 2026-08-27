import { ValueObject } from '#core/domain/value_object';
import { err, ok, type Result } from '#core/result';

export const ServiceType = {
	DineIn: 'DineIn',
	Takeaway: 'Takeaway',
} as const;

export type ServiceTypeValue = (typeof ServiceType)[keyof typeof ServiceType];

export interface InvalidServiceTypeError {
	type: 'invalid_service_type';
}
export interface InvalidTableIdError {
	type: 'invalid_table_id';
}
export interface TableRequiredForDineInError {
	type: 'table_required_for_dine_in';
}
export interface TableForbiddenForTakeawayError {
	type: 'table_forbidden_for_takeaway';
}
export type InvalidServiceTableError = TableRequiredForDineInError | TableForbiddenForTakeawayError;
export type ServiceTypeError = InvalidServiceTypeError | InvalidTableIdError | InvalidServiceTableError;

interface ServiceTypeProperties {
	value: ServiceTypeValue;
	tableId: string | null;
}

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;

export class ServiceTypeValueObject extends ValueObject<ServiceTypeProperties> {
	static create(value: string, tableId: string | null | undefined): Result<ServiceTypeValueObject, ServiceTypeError> {
		if (value !== ServiceType.DineIn && value !== ServiceType.Takeaway) {
			return err({ type: 'invalid_service_type' });
		}

		const normalizedTableId = tableId === null || tableId === undefined ? null : tableId.toLowerCase();

		if (normalizedTableId !== null && !UUID_PATTERN.test(normalizedTableId)) {
			return err({ type: 'invalid_table_id' });
		}

		if (value === ServiceType.DineIn && normalizedTableId === null) {
			return err({ type: 'table_required_for_dine_in' });
		}

		if (value === ServiceType.Takeaway && normalizedTableId !== null) {
			return err({ type: 'table_forbidden_for_takeaway' });
		}

		return ok(new ServiceTypeValueObject({ value, tableId: normalizedTableId }));
	}

	get value() {
		return this.props.value;
	}

	get tableId() {
		return this.props.tableId;
	}
}
