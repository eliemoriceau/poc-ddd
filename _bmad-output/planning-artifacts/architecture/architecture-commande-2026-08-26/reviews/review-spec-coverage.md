# Revue d’architecture — couverture des specs Commande

Date : 2026-08-26  
Cible : `ARCHITECTURE-SPINE.md`  
Sources examinées : `SPEC.md`, `state-machines.md`  
Périmètre : couverture de CAP-1 à CAP-5, invariants métier, frontières de contexte et décisions différées.

## Verdict

**Verdict : À corriger avant validation / implémentation.**

Le spine adopte une direction cohérente — agrégat `Order`, Actions explicites, prix encapsulé en Value Object et contrat Cuisine sans prix — et couvre les cinq capacités au niveau de la cartographie. Il ne verrouille toutefois pas plusieurs invariants qui empêcheraient deux implémentations de diverger : la validité du type de service, la non-vacuité requise pour confirmer/envoyer, les sources exactes des transitions d’annulation et la sémantique transactionnelle de l’envoi synchrone à Cuisine.

## Synthèse de couverture

| Capacité | Couverture dans le spine | Évaluation |
| --- | --- | --- |
| CAP-1 — créer | Action dédiée, `Result`, persistance via repository ; l’agrégat `Order` est identifié | Partielle : l’état initial `Draft`, l’identifiant et les règles `DineIn`/`Takeaway` ne sont pas explicitement fixés par une AD |
| CAP-2 — ajouter/fusionner une ligne | Propriétaire unique, identité par `menuItemId`, capture du nom/prix, fusion de quantité, prix en centimes | Bonne, avec une omission de validation explicite de `quantity > 0` |
| CAP-3 — confirmer | Action dédiée et transition possédée par `Order` | Partielle : la commande doit contenir au moins une ligne et seule `Draft` peut confirmer ne sont pas formulés comme règles exécutables dans le spine |
| CAP-4 — envoyer en cuisine | Action dédiée, source `Confirmed`, contrat sans prix, idempotence | Partielle : l’ordre persistance/appel synchrone et la garantie d’absence d’état incohérent en cas d’échec sont ambigus |
| CAP-5 — annuler | Action dédiée et transitions détenues par `Order` | Partielle : les états sources `Draft`/`Confirmed` et l’interdiction depuis `SentToKitchen` ne sont pas explicitement verrouillés |

## Constats détaillés

### [HIGH] Les invariants du type de service ne sont pas portés par une décision architecturale

La spec impose un seul type de service : `DineIn` avec une table, ou `Takeaway` sans table. Le spine indique que `Order` possède le « type de service », mais aucune règle ne fixe les contraintes associées. Le diagramme contient `service_type` et `table_id`, sans exprimer leur relation.

Risque : une implémentation peut accepter `DineIn` sans `tableId`, `Takeaway` avec une table, ou changer de type après création. Ces choix divergent entre Action, agrégat, repository et migration.

Correction attendue : ajouter une AD ou compléter AD-1 pour imposer l’invariant de création et l’immutabilité du type de service ; indiquer que `DineIn` exige une table et que `Takeaway` interdit toute table. Les contraintes de migration peuvent compléter, mais ne doivent pas remplacer la règle du domaine.

### [HIGH] La non-vacuité de la commande n’est pas explicitement verrouillée pour confirmation et envoi

`SPEC.md` et `state-machines.md` exigent qu’une commande vide ne puisse être ni confirmée ni envoyée en cuisine. AD-1 fixe la propriété des transitions, et AD-5 fixe seulement la source `Confirmed` pour l’envoi ; aucune règle du spine ne dit que `ConfirmOrder` refuse une commande sans ligne, ni que `SendOrderToKitchen` refuse une commande vide.

Risque : CAP-3 et CAP-4 peuvent être implémentées avec une transition valide du point de vue de l’état mais invalide métier.

Correction attendue : expliciter dans AD-1 ou dans une AD dédiée que `ConfirmOrder` exige au moins une `OrderLine`, et que l’envoi ne peut porter que sur une commande non vide. Le refus doit rester un résultat métier attendu conformément à AD-7.

### [HIGH] Les sources autorisées des transitions ne sont pas assez précises

La machine d’états définit `Draft -> Confirmed`, `Confirmed -> SentToKitchen`, `Draft|Confirmed -> Cancelled`, ainsi que les états terminaux. AD-1 énumère les transitions mais ne formule pas leurs préconditions complètes. En particulier, elle ne dit pas que l’annulation est interdite depuis `SentToKitchen`, ni que la confirmation est réservée à `Draft`.

Risque : des méthodes d’agrégat ou Actions pourraient accepter une annulation après envoi, une reconfirmation ou une transition depuis un état terminal, tout en prétendant respecter AD-1.

Correction attendue : faire de la machine d’états une règle normative dans AD-1, avec la liste explicite des états source et destination pour chaque opération ; préciser que `SentToKitchen` et `Cancelled` sont terminaux dans `Commande`, sauf répétition idempotente de l’envoi sur `SentToKitchen`.

### [HIGH] La frontière synchrone avec Cuisine laisse une incohérence possible entre état et effet externe

