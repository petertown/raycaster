// top level class that needs to be extended by every game state
// Probably move it into some model file
export abstract class GameState {
  // TODO: Run game state logic

  // TODO: Run game state render

  // TODO: Run game state DOM stuff? Like buttons etc?
  // Maybe some kind of interface pattern

  // TODO: function to be called by the GameController to say whether it needs to swap to a new state OR remove itself, OR push some new state onto the list
  // Should that still run a draw on it? Or not?
}
