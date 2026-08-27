# Boilerplate domain

This glossary defines the domain language demonstrated by the boilerplate's example capabilities.

## Identity

**User**:
A person who can authenticate and use the application.

## Ordering

**Order**:
An ensemble of menu items requested together for the same service. During the initial scope, an order is associated with either a table or a service, captures item prices when its lines are added, and becomes immutable after it is sent to the kitchen.

**Order line**:
A requested quantity of one menu item within an order. It includes the menu item's name and price as they were known when the line was added. The quantity belongs to the order line, not to the menu item.

An order line is identified by its menu item identity, not by its displayed name. Adding the same menu item increases the existing line quantity.

**Menu item**:
A sellable item offered by the restaurant. It is not the same concept as a kitchen preparation: the Ordering context refers to the item being requested, while the Kitchen context may use its own language for preparing it.

**Service**:
The setting in which an order is placed. The initial scope supports dine-in and takeaway.

**Dine-in**:
A service for which the order is associated with a restaurant table.

**Takeaway**:
A service for which the order is not associated with a restaurant table.

**Table**:
A physical restaurant location to which a dine-in order may be associated.

**Draft order**:
An order that can still have its lines changed.

**Sent order**:
An order that has been submitted to the kitchen and can no longer be freely changed from the Ordering context.

**Confirmed order**:
An order whose lines have been validated by the person taking the order. A confirmed order is ready to be sent to the kitchen but has not yet been submitted.

**Send an order to the kitchen**:
The business action that submits a confirmed order for kitchen preparation. It is distinct from confirming the order.

**Cancelled order**:
An order that will not be prepared or served. Cancellation is supported in the initial model, but its allowed transitions are limited by the order's current state.

## Ordering lifecycle

An order follows this initial lifecycle:

```text
Draft → Confirmed → Sent to kitchen
  ↓          ↓              ↓
Cancelled  Cancelled      (cancellation policy to define)
```

- A draft order can have lines added, changed, or removed.
- Only an order with at least one line can be confirmed.
- A confirmed order can be sent to the kitchen.
- Editing a confirmed order is not part of the initial Ordering flow.
- Only a confirmed order can be sent to the kitchen.
- A cancellation prevents the order from progressing through the normal lifecycle.
- A menu item has no order quantity; the quantity is supplied when adding it to an order.
- Adding an item already present in the order increases the existing line quantity instead of creating a duplicate line.
- A draft or confirmed order can be cancelled.
- An order sent to the kitchen cannot be cancelled in the initial Ordering flow.
- A menu item's price is captured when it is first added to an order. Price changes while the order is open are not modeled in the initial scope.
