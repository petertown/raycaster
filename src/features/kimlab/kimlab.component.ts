import { Component } from '@angular/core';
import { GameState } from '../../model/gamestate.enum';

@Component({
  selector: 'app-kimlab',
  imports: [],
  templateUrl: './kimlab.component.html',
  styleUrl: './kimlab.component.scss',
})
export class KimlabComponent {
  gameStateList!: GameState[];
  // Need to do a few things
  // Start with a menu
  // new game, continue, settings
}
