export enum GameStateType {
  MainMenu, // Just sitting on the menu
  GameInit, // Do the stuff to initialise a new game, then navigate to the GameRun
  GameRun, // Run game logic, and stop when there's a choice to be done, will show the 3D scene from the players POV
  GamePlayerChoice, // Stopped to make a choice, shows the available options in a clickable menu, hovering over them should look at the choice
  GameFriendChoice, // Stopped so that the other players can make a choice and say it in dialog, then navigates to GameDialog to actually say it
  GameDialog, // Plays a set of dialog, then goes back to GameRun afterwards
  GameMenu, // Player has pressed escape and opened the menu - pressing escape again afterwards will go back to the previous gamestate
}

export interface GameState {}
