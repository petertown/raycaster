import { Component } from '@angular/core';
import { GameState } from '../../model/gamestate.enum';

@Component({
  selector: 'app-kimlab',
  imports: [],
  templateUrl: './kimlab.component.html',
  styleUrl: './kimlab.component.scss',
})
export class KimlabComponent {
  // I should make a "game state util" ?
  gameStateList!: GameState[];


  // Need to do a few things
  // Start with a menu
  // new game, continue, settings
  // So that's first thing to do
  // Menu's should be html overlaid over the top of the canvas, and should be able to be opened as a game state
  // So, start with a main menu animation on the canvas
  // Then when that menu animation ends, swap to the main menu over the top of it
}
