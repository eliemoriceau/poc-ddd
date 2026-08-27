---
id: SPEC-commande
companions:
  - state-machines.md
  - ../../../CONTEXT.md
  - ../../planning-artifacts/architecture/architecture-commande-2026-08-26/ARCHITECTURE-SPINE.md
  - ../../planning-artifacts/architecture/architecture-commande-2026-08-26/architecture-commande-2026-08-26-explainer.md
sources: []
---

# Contexte Commande

> **Contrat canonique.** Cette spécification définit le périmètre fonctionnel initial du contexte `Commande` pour le bac à sable DDD du restaurant.

## Pourquoi

Le projet a besoin d’un domaine métier assez concret pour expérimenter le DDD dans un monolithe modulaire. Le contexte `Commande` fournit ce terrain avec un flux limité : prendre une commande, la confirmer, puis la transmettre en cuisine.

## Capacités

- **CAP-1**
  - **intent:** Un utilisateur peut créer une commande pour démarrer une prise de commande.
  - **success:** Une commande nouvellement créée est dans l’état `Draft` et possède un identifiant.

- **CAP-2**
  - **intent:** Un utilisateur peut ajouter un article à une commande en indiquant sa quantité.
  - **success:** La commande contient une ligne avec le nom, le prix capturé et la quantité demandée ; l’ajout du même article augmente la quantité de la ligne existante.

- **CAP-3**
  - **intent:** Un utilisateur peut confirmer une commande contenant au moins une ligne.
  - **success:** Une commande non vide passe de `Draft` à `Confirmed` et ne fait plus partie du flux de modification initial.

- **CAP-4**
  - **intent:** Un utilisateur peut envoyer une commande confirmée en cuisine par une action distincte de la confirmation.
  - **success:** Une commande `Confirmed` passe à `SentToKitchen` et produit l’information métier nécessaire à sa prise en charge par le contexte `Cuisine`. Un second envoi d’une commande déjà `SentToKitchen` réussit sans modifier son état ni produire de nouvel effet métier.

- **CAP-5**
  - **intent:** Un utilisateur peut annuler une commande avant son envoi en cuisine.
  - **success:** Une commande `Draft` ou `Confirmed` passe à `Cancelled` et ne peut plus progresser dans le cycle normal.

## Contraintes

- Une commande utilise un seul type de service : `DineIn` avec une table, ou `Takeaway` sans table.
- Une commande vide ne peut pas être confirmée ni envoyée en cuisine.
- Une quantité doit être strictement positive.
- Un prix doit être supérieur ou égal à zéro.
- Une commande ne peut être envoyée en cuisine que depuis `Confirmed`.
- L’action d’envoi en cuisine est idempotente pour une commande déjà `SentToKitchen`.
- L’identité d’une ligne repose sur `menuItemId`, pas sur le nom affiché.
- Le nom et le prix sont capturés au premier ajout de l’article à la commande.
- Une commande `SentToKitchen` ne peut pas être annulée dans le flux initial.

## Non-objectifs

- La préparation et le suivi détaillé des plats en cuisine.
- La gestion du menu et de la disponibilité des ingrédients.
- Le paiement et la clôture financière de la commande.
- La modification d’une commande après confirmation.
- Le traitement des changements de prix pendant une commande ouverte.

## Signal de réussite

Un utilisateur peut créer une commande `DineIn` ou `Takeaway`, ajouter plusieurs articles avec fusion des lignes identiques, la confirmer, puis l’envoyer en cuisine. Les transitions invalides sont refusées par le modèle métier et les cas nominaux sont vérifiables par des tests.

## Hypothèses

- Le contexte `Menu` n’est pas encore implémenté ; l’ajout d’un article fournit néanmoins un `menuItemId`, un nom et un prix valides.
- `SentToKitchen` représente la soumission réussie au contexte `Cuisine`, sans définir encore le traitement de ce contexte.
