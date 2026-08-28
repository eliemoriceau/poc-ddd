export const OrderStatus = {
	Draft: 'Draft',
	Confirmed: 'Confirmed',
	SentToKitchen: 'SentToKitchen',
	Cancelled: 'Cancelled',
} as const;

export type OrderStatus = (typeof OrderStatus)[keyof typeof OrderStatus];

export function parseOrderStatus(value: string): OrderStatus | null {
	switch (value) {
		case OrderStatus.Draft:
		case OrderStatus.Confirmed:
		case OrderStatus.SentToKitchen:
		case OrderStatus.Cancelled:
			return value;
		default:
			return null;
	}
}