AD-5 impose que `SendOrderToKitchen` « persiste l’agrégat puis utilise un contrat local ». Le spine ne définit pas ce qui arrive si l’appel Cuisine échoue après la persistance, ni si l’état `SentToKitchen` est persisté avant ou après l’appel. La transaction de l’Action (AD-2) ne peut pas rendre atomique un appel externe synchrone et une transaction Postgres.

Risque : une commande peut être persistée `SentToKitchen` alors que Cuisine n’a rien reçu, puis un second envoi sera considéré comme un succès idempotent sans nouvel appel ; ou, à l’inverse, Cuisine peut avoir reçu la commande alors que le changement d’état n’a pas été persisté. Cela contredit la sémantique opérationnelle attendue de CAP-4.

Correction attendue : décider et documenter le protocole de cette première version : par exemple, appeler Cuisine avant de persister `SentToKitchen`, ne persister l’état qu’après succès, et retourner une erreur d’infrastructure sans marquer la commande envoyée. Cette décision doit aussi préciser le comportement en cas d’échec de persistance après acceptation par Cuisine. Si aucune garantie forte n’est acceptée, le spine doit le déclarer explicitement comme limite connue et avancer la décision outbox/retry, au lieu de laisser l’ordre actuel sembler transactionnel.

### [MEDIUM] La validation de quantité positive n’est pas explicitement couverte

La spec impose `quantity > 0`. AD-3 décrit la quantité et la fusion, mais ne dit pas que l’ajout et l’incrément résultant doivent être strictement positifs. Le Value Object de prix valide `>= 0`, ce qui rend l’absence de règle analogue pour la quantité visible.

Risque : une Action pourrait accepter zéro ou une quantité négative, ou faire disparaître une ligne par fusion, alors que la spec ne définit ni suppression ni quantité négative dans ce flux.

Correction attendue : préciser dans AD-3 ou une AD de validation que chaque quantité demandée est strictement positive et que la quantité persistée après fusion reste strictement positive.

### [MEDIUM] La capture « au premier ajout » est indiquée mais le comportement en cas de fusion n’est pas entièrement normatif

AD-3 dit que nom/prix sont capturés au premier ajout et qu’un même `menuItemId` fusionne la quantité. C’est globalement correct. Il manque toutefois la règle explicite selon laquelle un ajout ultérieur du même identifiant ne remplace ni le nom ni le prix capturés, même si les valeurs entrantes diffèrent.

Risque : deux implémentations peuvent conserver le prix initial ou écraser le prix lors d’un ajout ultérieur, ce qui compromet le snapshot commercial de la commande.

Correction attendue : compléter AD-3 : lors d’une fusion, seule la quantité est modifiée ; `name` et `unitPrice` restent ceux de la première ligne créée.

### [LOW] Les limites de l’idempotence sont seulement implicites

AD-6 couvre correctement la répétition d’un envoi déjà `SentToKitchen` dans un flux séquentiel. Il ne distingue pas cette idempotence métier de la déduplication inter-processus, laquelle est différée. C’est acceptable pour le périmètre initial, mais la frontière doit être formulée pour éviter de promettre une garantie que le contrat synchrone ne fournit pas.

Correction attendue : préciser que l’idempotence garantie est celle observée par l’état persistant d’une commande, et que les courses concurrentes, retries réseau et déduplications côté consommateur restent hors garantie jusqu’à la décision durable différée.

## Frontières et responsabilités

Les frontières principales sont cohérentes : `app/commande` adapte le transport, `src/commande` porte le domaine et la persistance, et Cuisine reçoit un DTO distinct sans prix. Deux précisions manquent néanmoins :

1. Le contrat Cuisine devrait être décrit comme une dépendance sortante de Commande, avec une interface côté Commande et un adaptateur local ; Cuisine ne doit pas importer `Order`, `OrderLine` ou le Value Object de prix.
2. Le contrat doit distinguer clairement l’acceptation de la soumission et le traitement ultérieur par Cuisine. `SentToKitchen` signifie actuellement soumission réussie, pas plat préparé ; cette limite apparaît dans la spec mais devrait être rappelée dans la règle AD-5 ou dans le document explicatif.

## Décisions différées

Les décisions différées sont globalement pertinentes : outbox, retries, déduplication inter-processus, schéma exact, autorisation, paiement, disponibilité et suivi cuisine. Elles ne compensent pas les invariants métier manquants ci-dessus.

À ajouter aux décisions différées ou à transformer en décisions immédiates :

- le protocole exact de cohérence entre l’appel synchrone Cuisine et la persistance de `SentToKitchen` ; cette question est bloquante pour une implémentation sûre de CAP-4 ;
- la garantie attendue face aux erreurs d’infrastructure et aux appels concurrents ;
- les contraintes relationnelles minimales correspondant au type de service (`DineIn`/table et `Takeaway`/absence de table), même si le schéma détaillé reste différé.

## Recommandation de révision

Avant de passer à l’implémentation, compléter AD-1, AD-3 et AD-5 avec les règles ci-dessus, puis ajouter une décision dédiée au protocole d’envoi synchrone. Rejouer ensuite la revue de couverture CAP-1..5 et le lint mécanique du spine. Le verdict pourra passer à **Acceptable sous réserves** si le protocole CAP-4 est explicitement limité et assumé ; il ne devrait pas être considéré comme final tant que cet ordre persistance/appel reste ambigu.
