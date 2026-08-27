export const OrderStatus = {
	Draft: 'Draft',
	Confirmed: 'Confirmed',
	SentToKitchen: 'SentToKitchen',
	Cancelled: 'Cancelled',
} as const;

export type OrderStatus = (typeof OrderStatus)[keyof typeof OrderStatus];
