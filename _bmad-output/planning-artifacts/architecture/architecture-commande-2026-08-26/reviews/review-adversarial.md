# Revue adversariale — Architecture Commande

## Verdict

**NON PRÊT POUR IMPLÉMENTATION INDÉPENDANTE.** Le spine fixe correctement la propriété métier de `Order`, la capture des lignes et le format monétaire, mais deux implémentations conformes peuvent encore diverger sur la frontière de cohérence avec `Cuisine`, les courses concurrentes, le schéma persistant et l’exploitation. Les points ci-dessous doivent être décidés dans le spine ou explicitement bornés avant de répartir le travail.

## Constats

### 1. [CRITIQUE] L’ordre « persister puis appeler Cuisine » ne définit pas la cohérence de l’envoi

`AD-5` exige de persister puis d’appeler le contrat synchrone, sans préciser si la transition vers `SentToKitchen` est commitée avant l’appel, dans la même transaction, ou seulement après un retour favorable de Cuisine.

Deux implémentations conformes divergent immédiatement :

- A commit `SentToKitchen`, puis appelle Cuisine : une panne après commit laisse une commande marquée envoyée mais absente de Cuisine ; un retry devient impossible avec la règle d’idempotence actuelle.
- B appelle Cuisine, puis commit la transition : une panne après l’appel mais avant le commit peut provoquer un doublon au retry, ou laisser Cuisine traitée alors que Commande est encore `Confirmed`.

Le spine doit choisir une sémantique explicite (par exemple résultat synchrone best-effort avec état d’échec/retry, ou outbox transactionnelle) et définir timeout, erreur et reprise. Une transaction Postgres ne peut pas rendre atomique un appel synchrone à un autre contexte.

### 2. [CRITIQUE] L’idempotence ne couvre pas les envois concurrents

`AD-6` ne protège que le cas séquentiel « déjà `SentToKitchen` ». Deux requêtes concurrentes peuvent toutes deux lire `Confirmed`, appeler Cuisine, puis tenter la transition. Même si la base refuse la seconde transition, Cuisine peut recevoir deux effets.

Une implémentation peut verrouiller la commande avant l’appel ; une autre peut utiliser un simple test d’état en mémoire ou dans la transaction. Les deux paraissent compatibles avec le texte actuel. Il faut fixer la stratégie de concurrence et la clé de déduplication côté contrat Cuisine (par exemple `orderId` comme identifiant d’idempotence consommé par Cuisine), ou reconnaître explicitement que la garantie n’existe pas.

### 3. [HAUTE] La fusion des lignes n’est pas garantie par la persistance

`AD-3` indique que le même `menuItemId` augmente la quantité, mais le modèle relationnel ne fixe ni contrainte d’unicité `(order_id, menu_item_id)`, ni verrouillage/version optimiste pour deux ajouts concurrents.

Une implémentation peut charger puis réécrire les lignes ; une autre peut faire un `UPDATE` atomique ou compter sur une contrainte SQL. Elles peuvent produire deux lignes identiques ou perdre une quantité tout en respectant le code nominal. Le spine doit rendre la propriété observable au niveau base de données et préciser la stratégie de concurrence. Le point ne devrait pas rester dans « schéma exact ... à fixer avec la migration ».

### 4. [HAUTE] Les invariants `DineIn`/`Takeaway` sont annoncés mais non attribués

Le spine mentionne `service_type` et `table_id`, mais ne dit pas qui garantit « `DineIn` implique une table » et « `Takeaway` interdit une table », ni comment cette règle survit à une écriture directe du repository ou à une migration.

Deux repositories peuvent accepter des combinaisons différentes, et le diagramme autorise implicitement `table_id` nul ou non nul sans contrainte. Il faut rattacher cet invariant à un Value Object/agrégat et à une contrainte de persistance (ou documenter pourquoi la base ne peut pas le garantir).

### 5. [MOYENNE] L’enveloppe opérationnelle de l’intégration est absente

À l’altitude feature, le spine ne décide rien sur le délai maximal d’un appel Cuisine, les erreurs transitoires, les logs/corrélations, les métriques, ni le comportement en cas de redémarrage ou de déploiement. Ces silences permettent une implémentation bloquante sans timeout et une autre avec timeout/retry, toutes deux « conformes ».

Il faut au minimum décider les invariants opérationnels du contrat local : timeout borné, propagation des erreurs, identifiant de corrélation/idempotence et observabilité minimale. Si ces sujets sont réellement hors périmètre, les inscrire explicitement dans `Deferred` avec une condition de reprise.

## Vérification mécanique

Le lint du spine n’a pas pu être exécuté dans cet environnement : `uv` a été bloqué par une tentative d’ouverture de `/Users/elie/.cache/uv/sdists-v9/.git` (`Operation not permitted`).
