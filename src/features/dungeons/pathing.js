
    function getAvailableDungeons() {
        return Object.values(TownList)
            .filter(town => town?.dungeon && town.isUnlocked?.() &&
                town.dungeon.isUnlocked?.() && town.dungeon.hasUnlockedBoss?.())
            .sort((a, b) => a.name.localeCompare(b.name));
    }

    function getDungeonClearCount(dungeon) {
        const index = GameConstants.getDungeonIndex(dungeon.name);
        return Number(readObservable(App.game.statistics.dungeonsCleared[index]));
    }

    function dungeonPointKey(point) {
        return point.floor + ':' + point.x + ',' + point.y;
    }

    function sameDungeonPoint(a, b) {
        return a.floor === b.floor &&
            a.x === b.x &&
            a.y === b.y;
    }

    function getDungeonTile(map, point) {
        return map.board()[point.floor]?.[point.y]?.[point.x] ?? null;
    }

    function getDungeonNeighbors(map, point) {
        const floor = map.board()[point.floor] ?? [];
        const points = [
            { x: point.x, y: point.y - 1, floor: point.floor },
            { x: point.x + 1, y: point.y, floor: point.floor },
            { x: point.x, y: point.y + 1, floor: point.floor },
            { x: point.x - 1, y: point.y, floor: point.floor }
        ];

        return points.filter(candidate =>
            candidate.y >= 0 &&
            candidate.y < floor.length &&
            candidate.x >= 0 &&
            candidate.x < (floor[candidate.y]?.length ?? 0)
        );
    }

    function reconstructDungeonPath(cameFrom, start, target) {
        const path = [];
        let current = target;

        while (!sameDungeonPoint(current, start)) {
            path.unshift(current);
            current = cameFrom.get(dungeonPointKey(current));
            if (!current) {
                return null;
            }
        }

        return path;
    }

    function findKnownDungeonPath(
        map,
        target,
        {
            avoidEnemies = false,
            allowUnknownTarget = false,
            allowUnknownTraversal = false
        } = {}
    ) {
        const start = map.playerPosition();
        if (sameDungeonPoint(start, target)) {
            return [];
        }

        const queue = [start];
        const visited = new Set([dungeonPointKey(start)]);
        const cameFrom = new Map();
        const tileTypes = GameConstants.DungeonTileType;

        while (queue.length) {
            const current = queue.shift();

            for (const neighbor of getDungeonNeighbors(map, current)) {
                const key = dungeonPointKey(neighbor);
                if (visited.has(key)) {
                    continue;
                }

                const tile = getDungeonTile(map, neighbor);
                const isTarget = sameDungeonPoint(neighbor, target);
                const isKnown = tile?.isVisited || tile?.isVisible;

                if (
                    !tile ||
                    (
                        !isKnown &&
                        !allowUnknownTraversal &&
                        !(isTarget && allowUnknownTarget)
                    )
                ) {
                    continue;
                }

                if (
                    avoidEnemies &&
                    tile.isVisible &&
                    tile.type() === tileTypes.enemy &&
                    !isTarget
                ) {
                    continue;
                }

                visited.add(key);
                cameFrom.set(key, current);

                if (isTarget) {
                    return reconstructDungeonPath(
                        cameFrom,
                        start,
                        neighbor
                    );
                }

                queue.push(neighbor);
            }
        }

        return null;
    }

    function getDungeonBattleCost(map, point) {
        const tile = getDungeonTile(map, point);

        return tile &&
            !tile.isVisited &&
            tile.type() === GameConstants.DungeonTileType.enemy
                ? 1
                : 0;
    }

    function compareDungeonPathCost(a, b) {
        return a.battles - b.battles ||
            a.steps - b.steps;
    }

    function findBattleMinimizingDungeonPath(
        map,
        target,
        {
            allowUnknownTarget = false,
            allowUnknownTraversal = false
        } = {}
    ) {
        const start = map.playerPosition();
        if (sameDungeonPoint(start, target)) {
            return [];
        }

        const frontier = [{
            point: start,
            battles: 0,
            steps: 0
        }];
        const bestCosts = new Map([
            [
                dungeonPointKey(start),
                { battles: 0, steps: 0 }
            ]
        ]);
        const cameFrom = new Map();

        while (frontier.length) {
            frontier.sort(compareDungeonPathCost);
            const current = frontier.shift();

            if (sameDungeonPoint(current.point, target)) {
                return reconstructDungeonPath(
                    cameFrom,
                    start,
                    current.point
                );
            }

            for (const neighbor of getDungeonNeighbors(map, current.point)) {
                const tile = getDungeonTile(map, neighbor);
                const isTarget = sameDungeonPoint(neighbor, target);
                const isKnown = tile?.isVisited || tile?.isVisible;

                if (
                    !tile ||
                    (
                        !isKnown &&
                        !allowUnknownTraversal &&
                        !(isTarget && allowUnknownTarget)
                    )
                ) {
                    continue;
                }

                const nextCost = {
                    battles:
                        current.battles +
                        getDungeonBattleCost(map, neighbor),
                    steps: current.steps + 1
                };
                const key = dungeonPointKey(neighbor);
                const best = bestCosts.get(key);

                if (
                    best &&
                    compareDungeonPathCost(nextCost, best) >= 0
                ) {
                    continue;
                }

                bestCosts.set(key, nextCost);
                cameFrom.set(key, current.point);
                frontier.push({
                    point: neighbor,
                    ...nextCost
                });
            }
        }

        return null;
    }

    function getDungeonPathBattleCount(map, path) {
        return path.reduce(
            (total, point) =>
                total + getDungeonBattleCost(map, point),
            0
        );
    }

    function findAdvancedDungeonPath(map, target, options = {}) {
        if (options.minimizeBattles) {
            return findBattleMinimizingDungeonPath(
                map,
                target,
                options
            );
        }

        return findKnownDungeonPath(map, target, options);
    }

    function getVisibleDungeonTilesByType(map, type) {
        const position = map.playerPosition();

        return map.board()[position.floor]
            .flat()
            .filter(tile =>
                tile.isVisible &&
                tile.type() === type
            );
    }

    function getDungeonTilesByType(map, type) {
        const position = map.playerPosition();

        return map.board()[position.floor]
            .flat()
            .filter(tile =>
                tile.type() === type
            );
    }

    function getDungeonExplorationFrontiers(map, job) {
        const position = map.playerPosition();
        const floor = map.board()[position.floor];

        return floor
            .flat()
            .filter(tile => {
                if (
                    tile.isVisited ||
                    job.unreachableObjectives.has(
                        dungeonPointKey(tile.position)
                    )
                ) {
                    return false;
                }

                return getDungeonNeighbors(map, tile.position)
                    .some(point => getDungeonTile(map, point)?.isVisited);
            });
    }

    function findDefaultExplorationPath(map, job) {
        const position = map.playerPosition();
        const adjacent = getDungeonNeighbors(map, position)
            .map(point => getDungeonTile(map, point))
            .filter(tile =>
                tile &&
                !tile.isVisited &&
                !job.unreachableObjectives.has(
                    dungeonPointKey(tile.position)
                )
            );

        if (adjacent.length) {
            return [adjacent[0].position];
        }

        const paths = getDungeonExplorationFrontiers(map, job)
            .map(tile =>
                findKnownDungeonPath(
                    map,
                    tile.position,
                    { allowUnknownTarget: true }
                )
            )
            .filter(path => path?.length)
            .sort((a, b) => a.length - b.length);

        return paths[0] ?? null;
    }

    function chooseClosestDungeonTarget(
        map,
        tiles,
        job,
        options = {}
    ) {
        const paths = tiles
            .filter(tile =>
                !job.unreachableObjectives.has(
                    dungeonPointKey(tile.position)
                )
            )
            .map(tile => {
                const path = findAdvancedDungeonPath(
                    map,
                    tile.position,
                    options
                );

                return {
                    tile,
                    path,
                    battles: path
                        ? getDungeonPathBattleCount(map, path)
                        : Infinity
                };
            })
            .filter(candidate => candidate.path !== null)
            .sort((a, b) => {
                if (options.minimizeBattles) {
                    const battleDifference =
                        a.battles - b.battles;
                    if (battleDifference) {
                        return battleDifference;
                    }
                }

                return a.path.length - b.path.length;
            });

        return paths[0] ?? null;
    }

    function moveDungeonAlongPath(map, job, path, target) {
        if (!path?.length) {
            return false;
        }

        const next = path[0];
        const before = map.playerPosition();

        map.moveToCoordinates(next.x, next.y, next.floor);

        const after = map.playerPosition();
        const moved =
            !sameDungeonPoint(before, after) &&
            sameDungeonPoint(after, next);

        const targetKey = dungeonPointKey(target ?? next);

        if (moved) {
            job.failedMoves.delete(dungeonPointKey(next));
            job.failedMoves.delete(targetKey);
            return true;
        }

        const failures = (job.failedMoves.get(targetKey) ?? 0) + 1;
        job.failedMoves.set(targetKey, failures);

        if (failures >= 3) {
            job.unreachableObjectives.add(targetKey);
        }

        return false;
    }

    function getChestTier(tile) {
        if (
            tile?.type() !== GameConstants.DungeonTileType.chest
        ) {
            return null;
        }

        return tile.metadata?.tier ?? null;
    }

    function getDungeonPokemonProgress(dungeon) {
        let names = [];

        try {
            names = dungeon.allAvailablePokemon?.() ?? [];
        } catch (error) {
            console.error(
                '[Auto Dungeon] Could not read dungeon encounters.',
                error
            );
        }

        const obtainable = [
            ...new Set(
                names.filter(name =>
                    typeof name === 'string' && name.length
                )
            )
        ];
        const missing = obtainable.filter(name =>
            !App.game.party.alreadyCaughtPokemonByName(name)
        );

        return {
            total: obtainable.length,
            caught: obtainable.length - missing.length,
            missing
        };
    }

    function formatDungeonCollectionProgress(progress) {
        const summary =
            progress.caught + ' / ' +
            progress.total +
            ' obtainable caught';

        return progress.missing.length
            ? summary + '\nMissing: ' + progress.missing.join(', ')
            : summary + '\nAll currently obtainable Pokémon caught.';
    }

    function getAvailableDungeonLoot(dungeon, tier) {
        return (dungeon.lootTable?.[tier] ?? [])
            .filter(loot => {
                try {
                    if (
                        loot.requirement &&
                        !loot.requirement.isCompleted()
                    ) {
                        return false;
                    }

                    const item =
                        typeof ItemList !== 'undefined'
                            ? ItemList[loot.loot]
                            : null;

                    return !item ||
                        (
                            (!item.isAvailable || item.isAvailable()) &&
                            (!item.isSoldOut || !item.isSoldOut())
                        );
                } catch {
                    return false;
                }
            })
            .filter(loot => {
                const chance =
                    getDungeonLootChance(
                        dungeon,
                        loot,
                        tier
                    );
                return chance === null ||
                    chance > 0;
            });
    }

    function getDungeonLootChance(dungeon, loot, tier) {
        try {
            const chance = Number(
                dungeon.getLootChance?.(loot, tier)
            );

            return Number.isFinite(chance) && chance >= 0
                ? chance
                : null;
        } catch {
            return null;
        }
    }

    function formatDungeonRewardName(name) {
        try {
            return GameConstants.camelCaseToString(
                GameConstants.humanifyString(name)
            );
        } catch {
            return String(name).replace(/_/g, ' ');
        }
    }

    function navigateDefaultDungeon(job) {
        const map = DungeonRunner.map;
        const tileTypes = GameConstants.DungeonTileType;
        const currentType = map.currentTile().type();

        if (
            currentType === tileTypes.chest ||
            currentType === tileTypes.ladder ||
            currentType === tileTypes.boss
        ) {
            DungeonRunner.handleInteraction();
            return;
        }

        const chestTarget = chooseClosestDungeonTarget(
            map,
            getVisibleDungeonTilesByType(map, tileTypes.chest),
            job
        );

        if (chestTarget) {
            moveDungeonAlongPath(
                map,
                job,
                chestTarget.path,
                chestTarget.tile.position
            );
            return;
        }

        const exitTarget = chooseClosestDungeonTarget(
            map,
            [
                ...getVisibleDungeonTilesByType(map, tileTypes.ladder),
                ...getVisibleDungeonTilesByType(map, tileTypes.boss)
            ],
            job
        );

        if (exitTarget) {
            moveDungeonAlongPath(
                map,
                job,
                exitTarget.path,
                exitTarget.tile.position
            );
            return;
        }

        const explorationPath = findDefaultExplorationPath(map, job);

        if (explorationPath) {
            moveDungeonAlongPath(
                map,
                job,
                explorationPath,
                explorationPath[explorationPath.length - 1]
            );
            return;
        }

        throw new Error(
            'Default Pathing found no reachable unexplored tile or exit.'
        );
    }

    function selectAdvancedDungeonObjective(map, job) {
        const tileTypes = GameConstants.DungeonTileType;
        const hiddenPathOptions = {
            allowUnknownTarget: true,
            allowUnknownTraversal: true
        };
        const allChests = getDungeonTilesByType(
            map,
            tileTypes.chest
        );
        const exits = [
            ...getDungeonTilesByType(map, tileTypes.ladder),
            ...getDungeonTilesByType(map, tileTypes.boss)
        ];

        if (job.navigationMode === 'boss') {
            const exitTarget = chooseClosestDungeonTarget(
                map,
                exits,
                job,
                hiddenPathOptions
            );

            return exitTarget
                ? { kind: 'exit', ...exitTarget }
                : null;
        }

        if (job.navigationMode === 'chest') {
            const chestTarget = chooseClosestDungeonTarget(
                map,
                allChests,
                job,
                {
                    ...hiddenPathOptions,
                    minimizeBattles: true
                }
            );

            if (chestTarget) {
                return {
                    kind: 'chest',
                    ...chestTarget
                };
            }

            const exitTarget = chooseClosestDungeonTarget(
                map,
                exits,
                job,
                hiddenPathOptions
            );

            return exitTarget
                ? { kind: 'exit', ...exitTarget }
                : null;
        }

        if (job.navigationMode === 'full') {
            const selectedChests = allChests.filter(tile =>
                selectedDungeonChestRarities.includes(
                    getChestTier(tile)
                )
            );
            const selectedTarget = chooseClosestDungeonTarget(
                map,
                selectedChests,
                job,
                hiddenPathOptions
            );

            if (selectedTarget) {
                return {
                    kind: 'selected chest',
                    ...selectedTarget
                };
            }

            const enemyTarget = chooseClosestDungeonTarget(
                map,
                getDungeonTilesByType(map, tileTypes.enemy),
                job,
                hiddenPathOptions
            );

            if (enemyTarget) {
                return {
                    kind: 'enemy',
                    ...enemyTarget
                };
            }

            const chestTarget = chooseClosestDungeonTarget(
                map,
                allChests,
                job,
                hiddenPathOptions
            );

            if (chestTarget) {
                return {
                    kind: 'chest',
                    ...chestTarget
                };
            }

            const exitTarget = chooseClosestDungeonTarget(
                map,
                exits,
                job,
                hiddenPathOptions
            );

            return exitTarget
                ? { kind: 'exit', ...exitTarget }
                : null;
        }

        return null;
    }

    function navigateAdvancedDungeon(job) {
        const map = DungeonRunner.map;
        const tileTypes = GameConstants.DungeonTileType;
        const currentType = map.currentTile().type();

        if (currentType === tileTypes.chest) {
            DungeonRunner.handleInteraction();
            return;
        }

        const objective = selectAdvancedDungeonObjective(map, job);

        if (objective) {
            job.currentObjective = objective.kind;

            if (!objective.path.length) {
                if (
                    objective.kind === 'exit' &&
                    (
                        currentType === tileTypes.ladder ||
                        currentType === tileTypes.boss
                    )
                ) {
                    DungeonRunner.handleInteraction();
                    return;
                }

                throw new Error(
                    'Advanced Pathing reached an objective it could not interact with.'
                );
            }

            const moved = moveDungeonAlongPath(
                map,
                job,
                objective.path,
                objective.tile.position
            );
            job.currentObjective = moved
                ? objective.kind
                : 'recalculating route';
            return;
        }

        throw new Error(
            'Advanced Pathing found no reachable dungeon objective.'
        );
    }

    function navigateDungeon(job) {
        if (DungeonRunner.fighting() || DungeonBattle.catching()) {
            return;
        }

        const map = DungeonRunner.map;
        if (!map?.board?.()?.length) {
            throw new Error('Dungeon map is unavailable.');
        }

        if (
            job.navigationMode === 'default' ||
            !featureSettings.advancedDungeon
        ) {
            navigateDefaultDungeon(job);
            return;
        }

        navigateAdvancedDungeon(job);
    }

    function startDungeonAttempt(job) {
        const tokens = getDungeonTokens();
        const cost = Number(job.dungeon.tokenCost);

        if (!Number.isFinite(tokens) || tokens < cost) {
            throw new Error('Insufficient Dungeon Tokens.');
        }
        if (tokens - cost < job.reserve) {
            throw new Error(
                'Starting another run would use the ' +
                formatNumber(job.reserve) +
                ' DT reserve.'
            );
        }
        if (!DungeonRunner.canStartDungeon(job.dungeon)) {
            throw new Error(
                'The selected dungeon can no longer be entered.'
            );
        }

        MapHelper.moveToTown(job.dungeon.name);
        const townName =
            typeof player.town === 'string'
                ? player.town
                : player.town?.name;

        if (townName !== job.dungeon.name) {
            throw new Error(
                'Could not move to ' + job.dungeon.name + '.'
            );
        }

        const started = DungeonRunner.initializeDungeon(job.dungeon);
        if (
            started === false ||
            App.game.gameState !== GameConstants.GameState.dungeon
        ) {
            throw new Error('The dungeon could not be started.');
        }

        job.runStartClears = getDungeonClearCount(job.dungeon);
        job.runActive = true;
        job.currentObjective = 'exploration';
        job.failedMoves.clear();
        job.unreachableObjectives.clear();
    }
