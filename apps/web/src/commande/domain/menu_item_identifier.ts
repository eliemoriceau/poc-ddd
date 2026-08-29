import { Identifier } from '#core/domain/identifier';
import { err, ok, type Result } from '#core/result';

export interface InvalidMenuItemIdentifierError {
	type: 'invalid_menu_item_identifier';
}

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;

export class MenuItemIdentifier extends Identifier<'MenuItemIdentifier'> {
	static create(value: unknown): Result<MenuItemIdentifier, InvalidMenuItemIdentifierError> {
		if (typeof value !== 'string' || !UUID_PATTERN.test(value)) {
			return err({ type: 'invalid_menu_item_identifier' });
		}

		return ok(new MenuItemIdentifier({ value: value.toLowerCase() }));
	}
}
