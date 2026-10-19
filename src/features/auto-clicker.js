    // ============================================================
    // Auto Clicker
    // ============================================================

    function attackIfAlive(battleClass) {
        const enemy =
            battleClass.enemyPokemon?.();

        if (
            enemy &&
            enemy.health() > 0
        ) {
            battleClass.clickAttack();
        }
    }

    function runAutoClick() {
        if (!autoClickEnabled) {
            return;
        }

        try {
            switch (App.game.gameState) {

                case GameConstants.GameState.fighting:
                    attackIfAlive(Battle);
                    break;

                case GameConstants.GameState.gym:
                    attackIfAlive(GymBattle);
                    break;

                case GameConstants.GameState.dungeon:
                    attackIfAlive(DungeonBattle);
                    break;

                case GameConstants.GameState.temporaryBattle:
                    attackIfAlive(
                        TemporaryBattleBattle
                    );
                    break;
            }

        } catch (error) {
            console.error(
                '[My Auto Clicker]',
                error
            );
        }
    }
