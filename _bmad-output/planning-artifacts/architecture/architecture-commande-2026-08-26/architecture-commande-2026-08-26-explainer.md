# Architecture du contexte `Commande`

## Objet

Ce document explique les décisions d’architecture qui doivent permettre à plusieurs implémentations de rester compatibles. Le document normatif est [ARCHITECTURE-SPINE.md](./ARCHITECTURE-SPINE.md) ; ce texte en explicite l’usage pour l’équipe.

## Idée centrale

`Order` est le gardien de la commande. Une Action orchestre une intention complète, mais elle ne décide pas elle-même si la commande peut évoluer. Elle charge l’agrégat, lui demande d’appliquer la décision, puis persiste le résultat.

```text
contrôleur Adonis
  → Action
    → Order (décision métier)
      → repository Kysely
        → Postgres
```

Cette frontière évite que `ConfirmOrder` et `SendOrderToKitchen`, par exemple, développent chacune leur propre interprétation de l’état de la commande.

## Découpage des commandes

Chaque capacité fonctionnelle possède une Action dédiée :

| Action | Responsabilité |
| --- | --- |
| `CreateOrder` | créer une commande `Draft` avec le service valide |
| `AddOrderLine` | ajouter ou fusionner une ligne dans une commande `Draft` |
| `ConfirmOrder` | confirmer une commande non vide |
| `SendOrderToKitchen` | envoyer une commande confirmée et gérer l’idempotence |
| `CancelOrder` | annuler une commande `Draft` ou `Confirmed` |

Les contrôleurs valident la forme de la requête et traduisent les résultats. Ils ne calculent ni total, ni transition, ni règle de fusion.

Le type de service est également une invariant de création : `DineIn` exige une table ; `Takeaway` n’en accepte aucune. Les transitions sont fermées : `Draft → Confirmed → SentToKitchen`, avec annulation depuis `Draft` ou `Confirmed` uniquement.

## Données de ligne et argent

Une ligne conserve `menuItemId`, `name`, `quantity` et `unitPrice`. Le nom et le prix sont un instantané pris au premier ajout. Si le menu change ensuite, la commande ouverte ne change pas rétroactivement.

Le prix est stocké comme entier en centimes dans la base, mais manipulé par un Value Object dans le domaine. Cette distinction protège l’équipe contre les flottants et rend explicite la lecture du montant. La cuisine n’a pas besoin du prix : son contrat reçoit uniquement l’identifiant, le nom et la quantité.

## Intégration avec `Cuisine`

Pour le périmètre actuel, `Cuisine` est derrière un contrat local synchrone. Cela garde le bac à sable testable sans imposer une infrastructure distribuée inexistante.

L’envoi est idempotent : si la commande est déjà `SentToKitchen`, la seconde demande réussit sans nouvelle mutation et sans nouvel effet métier.

Une outbox devient pertinente seulement si le signal doit survivre à une panne entre la sauvegarde de `Commande` et la prise en charge par `Cuisine`, ou si `Cuisine` devient un processus séparé. Elle reste donc différée, mais le contrat d’intégration doit être suffisamment isolé pour permettre cette évolution.

Dans le contrat synchrone retenu, l’appel Cuisine est borné par un timeout et utilise `orderId` comme clé d’idempotence. Les envois concurrents d’une même commande sont sérialisés. La commande passe à `SentToKitchen` uniquement après succès ; un échec laisse `Confirmed`, ce qui permet un nouvel essai. Le contrat Cuisine doit donc accepter le même `orderId` sans produire de doublon si un retry survient après un succès externe mais avant la persistance locale.

## Ce que l’équipe doit tester

- les transitions valides et invalides de `Order` ;
- l’interdiction de confirmer ou d’envoyer une commande vide ;
- la fusion par `menuItemId` ;
- l’unicité persistante `(orderId, menuItemId)` et le comportement sous ajout concurrent ;
- la capture du nom et du prix au premier ajout ;
- la validation du Value Object de prix ;
- l’idempotence de l’envoi à `Cuisine` ;
- le fait que le DTO Cuisine ne contient pas le prix ;
- le mapping de chaque erreur `Result` dans la couche `app`.
- l’invariant table/service et les transitions exactes ;

## Hors périmètre actuel

Outbox, retries distribués, paiement, stock, suivi détaillé de préparation, modification après confirmation, gestion complète du menu et autorisation opérateur ne sont pas des décisions de cette architecture.
